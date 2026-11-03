import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { PayrollBatchRow, PayslipRow, EmployeeRow } from '../types/index.js';
import { AuditService } from './audit.service.js';
import { NotificationService } from './notification.service.js';

export class PayrollService {
  /**
   * Computes statutory APIT (Advance Personal Income Tax) progressively using exact integer minor currency units (cents).
   * Standard Sri Lankan Tax Brackets (Monthly, in LKR):
   * Up to 100,000: 0%
   * 100,001 - 150,000: 6%
   * 150,001 - 200,000: 12%
   * 200,001 - 250,000: 18%
   * 250,001 - 300,000: 24%
   * 300,001 - 350,000: 30%
   * Above 350,000: 36%
   */
  public static calculateApitTaxCents(taxableIncomeCents: number): number {
    if (taxableIncomeCents <= 10000000) return 0; // First 100,000 LKR relief

    let remaining = taxableIncomeCents - 10000000;
    let totalTaxCents = 0;
    const bracketSize = 5000000; // 50,000 LKR brackets
    const rates = [0.06, 0.12, 0.18, 0.24, 0.30];

    for (const rate of rates) {
      if (remaining <= 0) break;
      const taxableInBracket = Math.min(remaining, bracketSize);
      totalTaxCents += Math.round(taxableInBracket * rate);
      remaining -= taxableInBracket;
    }

    if (remaining > 0) {
      totalTaxCents += Math.round(remaining * 0.36);
    }

    return totalTaxCents;
  }

  public static generateBatch(month: string, creatorUserId: string): PayrollBatchRow {
    // Validate format: YYYY-MM
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new Error("Invalid payroll month format. Expected 'YYYY-MM' (e.g. '2026-11').");
    }

    // Verify creator user exists for FK integrity
    const userCheck = db.prepare('SELECT id FROM users WHERE id = ?').get(creatorUserId);
    if (!userCheck) {
      throw new Error(`Creator user '${creatorUserId}' does not exist.`);
    }

    // Check if batch already exists for this month
    const existing = db.prepare('SELECT id, status FROM payroll_batches WHERE month = ?').get(month) as
      | { id: string; status: string }
      | undefined;

    if (existing) {
      throw new Error(`Payroll batch for ${month} already exists with status: ${existing.status}.`);
    }

    db.exec('BEGIN IMMEDIATE;');
    try {
      const batchId = uuidv4();

      // Fetch all active or probation employees
      const employees = db.prepare(`
        SELECT * FROM employees 
        WHERE employment_status IN ('ACTIVE', 'PROBATION')
      `).all() as unknown as EmployeeRow[];

      if (employees.length === 0) {
        throw new Error('No active employees found to generate payroll.');
      }

      // 1. Insert parent payroll_batches record FIRST to satisfy Foreign Key constraints
      db.prepare(`
        INSERT INTO payroll_batches (
          id, month, status, total_gross_cents, total_net_cents, total_epf_cents, created_by_user_id
        ) VALUES (?, ?, 'DRAFT', 0, 0, 0, ?)
      `).run(batchId, month, creatorUserId);

      let totalGross = 0;
      let totalNet = 0;
      let totalEpf = 0;

      const insertPayslip = db.prepare(`
        INSERT INTO payslips (
          id, batch_id, employee_id, base_salary_cents, allowances_cents,
          overtime_pay_cents, unpaid_leave_deductions_cents, gross_salary_cents,
          employee_epf_cents, employer_epf_cents, employer_etf_cents,
          apit_tax_cents, other_deductions_cents, net_salary_cents, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GENERATED')
      `);

      for (const emp of employees) {
        const baseSalary = emp.base_salary_cents;

        // Calculate Overtime Pay from Attendance logs in this month
        const otStmt = db.prepare(`
          SELECT COALESCE(SUM(ot_minutes), 0) as total_ot_minutes
          FROM attendance
          WHERE employee_id = ? AND strftime('%Y-%m', date) = ?
        `).get(emp.id, month) as { total_ot_minutes: number };

        const otMinutes = otStmt.total_ot_minutes;
        const hourlyRateCents = Math.round(baseSalary / 200);
        const otMinuteRateCents = (hourlyRateCents * 1.5) / 60;
        const overtimePayCents = Math.round(otMinutes * otMinuteRateCents);

        // Calculate Unpaid Leave deductions
        const unpaidStmt = db.prepare(`
          SELECT COALESCE(SUM(l.total_days), 0) as total_unpaid_days
          FROM leave_applications l
          JOIN leave_types lt ON l.leave_type_id = lt.id
          WHERE l.employee_id = ? 
            AND lt.is_paid = 0
            AND l.status = 'APPROVED_HR'
            AND strftime('%Y-%m', l.start_date) = ?
        `).get(emp.id, month) as { total_unpaid_days: number };

        const dailyRateCents = Math.round(baseSalary / 25);
        const unpaidDeductionsCents = Math.round(unpaidStmt.total_unpaid_days * dailyRateCents);

        // Fixed travel / attendance allowance (flat 15,000 LKR = 1,500,000 cents for active staff)
        const allowancesCents = 1500000;

        const grossSalaryCents = Math.max(0, baseSalary + allowancesCents + overtimePayCents - unpaidDeductionsCents);

        // Statutory Deductions (Calculated strictly on Base Salary)
        const employeeEpfCents = Math.round(baseSalary * 0.08); // 8% Employee EPF
        const employerEpfCents = Math.round(baseSalary * 0.12); // 12% Employer EPF
        const employerEtfCents = Math.round(baseSalary * 0.03); // 3% Employer ETF

        // Tax calculation on Gross Salary
        const apitTaxCents = this.calculateApitTaxCents(grossSalaryCents);

        const totalDeductionsCents = employeeEpfCents + apitTaxCents;
        const netSalaryCents = Math.max(0, grossSalaryCents - totalDeductionsCents);

        insertPayslip.run(
          uuidv4(),
          batchId,
          emp.id,
          baseSalary,
          allowancesCents,
          overtimePayCents,
          unpaidDeductionsCents,
          grossSalaryCents,
          employeeEpfCents,
          employerEpfCents,
          employerEtfCents,
          apitTaxCents,
          0, // other deductions
          netSalaryCents
        );

        totalGross += grossSalaryCents;
        totalNet += netSalaryCents;
        totalEpf += employeeEpfCents + employerEpfCents;
      }

      // 2. Update Batch Summary Record with verified totals
      db.prepare(`
        UPDATE payroll_batches 
        SET total_gross_cents = ?, total_net_cents = ?, total_epf_cents = ?
        WHERE id = ?
      `).run(totalGross, totalNet, totalEpf, batchId);

      db.exec('COMMIT;');

      AuditService.log({
        userId: creatorUserId,
        action: 'PAYROLL_BATCH_GENERATED',
        entityType: 'PAYROLL_BATCH',
        entityId: batchId,
        newValue: { month, employeeCount: employees.length, totalGross, totalNet },
      });

      return this.getBatchById(batchId)!;
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  public static recalculateBatch(batchId: string, actorUserId: string): PayrollBatchRow {
    const batch = this.getBatchById(batchId);
    if (!batch) throw new Error('Payroll batch not found.');
    if (batch.status === 'PAID') {
      throw new Error('Cannot recalculate a finalized PAID payroll batch.');
    }

    db.exec('BEGIN IMMEDIATE;');
    try {
      // 1. Delete existing payslips
      db.prepare('DELETE FROM payslips WHERE batch_id = ?').run(batchId);

      // 2. Fetch active employees
      const employees = db.prepare(`
        SELECT * FROM employees 
        WHERE employment_status IN ('ACTIVE', 'PROBATION')
      `).all() as unknown as EmployeeRow[];

      let totalGross = 0;
      let totalNet = 0;
      let totalEpf = 0;

      const insertPayslip = db.prepare(`
        INSERT INTO payslips (
          id, batch_id, employee_id, base_salary_cents, allowances_cents,
          overtime_pay_cents, unpaid_leave_deductions_cents, gross_salary_cents,
          employee_epf_cents, employer_epf_cents, employer_etf_cents,
          apit_tax_cents, other_deductions_cents, net_salary_cents, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GENERATED')
      `);

      for (const emp of employees) {
        const baseSalary = emp.base_salary_cents;

        // Overtime from attendance
        const otStmt = db.prepare(`
          SELECT COALESCE(SUM(ot_minutes), 0) as total_ot_minutes
          FROM attendance
          WHERE employee_id = ? AND strftime('%Y-%m', date) = ?
        `).get(emp.id, batch.month) as { total_ot_minutes: number };

        const otMinutes = otStmt.total_ot_minutes;
        const hourlyRateCents = Math.round(baseSalary / 200);
        const otMinuteRateCents = (hourlyRateCents * 1.5) / 60;
        const overtimePayCents = Math.round(otMinutes * otMinuteRateCents);

        // Unpaid leaves
        const unpaidStmt = db.prepare(`
          SELECT COALESCE(SUM(l.total_days), 0) as total_unpaid_days
          FROM leave_applications l
          JOIN leave_types lt ON l.leave_type_id = lt.id
          WHERE l.employee_id = ? 
            AND lt.is_paid = 0
            AND l.status = 'APPROVED_HR'
            AND strftime('%Y-%m', l.start_date) = ?
        `).get(emp.id, batch.month) as { total_unpaid_days: number };

        const dailyRateCents = Math.round(baseSalary / 25);
        const unpaidDeductionsCents = Math.round(unpaidStmt.total_unpaid_days * dailyRateCents);

        const allowancesCents = 1500000;
        const grossSalaryCents = Math.max(0, baseSalary + allowancesCents + overtimePayCents - unpaidDeductionsCents);

        const employeeEpfCents = Math.round(baseSalary * 0.08);
        const employerEpfCents = Math.round(baseSalary * 0.12);
        const employerEtfCents = Math.round(baseSalary * 0.03);
        const apitTaxCents = this.calculateApitTaxCents(grossSalaryCents);

        const netSalaryCents = Math.max(0, grossSalaryCents - (employeeEpfCents + apitTaxCents));

        insertPayslip.run(
          uuidv4(),
          batchId,
          emp.id,
          baseSalary,
          allowancesCents,
          overtimePayCents,
          unpaidDeductionsCents,
          grossSalaryCents,
          employeeEpfCents,
          employerEpfCents,
          employerEtfCents,
          apitTaxCents,
          0,
          netSalaryCents
        );

        totalGross += grossSalaryCents;
        totalNet += netSalaryCents;
        totalEpf += employeeEpfCents + employerEpfCents;
      }

      db.prepare(`
        UPDATE payroll_batches 
        SET total_gross_cents = ?, total_net_cents = ?, total_epf_cents = ?
        WHERE id = ?
      `).run(totalGross, totalNet, totalEpf, batchId);

      db.exec('COMMIT;');

      AuditService.log({
        userId: actorUserId,
        action: 'PAYROLL_BATCH_RECALCULATED',
        entityType: 'PAYROLL_BATCH',
        entityId: batchId,
        newValue: { month: batch.month, totalGross, totalNet },
      });

      return this.getBatchById(batchId)!;
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  public static deleteDraftBatch(batchId: string, actorUserId: string): void {
    const batch = this.getBatchById(batchId);
    if (!batch) throw new Error('Payroll batch not found.');
    if (batch.status === 'PAID') {
      throw new Error('Authorized PAID payroll batches cannot be deleted.');
    }

    db.exec('BEGIN IMMEDIATE;');
    try {
      db.prepare('DELETE FROM payslips WHERE batch_id = ?').run(batchId);
      db.prepare('DELETE FROM payroll_batches WHERE id = ?').run(batchId);
      db.exec('COMMIT;');

      AuditService.log({
        userId: actorUserId,
        action: 'PAYROLL_BATCH_DELETED',
        entityType: 'PAYROLL_BATCH',
        entityId: batchId,
        oldValue: { month: batch.month, status: batch.status },
      });
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  public static markAsPaid(batchId: string, actorUserId: string): PayrollBatchRow {
    const batch = this.getBatchById(batchId);
    if (!batch) throw new Error('Payroll batch not found.');
    if (batch.status === 'PAID') throw new Error('Payroll batch is already marked as PAID.');

    db.exec('BEGIN IMMEDIATE;');
    try {
      const nowIso = new Date().toISOString();
      db.prepare(`
        UPDATE payroll_batches 
        SET status = 'PAID', paid_at = ?
        WHERE id = ?
      `).run(nowIso, batchId);

      db.prepare(`
        UPDATE payslips 
        SET status = 'PAID'
        WHERE batch_id = ?
      `).run(batchId);

      db.exec('COMMIT;');

      AuditService.log({
        userId: actorUserId,
        action: 'PAYROLL_BATCH_PAID',
        entityType: 'PAYROLL_BATCH',
        entityId: batchId,
        newValue: { paidAt: nowIso },
      });

      NotificationService.notifyAllActive({
        title: 'Salary & Payslip Disbursed',
        message: `Monthly salary run for ${batch.month} has been authorized. Your payslip is available.`,
        type: 'PAYROLL',
        link: 'my-payslips',
      });

      return this.getBatchById(batchId)!;
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  public static getBatchById(id: string): PayrollBatchRow | null {
    const stmt = db.prepare('SELECT * FROM payroll_batches WHERE id = ?');
    const result = stmt.get(id);
    return (result as unknown as PayrollBatchRow) || null;
  }

  public static listBatches(): PayrollBatchRow[] {
    return db.prepare('SELECT * FROM payroll_batches ORDER BY month DESC').all() as unknown as PayrollBatchRow[];
  }

  public static getBatchPayslips(batchId: string): PayslipRow[] {
    const stmt = db.prepare(`
      SELECT 
        p.*,
        (e.first_name || ' ' || e.last_name) as employee_name,
        e.employee_code,
        e.bank_name,
        e.bank_account_number,
        e.bank_branch_code,
        d.name as department_name
      FROM payslips p
      JOIN employees e ON p.employee_id = e.id
      JOIN departments d ON e.department_id = d.id
      WHERE p.batch_id = ?
      ORDER BY e.employee_code ASC
    `);
    return stmt.all(batchId) as unknown as PayslipRow[];
  }

  public static getEmployeePayslips(employeeId: string): PayslipRow[] {
    const stmt = db.prepare(`
      SELECT 
        p.*,
        b.month,
        (e.first_name || ' ' || e.last_name) as employee_name,
        e.employee_code,
        d.name as department_name
      FROM payslips p
      JOIN payroll_batches b ON p.batch_id = b.id
      JOIN employees e ON p.employee_id = e.id
      JOIN departments d ON e.department_id = d.id
      WHERE p.employee_id = ?
      ORDER BY b.month DESC
    `);
    return stmt.all(employeeId) as unknown as PayslipRow[];
  }

  public static exportBankCsv(batchId: string): string {
    const payslips = this.getBatchPayslips(batchId);
    if (payslips.length === 0) {
      throw new Error('No payslip records found for this batch.');
    }

    const headers = [
      'Beneficiary Employee Code',
      'Beneficiary Full Name',
      'Bank Name',
      'Branch Code',
      'Bank Account Number',
      'Currency',
      'Net Payment Amount (LKR)',
      'Payment Reference',
    ];

    const rows = payslips.map((p) => {
      const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(p.employee_id) as unknown as EmployeeRow;
      const netAmountLkr = (p.net_salary_cents / 100).toFixed(2);
      return [
        `"${emp.employee_code}"`,
        `"${emp.first_name} ${emp.last_name}"`,
        `"${emp.bank_name}"`,
        `"${emp.bank_branch_code}"`,
        `"${emp.bank_account_number}"`,
        'LKR',
        netAmountLkr,
        `"SALARY-${p.batch_id.slice(0, 8)}"`,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  public static exportEpfFormCCsv(batchId: string): string {
    const batch = this.getBatchById(batchId);
    if (!batch) throw new Error('Payroll batch not found.');

    const payslips = this.getBatchPayslips(batchId);
    if (payslips.length === 0) {
      throw new Error('No payslip records found for this batch.');
    }

    const headers = [
      'Line No',
      'Member EPF No / Employee Code',
      'National Identity Card (NIC)',
      'Member Full Name',
      'Total Earnings for EPF (LKR)',
      'Member EPF Contribution (8%)',
      'Employer EPF Contribution (12%)',
      'Total EPF Remittance (20%)',
      'Employer ETF Contribution (3%)',
    ];

    let totalBaseLkr = 0;
    let totalEmpEpf = 0;
    let totalEmprEpf = 0;
    let totalEpfRemittance = 0;
    let totalEtf = 0;

    const rows = payslips.map((p, index) => {
      const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(p.employee_id) as unknown as EmployeeRow;
      const baseLkr = p.base_salary_cents / 100;
      const empEpfLkr = p.employee_epf_cents / 100;
      const emprEpfLkr = p.employer_epf_cents / 100;
      const epfRemitLkr = (p.employee_epf_cents + p.employer_epf_cents) / 100;
      const etfLkr = p.employer_etf_cents / 100;

      totalBaseLkr += baseLkr;
      totalEmpEpf += empEpfLkr;
      totalEmprEpf += emprEpfLkr;
      totalEpfRemittance += epfRemitLkr;
      totalEtf += etfLkr;

      return [
        index + 1,
        `"${emp.employee_code}"`,
        `"${emp.nic_passport}"`,
        `"${emp.first_name} ${emp.last_name}"`,
        baseLkr.toFixed(2),
        empEpfLkr.toFixed(2),
        emprEpfLkr.toFixed(2),
        epfRemitLkr.toFixed(2),
        etfLkr.toFixed(2),
      ].join(',');
    });

    const summaryRow = [
      '"TOTAL"',
      '""',
      '""',
      `"Total Staff: ${payslips.length}"`,
      totalBaseLkr.toFixed(2),
      totalEmpEpf.toFixed(2),
      totalEmprEpf.toFixed(2),
      totalEpfRemittance.toFixed(2),
      totalEtf.toFixed(2),
    ].join(',');

    return [headers.join(','), ...rows, summaryRow].join('\n');
  }

  public static getPayslipById(payslipId: string): (PayslipRow & { month: string; nic_passport: string; bank_name: string; bank_account_number: string }) | null {
    const stmt = db.prepare(`
      SELECT 
        p.*,
        b.month,
        (e.first_name || ' ' || e.last_name) as employee_name,
        e.employee_code,
        e.nic_passport,
        e.bank_name,
        e.bank_account_number,
        d.name as department_name
      FROM payslips p
      JOIN payroll_batches b ON p.batch_id = b.id
      JOIN employees e ON p.employee_id = e.id
      JOIN departments d ON e.department_id = d.id
      WHERE p.id = ?
    `);
    const row = stmt.get(payslipId);
    return (row as any) || null;
  }

  public static generatePayslipHtml(payslipId: string): string {
    const slip = this.getPayslipById(payslipId);
    if (!slip) {
      throw new Error('Payslip not found.');
    }

    const formatLkr = (cents: number) => `LKR ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Payslip - ${slip.employee_code} - ${slip.month}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background: #f8fafc; padding: 30px 20px; font-size: 13px; }
    .voucher-card { max-width: 780px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); padding: 36px 40px; position: relative; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 24px; }
    .brand h1 { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .brand p { font-size: 11px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .doc-meta { text-align: right; }
    .doc-meta .title { font-size: 16px; font-weight: 700; color: #4338ca; text-transform: uppercase; }
    .doc-meta .period { font-size: 12px; color: #475569; font-weight: 600; margin-top: 3px; font-family: monospace; }
    .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f1f5f9; padding: 16px 20px; border-radius: 6px; margin-bottom: 24px; font-size: 12px; }
    .info-item { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .info-label { color: #64748b; font-weight: 500; }
    .info-val { color: #0f172a; font-weight: 600; }
    .breakdown-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .breakdown-table th { background: #e2e8f0; color: #334155; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; font-weight: 700; text-align: left; padding: 10px 14px; }
    .breakdown-table td { padding: 9px 14px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    .breakdown-table .amount { text-align: right; font-family: "Courier New", Courier, monospace; font-weight: 600; }
    .table-subhead { font-weight: 700; background: #f8fafc; color: #475569; font-size: 11px; text-transform: uppercase; }
    .highlight-row { background: #faf5ff; font-weight: 700; color: #581c87; border-top: 1px solid #d8b4fe; }
    .net-box { background: #ecfdf5; border: 1.5px solid #10b981; border-radius: 8px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
    .net-title { font-size: 14px; font-weight: 800; color: #065f46; text-transform: uppercase; }
    .net-sub { font-size: 11px; color: #047857; margin-top: 2px; }
    .net-val { font-size: 22px; font-weight: 900; font-family: monospace; color: #047857; }
    .statutory-card { background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px; padding: 12px 18px; margin-bottom: 24px; font-size: 11px; color: #3730a3; }
    .footer-note { border-top: 1px dashed #cbd5e1; padding-top: 16px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
    .print-btn-bar { max-width: 780px; margin: 0 auto 16px auto; display: flex; justify-content: flex-end; gap: 10px; }
    .btn { background: #4f46e5; color: #ffffff; border: none; padding: 8px 18px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; text-decoration: none; }
    .btn:hover { background: #4338ca; }
    @media print {
      body { background: #ffffff; padding: 0; }
      .print-btn-bar { display: none; }
      .voucher-card { box-shadow: none; border: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="print-btn-bar">
    <button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
  <div class="voucher-card">
    <div class="header">
      <div class="brand">
        <h1>NEXUS TECHNOLOGIES (PVT) LTD</h1>
        <p>Enterprise Human Resource & Payroll Management</p>
      </div>
      <div class="doc-meta">
        <div class="title">Confidential Salary Voucher</div>
        <div class="period">Pay Period: ${slip.month}</div>
      </div>
    </div>

    <div class="grid-info">
      <div>
        <div class="info-item"><span class="info-label">Employee ID:</span><span class="info-val font-mono">${slip.employee_code}</span></div>
        <div class="info-item"><span class="info-label">Full Name:</span><span class="info-val">${slip.employee_name}</span></div>
        <div class="info-item"><span class="info-label">NIC / Passport:</span><span class="info-val font-mono">${slip.nic_passport}</span></div>
        <div class="info-item"><span class="info-label">Department:</span><span class="info-val">${slip.department_name}</span></div>
      </div>
      <div>
        <div class="info-item"><span class="info-label">Disbursement Status:</span><span class="info-val" style="color: #059669;">${slip.status}</span></div>
        <div class="info-item"><span class="info-label">Bank Name:</span><span class="info-val">${slip.bank_name}</span></div>
        <div class="info-item"><span class="info-label">Bank Account:</span><span class="info-val font-mono">${slip.bank_account_number}</span></div>
        <div class="info-item"><span class="info-label">Generated Date:</span><span class="info-val font-mono">${slip.created_at.slice(0, 10)}</span></div>
      </div>
    </div>

    <table class="breakdown-table">
      <thead>
        <tr>
          <th>Earnings & Allowances</th>
          <th style="text-align: right;">Amount (LKR)</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Basic Monthly Salary</td><td class="amount">${formatLkr(slip.base_salary_cents)}</td></tr>
        ${slip.overtime_pay_cents > 0 ? `<tr><td>Overtime (OT) Earnings</td><td class="amount">${formatLkr(slip.overtime_pay_cents)}</td></tr>` : ''}
        ${slip.allowances_cents > 0 ? `<tr><td>Standard Allowances</td><td class="amount">${formatLkr(slip.allowances_cents)}</td></tr>` : ''}
        <tr class="highlight-row">
          <td>Total Gross Salary</td>
          <td class="amount">${formatLkr(slip.gross_salary_cents)}</td>
        </tr>
      </tbody>
    </table>

    <table class="breakdown-table">
      <thead>
        <tr>
          <th>Statutory & Voluntary Deductions</th>
          <th style="text-align: right;">Deduction (LKR)</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Employee EPF (8% Statutory Contribution)</td><td class="amount" style="color: #b91c1c;">${formatLkr(slip.employee_epf_cents)}</td></tr>
        <tr><td>APIT Income Tax Withholding (IRD Inland Revenue)</td><td class="amount" style="color: #b91c1c;">${formatLkr(slip.apit_tax_cents)}</td></tr>
        ${slip.unpaid_leave_deductions_cents > 0 ? `<tr><td>Unpaid Leave Deductions</td><td class="amount" style="color: #b91c1c;">${formatLkr(slip.unpaid_leave_deductions_cents)}</td></tr>` : ''}
        ${slip.other_deductions_cents > 0 ? `<tr><td>Other Deductions</td><td class="amount" style="color: #b91c1c;">${formatLkr(slip.other_deductions_cents)}</td></tr>` : ''}
        <tr class="highlight-row" style="background: #fff1f2; color: #9f1239; border-top-color: #fca5a5;">
          <td>Total Deductions</td>
          <td class="amount">${formatLkr(slip.employee_epf_cents + slip.apit_tax_cents + slip.unpaid_leave_deductions_cents + slip.other_deductions_cents)}</td>
        </tr>
      </tbody>
    </table>

    <div class="net-box">
      <div>
        <div class="net-title">Net Take-Home Salary</div>
        <div class="net-sub">Remitted directly to employee registered bank account</div>
      </div>
      <div class="net-val">${formatLkr(slip.net_salary_cents)}</div>
    </div>

    <div class="statutory-card">
      <strong>Corporate Employer Remittance (Non-Deductible from Employee):</strong>
      <div style="display: flex; justify-content: space-between; margin-top: 6px;">
        <span>Employer EPF (12%): <strong>${formatLkr(slip.employer_epf_cents)}</strong></span>
        <span>Employer ETF (3%): <strong>${formatLkr(slip.employer_etf_cents)}</strong></span>
        <span>Total Remitted to Central Bank: <strong>${formatLkr(slip.employer_epf_cents + slip.employee_epf_cents + slip.employer_etf_cents)}</strong></span>
      </div>
    </div>

    <div class="footer-note">
      <div>This is a computer-generated salary advice slip valid under Sri Lankan labor laws. No physical signature is required.</div>
      <div>Security Hash: ${slip.id.slice(0, 16)} • Nexus HRMS</div>
    </div>
  </div>
</body>
</html>`;
  }
}
