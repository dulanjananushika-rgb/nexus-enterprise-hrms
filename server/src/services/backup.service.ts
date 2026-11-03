import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db/database.js';
import { AuditService } from './audit.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root paths relative to server/src/services
const ROOT_DIR = path.resolve(__dirname, '../../../');
const DB_PATH = path.resolve(ROOT_DIR, 'server/data/nexus_hrms.db');
const UPLOADS_DIR = path.resolve(ROOT_DIR, 'uploads/documents');
const BACKUPS_DIR = path.resolve(ROOT_DIR, 'backups');

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

export interface BackupInfo {
  id: string;
  timestamp: string;
  folderName: string;
  dbSizeBytes: number;
  documentsCount: number;
  totalSizeBytes: number;
}

export class BackupService {
  public static createBackup(actorUserId?: string): BackupInfo {
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const folderName = `backup_${timestampStr}`;
    const targetDir = path.join(BACKUPS_DIR, folderName);
    const targetDocsDir = path.join(targetDir, 'documents');

    fs.mkdirSync(targetDocsDir, { recursive: true });

    // 1. Force SQLite WAL checkpoint to ensure all data is in the primary file
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch (e) {
      console.warn('[Backup] WAL checkpoint warning:', e);
    }

    // 2. Copy SQLite DB
    const targetDbPath = path.join(targetDir, 'nexus_hrms.db');
    let dbSizeBytes = 0;
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, targetDbPath);
      dbSizeBytes = fs.statSync(targetDbPath).size;
    }

    // 3. Copy Uploaded Documents
    let docsCount = 0;
    let docsSizeBytes = 0;
    if (fs.existsSync(UPLOADS_DIR)) {
      const files = fs.readdirSync(UPLOADS_DIR);
      for (const file of files) {
        const srcFile = path.join(UPLOADS_DIR, file);
        const destFile = path.join(targetDocsDir, file);
        if (fs.statSync(srcFile).isFile()) {
          fs.copyFileSync(srcFile, destFile);
          docsCount++;
          docsSizeBytes += fs.statSync(destFile).size;
        }
      }
    }

    const totalSizeBytes = dbSizeBytes + docsSizeBytes;

    // 4. Write metadata manifest
    const manifest = {
      id: folderName,
      timestamp: new Date().toISOString(),
      folderName,
      dbSizeBytes,
      documentsCount: docsCount,
      totalSizeBytes,
      version: '1.0.0',
    };

    fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    // 5. Retention policy: Keep the latest 30 backups
    this.applyRetention(30);

    // 6. Audit log
    if (actorUserId) {
      AuditService.log({
        userId: actorUserId,
        action: 'SYSTEM_BACKUP_CREATED',
        entityType: 'SYSTEM',
        entityId: folderName,
        newValue: manifest,
      });
    }

    return manifest;
  }

  public static listBackups(): BackupInfo[] {
    if (!fs.existsSync(BACKUPS_DIR)) return [];
    const entries = fs.readdirSync(BACKUPS_DIR, { withFileTypes: true });
    const backups: BackupInfo[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(BACKUPS_DIR, entry.name, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            backups.push(data);
          } catch {
            // Ignore malformed manifests
          }
        }
      }
    }

    // Sort descending by timestamp
    return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private static applyRetention(keepCount: number): void {
    try {
      const backups = this.listBackups();
      if (backups.length > keepCount) {
        const toDelete = backups.slice(keepCount);
        for (const oldBackup of toDelete) {
          const dirPath = path.join(BACKUPS_DIR, oldBackup.folderName);
          if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
          }
        }
      }
    } catch (err) {
      console.warn('[Backup Retention Warning]', err);
    }
  }
}
