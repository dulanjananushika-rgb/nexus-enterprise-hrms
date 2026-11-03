import { describe, it, expect, beforeEach } from 'vitest';
import { PayrollService } from '../src/services/payroll.service.js';
import { initializeDatabase } from '../src/db/init.js';
import { seedDatabase } from '../src/db/seed.js';
import { db } from '../src/db/database.js';

describe('Payroll Engine & Statutory Calculation Integrity', () => {
  let adminUserId: string;

  beforeEach(() => {
    initializeDatabase();
    seedDatabase();

    const admin = db.prepare("SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1").get() as { id: string };
    expect(admin).toBeDefined();
    adminUserId = admin.id;
  });

  it('correctly calculates progressive APIT tax in integer cents', () => {
    // 100,000 LKR (10,000,000 cents) -> 0% tax
    expect(PayrollService.calculateApitTaxCents(10000000)).toBe(0);

    // 150,000 LKR -> 50,000 in 6% bracket -> 3,000 LKR (300,000 cents)
    expect(PayrollService.calculateApitTaxCents(15000000)).toBe(300000);

    // 200,000 LKR -> 50,000 at 6% (3000) + 50,000 at 12% (6000) = 9,000 LKR (900,000 cents)
    expect(PayrollService.calculateApitTaxCents(20000000)).toBe(900000);
  });

  it('generates a monthly payroll batch with accurate statutory deductions', () => {
    const testMonth = '2026-12';
    const batch = PayrollService.generateBatch(testMonth, adminUserId);

    expect(batch).toBeDefined();
    expect(batch.month).toBe(testMonth);
    expect(batch.status).toBe('DRAFT');
    expect(batch.total_gross_cents).toBeGreaterThan(0);
    expect(batch.total_net_cents).toBeGreaterThan(0);
    expect(batch.total_epf_cents).toBeGreaterThan(0);

    const payslips = PayrollService.getBatchPayslips(batch.id);
    expect(payslips.length).toBeGreaterThan(0);

    // Verify statutory deductions for every employee in batch
    for (const slip of payslips) {
      // Employee EPF must equal exact 8% of base salary
      expect(slip.employee_epf_cents).toBe(Math.round(slip.base_salary_cents * 0.08));
      // Employer EPF must equal exact 12% of base salary
      expect(slip.employer_epf_cents).toBe(Math.round(slip.base_salary_cents * 0.12));
      // Employer ETF must equal exact 3% of base salary
      expect(slip.employer_etf_cents).toBe(Math.round(slip.base_salary_cents * 0.03));
      // Net salary must equal Gross - (Employee EPF + APIT)
      expect(slip.net_salary_cents).toBe(slip.gross_salary_cents - (slip.employee_epf_cents + slip.apit_tax_cents));
    }
  });

  it('marks a payroll batch as PAID and sets payslip statuses', () => {
    const testMonth = '2026-12';
    const batch = PayrollService.generateBatch(testMonth, adminUserId);
    expect(batch).toBeDefined();

    const updated = PayrollService.markAsPaid(batch.id, adminUserId);
    expect(updated.status).toBe('PAID');
    expect(updated.paid_at).not.toBeNull();

    const payslips = PayrollService.getBatchPayslips(batch.id);
    for (const slip of payslips) {
      expect(slip.status).toBe('PAID');
    }
  });

  it('exports bank bulk payment CSV with proper headers and monetary values', () => {
    const testMonth = '2026-12';
    const batch = PayrollService.generateBatch(testMonth, adminUserId);
    const csv = PayrollService.exportBankCsv(batch.id);

    expect(csv).toContain('Beneficiary Employee Code');
    expect(csv).toContain('Net Payment Amount (LKR)');
    expect(csv).toContain('Commercial Bank of Ceylon');
  });
});
