import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { LeaveApplicationRow, LeaveBalanceRow } from '../types/index.js';
import { AuditService } from './audit.service.js';

export class LeaveService {
  public static apply(data: {
    employeeId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    reason: string;
  }): LeaveApplicationRow {
    if (new Date(data.startDate) > new Date(data.endDate)) {
      throw new Error('Start date cannot be after end date.');
    }
    if (data.totalDays <= 0) {
      throw new Error('Total leave days must be greater than zero.');
    }

    db.exec('BEGIN IMMEDIATE;');
    try {
      // 1. Check for overlapping existing active leaves
      const overlapQuery = `
        SELECT id FROM leave_applications
        WHERE employee_id = ?
          AND status IN ('PENDING', 'APPROVED_MANAGER', 'APPROVED_HR')
          AND NOT (end_date < ? OR start_date > ?)
      `;
      const overlap = db.prepare(overlapQuery).get(data.employeeId, data.startDate, data.endDate);
      if (overlap) {
        throw new Error('You already have a pending or approved leave request during this date period.');
      }

      // 2. Check Leave Type and Balance
      const leaveType = db.prepare('SELECT code, name, is_paid FROM leave_types WHERE id = ?').get(data.leaveTypeId) as
        | { code: string; name: string; is_paid: number }
        | undefined;

      if (!leaveType) {
        throw new Error('Invalid leave type selected.');
      }

      const currentYear = new Date(data.startDate).getFullYear();

      // If paid leave, verify balance
      if (leaveType.is_paid === 1) {
        const balance = db.prepare(`
          SELECT * FROM leave_balances 
          WHERE employee_id = ? AND leave_type_id = ? AND year = ?
        `).get(data.employeeId, data.leaveTypeId, currentYear) as LeaveBalanceRow | undefined;

        if (!balance) {
          throw new Error(`No leave balance allocated for ${leaveType.name} in ${currentYear}.`);
        }

        const available = balance.remaining_days - balance.pending_days;
        if (available < data.totalDays) {
          throw new Error(`Insufficient leave balance. Available: ${available} day(s), Requested: ${data.totalDays} day(s).`);
        }

        // Increment pending_days in balance
        db.prepare(`
          UPDATE leave_balances 
          SET pending_days = pending_days + ?
          WHERE id = ?
        `).run(data.totalDays, balance.id);
      }

      // 3. Create Application
      const applicationId = uuidv4();
      db.prepare(`
        INSERT INTO leave_applications (
          id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
      `).run(
        applicationId,
        data.employeeId,
        data.leaveTypeId,
        data.startDate,
        data.endDate,
        data.totalDays,
        data.reason
      );

      db.exec('COMMIT;');

      AuditService.log({
        action: 'LEAVE_APPLIED',
        entityType: 'LEAVE',
        entityId: applicationId,
        newValue: data,
      });

      return this.getById(applicationId)!;
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  public static review(params: {
    applicationId: string;
    reviewerUserId: string;
    reviewerRole: string;
    decision: 'APPROVE' | 'REJECT';
    rejectionReason?: string;
  }): LeaveApplicationRow {
    const app = this.getById(params.applicationId);
    if (!app) throw new Error('Leave application not found.');

    if (app.status === 'APPROVED_HR' || app.status === 'REJECTED' || app.status === 'CANCELLED') {
      throw new Error(`Cannot review application with current status: ${app.status}.`);
    }

    db.exec('BEGIN IMMEDIATE;');
    try {
      const leaveType = db.prepare('SELECT is_paid FROM leave_types WHERE id = ?').get(app.leave_type_id) as { is_paid: number };
      const currentYear = new Date(app.start_date).getFullYear();

      if (params.decision === 'REJECT') {
        // If rejected, release pending days
        if (leaveType.is_paid === 1) {
          db.prepare(`
            UPDATE leave_balances 
            SET pending_days = MAX(0, pending_days - ?)
            WHERE employee_id = ? AND leave_type_id = ? AND year = ?
          `).run(app.total_days, app.employee_id, app.leave_type_id, currentYear);
        }

        db.prepare(`
          UPDATE leave_applications 
          SET status = 'REJECTED', reviewed_by_user_id = ?, rejection_reason = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(params.reviewerUserId, params.rejectionReason || 'Rejected by management', params.applicationId);
      } else {
        // Decision: APPROVE
        // If reviewer is Line Manager: set to APPROVED_MANAGER
        // If reviewer is HR/Admin: set to APPROVED_HR (and finalize balance deduction)
        const nextStatus = (params.reviewerRole === 'SUPER_ADMIN' || params.reviewerRole === 'HR_MANAGER') 
          ? 'APPROVED_HR' 
          : 'APPROVED_MANAGER';

        if (nextStatus === 'APPROVED_HR') {
          if (leaveType.is_paid === 1) {
            // Deduct from remaining and pending, add to used
            db.prepare(`
              UPDATE leave_balances 
              SET pending_days = MAX(0, pending_days - ?),
                  used_days = used_days + ?,
                  remaining_days = remaining_days - ?
              WHERE employee_id = ? AND leave_type_id = ? AND year = ?
            `).run(app.total_days, app.total_days, app.total_days, app.employee_id, app.leave_type_id, currentYear);
          }
        }

        db.prepare(`
          UPDATE leave_applications 
          SET status = ?, reviewed_by_user_id = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(nextStatus, params.reviewerUserId, params.applicationId);
      }

      db.exec('COMMIT;');

      AuditService.log({
        userId: params.reviewerUserId,
        action: `LEAVE_${params.decision}`,
        entityType: 'LEAVE',
        entityId: params.applicationId,
        newValue: { decision: params.decision, reviewerRole: params.reviewerRole },
      });

      return this.getById(params.applicationId)!;
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  public static getById(id: string): LeaveApplicationRow | null {
    const stmt = db.prepare(`
      SELECT 
        l.*,
        (e.first_name || ' ' || e.last_name) as employee_name,
        e.employee_code,
        d.name as department_name,
        lt.name as leave_type_name,
        lt.code as leave_type_code
      FROM leave_applications l
      JOIN employees e ON l.employee_id = e.id
      JOIN departments d ON e.department_id = d.id
      JOIN leave_types lt ON l.leave_type_id = lt.id
      WHERE l.id = ?
    `);
    const result = stmt.get(id);
    return (result as unknown as LeaveApplicationRow) || null;
  }

  public static getBalances(employeeId: string, year = new Date().getFullYear()): LeaveBalanceRow[] {
    const stmt = db.prepare(`
      SELECT 
        b.*,
        lt.name as leave_type_name,
        lt.code as leave_type_code
      FROM leave_balances b
      JOIN leave_types lt ON b.leave_type_id = lt.id
      WHERE b.employee_id = ? AND b.year = ?
      ORDER BY lt.code ASC
    `);
    return stmt.all(employeeId, year) as unknown as LeaveBalanceRow[];
  }

  public static listApplications(options?: {
    employeeId?: string;
    departmentId?: string;
    managerId?: string;
    status?: string;
  }): LeaveApplicationRow[] {
    let sql = `
      SELECT 
        l.*,
        (e.first_name || ' ' || e.last_name) as employee_name,
        e.employee_code,
        d.name as department_name,
        lt.name as leave_type_name,
        lt.code as leave_type_code
      FROM leave_applications l
      JOIN employees e ON l.employee_id = e.id
      JOIN departments d ON e.department_id = d.id
      JOIN leave_types lt ON l.leave_type_id = lt.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (options?.employeeId) {
      sql += ' AND l.employee_id = ?';
      params.push(options.employeeId);
    }
    if (options?.departmentId) {
      sql += ' AND e.department_id = ?';
      params.push(options.departmentId);
    }
    if (options?.managerId) {
      sql += ' AND e.manager_id = ?';
      params.push(options.managerId);
    }
    if (options?.status) {
      sql += ' AND l.status = ?';
      params.push(options.status);
    }

    sql += ' ORDER BY l.created_at DESC';
    return db.prepare(sql).all(...params) as unknown as LeaveApplicationRow[];
  }
}
