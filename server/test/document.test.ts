import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/database.js';
import { initializeDatabase } from '../src/db/init.js';
import { seedDatabase } from '../src/db/seed.js';
import { DocumentService } from '../src/services/document.service.js';

describe('Document Vault & Medical Slip Storage', () => {
  beforeEach(() => {
    initializeDatabase();
    seedDatabase();
  });

  it('uploads, retrieves and deletes an employee document cleanly', async () => {
    // Pick an existing employee
    const emp = db.prepare('SELECT id, user_id FROM employees LIMIT 1').get() as { id: string; user_id: string };
    expect(emp).toBeDefined();

    const sampleContent = 'Simulated PDF / Medical Slip binary data';
    const base64 = Buffer.from(sampleContent).toString('base64');

    const doc = await DocumentService.uploadDocument({
      employeeId: emp.id,
      title: 'Medical Certificate - Dr. Perera Clinic',
      category: 'MEDICAL_SLIP',
      fileName: 'medical_slip_2026.pdf',
      mimeType: 'application/pdf',
      base64Data: base64,
      uploadedByUserId: emp.user_id,
      notes: 'Certified 3-day recovery rest',
    });

    expect(doc.id).toBeDefined();
    expect(doc.employee_id).toBe(emp.id);
    expect(doc.category).toBe('MEDICAL_SLIP');
    expect(doc.file_size_bytes).toBe(Buffer.from(sampleContent).length);

    // List by employee
    const list = DocumentService.getByEmployee(emp.id);
    expect(list.some((d) => d.id === doc.id)).toBe(true);

    // Fetch file details
    const fileDetails = DocumentService.getFileDetails(doc.id);
    expect(fileDetails).not.toBeNull();
    expect(fileDetails?.fileName).toBe('medical_slip_2026.pdf');

    // Clean up
    const deleted = DocumentService.deleteDocument(doc.id, emp.user_id);
    expect(deleted).toBe(true);
    expect(DocumentService.getById(doc.id)).toBeNull();
  });
});
