import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { PayrollBatchRow, PayslipRow, EmployeeRow } from '../types/index.js';
import { AuditService } from './audit.service.js';

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
}
