import { describe, it, expect, beforeAll } from 'vitest';
import { PayrollService } from '../src/services/payroll.service.js';
import { db } from '../src/db/database.js';
import { initializeDatabase } from '../src/db/init.js';
import { seedDatabase } from '../src/db/seed.js';

describe('Advanced Payroll Operations & Statutory Compliance', () => {
  let adminUserId: string;

  beforeAll(() => {
    initializeDatabase();
    seedDatabase();
    const admin = db.prepare("SELECT id FROM users WHERE email = 'admin@nexus.com'").get() as { id: string };
    adminUserId = admin.id;
  });

  it('generates, recalculates, and deletes draft payroll batch with full auditability', () => {
    const testMonth = '2026-06';
    
    // Ensure clean state for testMonth
    db.prepare("DELETE FROM payroll_batches WHERE month = ?").run(testMonth);

    // 1. Generate Batch
    const batch = PayrollService.generateBatch(testMonth, adminUserId);
    expect(batch).toBeDefined();
    expect(batch.month).toBe(testMonth);
    expect(batch.status).toBe('DRAFT');

    const payslips = PayrollService.getBatchPayslips(batch.id);
    expect(payslips.length).toBeGreaterThan(0);

    const initialGross = batch.total_gross_cents;

    // 2. Recalculate Batch
    const recalculated = PayrollService.recalculateBatch(batch.id, adminUserId);
    expect(recalculated.id).toBe(batch.id);
    expect(recalculated.status).toBe('DRAFT');
    expect(recalculated.total_gross_cents).toBe(initialGross);

    // 3. Export EPF Form C CSV
    const csvExport = PayrollService.exportEpfFormCCsv(batch.id);
    expect(typeof csvExport).toBe('string');
    expect(csvExport).toContain('Member EPF No / Employee Code');
    expect(csvExport).toContain('Total EPF Remittance (20%)');
    expect(csvExport).toContain('EMP-0001');

    // 4. Delete Draft Batch
    const deleteResult = PayrollService.deleteDraftBatch(batch.id, adminUserId);
    expect(deleteResult).toBeUndefined(); // deleteDraftBatch returns void

    // Verify completely deleted from database
    const checkBatch = db.prepare("SELECT * FROM payroll_batches WHERE id = ?").get(batch.id);
    expect(checkBatch).toBeUndefined();

    const checkPayslips = db.prepare("SELECT * FROM payslips WHERE batch_id = ?").all(batch.id);
    expect(checkPayslips.length).toBe(0);
  });

  it('prevents deletion of a PAID batch to safeguard historical financial records', () => {
    const testMonth = '2026-07';
    db.prepare("DELETE FROM payroll_batches WHERE month = ?").run(testMonth);

    const batch = PayrollService.generateBatch(testMonth, adminUserId);
    
    // Authorize & Mark as Paid
    PayrollService.markAsPaid(batch.id, adminUserId);

    expect(() => {
      PayrollService.deleteDraftBatch(batch.id, adminUserId);
    }).toThrow('Authorized PAID payroll batches cannot be deleted.');
  });
});
