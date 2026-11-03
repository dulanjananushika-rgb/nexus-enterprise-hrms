import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { DocumentCategory, DocumentRow } from '../types/index.js';
import { AuditService } from './audit.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../../uploads/documents');

// Ensure storage folder exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export class DocumentService {
  public static async uploadDocument(params: {
    employeeId: string;
    title: string;
    category: DocumentCategory;
    fileName: string;
    mimeType: string;
    base64Data: string;
    uploadedByUserId: string;
    notes?: string;
  }): Promise<DocumentRow> {
    const docId = uuidv4();
    const cleanFileName = path.basename(params.fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const diskFileName = `${docId}-${cleanFileName}`;
    const destinationPath = path.join(UPLOADS_DIR, diskFileName);

    // Strip data URL scheme prefix if present (e.g. data:application/pdf;base64,...)
    const pureBase64 = params.base64Data.includes(';base64,')
      ? params.base64Data.split(';base64,')[1]
      : params.base64Data;

    const fileBuffer = Buffer.from(pureBase64, 'base64');
    fs.writeFileSync(destinationPath, fileBuffer);
    const fileSizeBytes = fileBuffer.length;

    db.prepare(`
      INSERT INTO documents (
        id, employee_id, title, category, file_name, file_path, file_size_bytes, mime_type, uploaded_by_user_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      docId,
      params.employeeId,
      params.title,
      params.category,
      params.fileName,
      diskFileName,
      fileSizeBytes,
      params.mimeType,
      params.uploadedByUserId,
      params.notes ?? null
    );

    AuditService.log({
      userId: params.uploadedByUserId,
      action: 'DOCUMENT_UPLOADED',
      entityType: 'DOCUMENT',
      entityId: docId,
      newValue: {
        employeeId: params.employeeId,
        category: params.category,
        fileName: params.fileName,
        fileSizeBytes,
      },
    });

    return this.getById(docId)!;
  }

  public static getByEmployee(employeeId: string): DocumentRow[] {
    const rows = db.prepare(`
      SELECT d.*, (e.first_name || ' ' || e.last_name) as employee_name
      FROM documents d
      JOIN employees e ON d.employee_id = e.id
      WHERE d.employee_id = ?
      ORDER BY d.created_at DESC
    `).all(employeeId) as unknown as DocumentRow[];
    return rows;
  }

  public static getById(id: string): DocumentRow | null {
    const row = db.prepare(`
      SELECT d.*, (e.first_name || ' ' || e.last_name) as employee_name
      FROM documents d
      JOIN employees e ON d.employee_id = e.id
      WHERE d.id = ?
    `).get(id) as unknown as DocumentRow | undefined;
    return row ?? null;
  }

  public static getFileDetails(id: string): { absolutePath: string; fileName: string; mimeType: string } | null {
    const doc = this.getById(id);
    if (!doc) return null;
    const absolutePath = path.join(UPLOADS_DIR, doc.file_path);
    if (!fs.existsSync(absolutePath)) return null;
    return {
      absolutePath,
      fileName: doc.file_name,
      mimeType: doc.mime_type,
    };
  }

  public static deleteDocument(id: string, userId: string): boolean {
    const doc = this.getById(id);
    if (!doc) return false;

    const absolutePath = path.join(UPLOADS_DIR, doc.file_path);
    if (fs.existsSync(absolutePath)) {
      try {
        fs.unlinkSync(absolutePath);
      } catch (err) {
        console.warn('[Doc Cleanup Warning]', err);
      }
    }

    db.prepare('DELETE FROM documents WHERE id = ?').run(id);

    AuditService.log({
      userId,
      action: 'DOCUMENT_DELETED',
      entityType: 'DOCUMENT',
      entityId: id,
      oldValue: doc,
    });

    return true;
  }
}
