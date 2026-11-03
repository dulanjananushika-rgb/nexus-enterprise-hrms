import { describe, it, expect, beforeAll } from 'vitest';
import { ReportService } from '../src/services/report.service.js';
import { PayrollService } from '../src/services/payroll.service.js';
import { db } from '../src/db/database.js';
import { initializeDatabase } from '../src/db/init.js';
import { seedDatabase } from '../src/db/seed.js';

describe('Reporting Service & Analytics Aggregations', () => {
  beforeAll(() => {
    initializeDatabase();
    seedDatabase();
    const admin = db.prepare("SELECT id FROM users WHERE email = 'admin@nexus.com'").get() as { id: string };
    
    // Ensure at least one payroll batch exists for statutory reporting
    const existing = db.prepare("SELECT id FROM payroll_batches WHERE month = '2026-05'").get();
    if (!existing) {
      PayrollService.generateBatch('2026-05', admin.id);
    }
  });

  it('generates attendance summary with employee totals and work hours', () => {
    const summary = ReportService.getAttendanceSummary({});
    expect(summary).toBeDefined();
    expect(Array.isArray(summary)).toBe(true);
    expect(summary.length).toBeGreaterThan(0);
    
    const first = summary[0];
    expect(first.employeeCode).toBeDefined();
    expect(first.fullName).toBeDefined();
    expect(first.departmentName).toBeDefined();
    expect(typeof first.totalWorkedHours).toBe('number');
  });

  it('generates leave utilization breakdown by employee and leave type', () => {
    const utilization = ReportService.getLeaveUtilization({ year: 2026 });
    expect(utilization).toBeDefined();
    expect(Array.isArray(utilization)).toBe(true);
    expect(utilization.length).toBeGreaterThan(0);

    const record = utilization[0];
    expect(record.leaveTypeCode).toBeDefined();
    expect(record.entitledDays).toBeGreaterThan(0);
    expect(typeof record.remainingDays).toBe('number');
  });

  it('generates statutory EPF/ETF reconciliation and balances mathematically', () => {
    const reconciliation = ReportService.getEpfEtfReconciliation({ month: '2026-05' });
    expect(reconciliation).toBeDefined();
    expect(reconciliation!.batchId).toBeDefined();
    expect(reconciliation!.records.length).toBeGreaterThan(0);

    const totals = reconciliation!.totals;
    expect(totals.totalGrossCents).toBeGreaterThan(0);
    expect(totals.totalEmployeeEpfCents).toBeGreaterThan(0);
    expect(totals.totalEmployerEpfCents).toBeGreaterThan(0);
    expect(totals.totalEpfCents).toBe(totals.totalEmployeeEpfCents + totals.totalEmployerEpfCents);
    expect(totals.grandTotalRemittanceCents).toBe(totals.totalEpfCents + totals.totalEmployerEtfCents);
  });
});
