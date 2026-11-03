import { db } from '../db/database.js';

export interface AttendanceSummaryRow {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  presentDays: number;
  lateDays: number;
  halfDays: number;
  onLeaveDays: number;
  totalWorkedHours: number;
  totalOtHours: number;
}

export interface LeaveUtilizationRow {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  entitledDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}

export interface EpfEtfReconciliationRow {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  nicPassport: string;
  grossSalaryCents: number;
  employeeEpfCents: number;
  employerEpfCents: number;
  totalEpfCents: number;
  employerEtfCents: number;
  totalRemittanceCents: number;
}

export interface EpfEtfReconciliationReport {
  batchId: string;
  month: string;
  records: EpfEtfReconciliationRow[];
  totals: {
    totalGrossCents: number;
    totalEmployeeEpfCents: number;
    totalEmployerEpfCents: number;
    totalEpfCents: number;
    totalEmployerEtfCents: number;
    grandTotalRemittanceCents: number;
  };
}

export class ReportService {
  public static getAttendanceSummary(filters: {
    month?: string; // YYYY-MM
    startDate?: string;
    endDate?: string;
    departmentId?: string;
  }): AttendanceSummaryRow[] {
    let whereClauses: string[] = [];
    const params: any[] = [];

    if (filters.month) {
      whereClauses.push("strftime('%Y-%m', a.date) = ?");
      params.push(filters.month);
    } else {
      if (filters.startDate) {
        whereClauses.push('a.date >= ?');
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereClauses.push('a.date <= ?');
        params.push(filters.endDate);
      }
    }

    if (filters.departmentId) {
      whereClauses.push('e.department_id = ?');
      params.push(filters.departmentId);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sql = `
      SELECT 
        e.id as employeeId,
        e.employee_code as employeeCode,
        (e.first_name || ' ' || e.last_name) as fullName,
        d.name as departmentName,
        SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) as presentDays,
        SUM(CASE WHEN a.status = 'LATE' THEN 1 ELSE 0 END) as lateDays,
        SUM(CASE WHEN a.status = 'HALF_DAY' THEN 1 ELSE 0 END) as halfDays,
        SUM(CASE WHEN a.status = 'ON_LEAVE' THEN 1 ELSE 0 END) as onLeaveDays,
        ROUND(COALESCE(SUM(a.total_worked_minutes), 0) / 60.0, 1) as totalWorkedHours,
        ROUND(COALESCE(SUM(a.ot_minutes), 0) / 60.0, 1) as totalOtHours
      FROM employees e
      JOIN departments d ON e.department_id = d.id
      LEFT JOIN attendance a ON e.id = a.employee_id
      ${whereSql}
      GROUP BY e.id, e.employee_code, e.first_name, e.last_name, d.name
      ORDER BY d.name ASC, e.employee_code ASC
    `;

    return db.prepare(sql).all(...params) as unknown as AttendanceSummaryRow[];
  }

  public static getLeaveUtilization(filters: {
    year: number;
    departmentId?: string;
  }): LeaveUtilizationRow[] {
    const whereClauses: string[] = ['lb.year = ?'];
    const params: any[] = [filters.year];

    if (filters.departmentId) {
      whereClauses.push('e.department_id = ?');
      params.push(filters.departmentId);
    }

    const sql = `
      SELECT 
        e.id as employeeId,
        e.employee_code as employeeCode,
        (e.first_name || ' ' || e.last_name) as fullName,
        d.name as departmentName,
        lt.code as leaveTypeCode,
        lt.name as leaveTypeName,
        lb.entitled_days as entitledDays,
        lb.used_days as usedDays,
        lb.pending_days as pendingDays,
        lb.remaining_days as remainingDays
      FROM leave_balances lb
      JOIN employees e ON lb.employee_id = e.id
      JOIN departments d ON e.department_id = d.id
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY d.name ASC, e.employee_code ASC, lt.code ASC
    `;

    return db.prepare(sql).all(...params) as unknown as LeaveUtilizationRow[];
  }

  public static getEpfEtfReconciliation(filters: {
    batchId?: string;
    month?: string;
  }): EpfEtfReconciliationReport | null {
    let batchQuery = 'SELECT * FROM payroll_batches';
    const batchParams: any[] = [];

    if (filters.batchId) {
      batchQuery += ' WHERE id = ?';
      batchParams.push(filters.batchId);
    } else if (filters.month) {
      batchQuery += ' WHERE month = ?';
      batchParams.push(filters.month);
    } else {
      batchQuery += ' ORDER BY month DESC LIMIT 1';
    }

    const batch = db.prepare(batchQuery).get(...batchParams) as any;
    if (!batch) return null;

    const sql = `
      SELECT 
        p.employee_id as employeeId,
        e.employee_code as employeeCode,
        (e.first_name || ' ' || e.last_name) as fullName,
        e.nic_passport as nicPassport,
        p.gross_salary_cents as grossSalaryCents,
        p.employee_epf_cents as employeeEpfCents,
        p.employer_epf_cents as employerEpfCents,
        (p.employee_epf_cents + p.employer_epf_cents) as totalEpfCents,
        p.employer_etf_cents as employerEtfCents,
        (p.employee_epf_cents + p.employer_epf_cents + p.employer_etf_cents) as totalRemittanceCents
      FROM payslips p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.batch_id = ?
      ORDER BY e.employee_code ASC
    `;

    const records = db.prepare(sql).all(batch.id) as unknown as EpfEtfReconciliationRow[];

    const totals = records.reduce(
      (acc, r) => {
        acc.totalGrossCents += r.grossSalaryCents;
        acc.totalEmployeeEpfCents += r.employeeEpfCents;
        acc.totalEmployerEpfCents += r.employerEpfCents;
        acc.totalEpfCents += r.totalEpfCents;
        acc.totalEmployerEtfCents += r.employerEtfCents;
        acc.grandTotalRemittanceCents += r.totalRemittanceCents;
        return acc;
      },
      {
        totalGrossCents: 0,
        totalEmployeeEpfCents: 0,
        totalEmployerEpfCents: 0,
        totalEpfCents: 0,
        totalEmployerEtfCents: 0,
        grandTotalRemittanceCents: 0,
      }
    );

    return {
      batchId: batch.id,
      month: batch.month,
      records,
      totals,
    };
  }
}
