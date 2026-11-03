import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { AttendanceRow } from '../types/index.js';
import { AuditService } from './audit.service.js';

export class AttendanceService {
  /**
   * Helper to format a local calendar date string (YYYY-MM-DD) avoiding UTC midnight rollover bugs
   */
  public static getLocalDateString(d: Date = new Date()): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  public static clockIn(
    employeeId: string,
    workMode: 'ON_SITE' | 'REMOTE' = 'ON_SITE',
    ipAddress?: string,
    notes?: string
  ): AttendanceRow {
    const today = this.getLocalDateString();

    // Check if already clocked in today
    const existing = db.prepare('SELECT id, clock_in_time FROM attendance WHERE employee_id = ? AND date = ?').get(employeeId, today) as
      | { id: string; clock_in_time: string }
      | undefined;

    if (existing) {
      throw new Error(`Already clocked in for today at ${new Date(existing.clock_in_time).toLocaleTimeString()}.`);
    }

    const now = new Date();
    const clockInIso = now.toISOString();

    // Standard Shift: 08:30 AM grace period in local time
    const shiftStart = new Date(now);
    shiftStart.setHours(8, 30, 0, 0);

    const status: 'PRESENT' | 'LATE' = now > shiftStart ? 'LATE' : 'PRESENT';
    const id = uuidv4();

    db.prepare(`
      INSERT INTO attendance (id, employee_id, date, clock_in_time, status, work_mode, ip_address, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, employeeId, today, clockInIso, status, workMode, ipAddress || null, notes || null);

    AuditService.log({
      action: 'CLOCK_IN',
      entityType: 'ATTENDANCE',
      entityId: id,
      ipAddress,
      newValue: { employeeId, date: today, time: clockInIso, status, workMode },
    });

    return this.getById(id)!;
  }

  public static clockOut(employeeId: string, ipAddress?: string): AttendanceRow {
    const today = this.getLocalDateString();

    const current = db.prepare(`
      SELECT * FROM attendance WHERE employee_id = ? AND date = ?
    `).get(employeeId, today) as AttendanceRow | undefined;

    if (!current) {
      throw new Error('No clock-in record found for today. Please clock in first.');
    }

    if (current.clock_out_time) {
      throw new Error(`Already clocked out today at ${new Date(current.clock_out_time).toLocaleTimeString()}.`);
    }

    const now = new Date();
    const clockOutIso = now.toISOString();
    const clockInDate = new Date(current.clock_in_time);

    // Calculate worked minutes
    const diffMs = now.getTime() - clockInDate.getTime();
    const totalMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));

    // Standard workday: 8 hours (480 minutes). Beyond 480 counts as Overtime
    const standardWorkMinutes = 480;
    const otMinutes = Math.max(0, totalMinutes - standardWorkMinutes);

    db.prepare(`
      UPDATE attendance 
      SET clock_out_time = ?, total_worked_minutes = ?, ot_minutes = ?
      WHERE id = ?
    `).run(clockOutIso, totalMinutes, otMinutes, current.id);

    AuditService.log({
      action: 'CLOCK_OUT',
      entityType: 'ATTENDANCE',
      entityId: current.id,
      ipAddress,
      newValue: { employeeId, totalMinutes, otMinutes },
    });

    return this.getById(current.id)!;
  }

  public static regularize(
    params: {
      employeeId: string;
      date: string;
      clockInTime: string;
      clockOutTime?: string;
      status: 'PRESENT' | 'LATE' | 'HALF_DAY';
      workMode?: 'ON_SITE' | 'REMOTE';
      totalWorkedMinutes?: number;
      otMinutes?: number;
      notes?: string;
      reason?: string;
      actorUserId?: string;
      ipAddress?: string;
    },
    fallbackActorUserId?: string
  ): AttendanceRow {
    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
      throw new Error("Invalid date format. Expected 'YYYY-MM-DD'.");
    }

    const noteText = params.reason || params.notes || 'Administrative Regularization';
    const actor = params.actorUserId || fallbackActorUserId;

    // Calculate duration and OT
    let totalMinutes = params.totalWorkedMinutes ?? 0;
    let otMinutes = params.otMinutes ?? 0;

    if (params.totalWorkedMinutes === undefined && params.clockInTime && params.clockOutTime) {
      const inParts = params.clockInTime.includes('T')
        ? new Date(params.clockInTime).getTime()
        : new Date(`1970-01-01T${params.clockInTime}`).getTime();
      const outParts = params.clockOutTime.includes('T')
        ? new Date(params.clockOutTime).getTime()
        : new Date(`1970-01-01T${params.clockOutTime}`).getTime();

      if (!isNaN(inParts) && !isNaN(outParts)) {
        if (inParts > outParts) {
          throw new Error('Clock-in time cannot be after clock-out time.');
        }
        totalMinutes = Math.max(0, Math.floor((outParts - inParts) / (1000 * 60)));
        otMinutes = Math.max(0, totalMinutes - 480);
      }
    }

    const existing = db.prepare('SELECT id FROM attendance WHERE employee_id = ? AND date = ?').get(
      params.employeeId,
      params.date
    ) as { id: string } | undefined;

    let targetId = existing?.id;

    if (existing) {
      db.prepare(`
        UPDATE attendance 
        SET clock_in_time = ?, clock_out_time = ?, status = ?, work_mode = ?,
            total_worked_minutes = ?, ot_minutes = ?, notes = ?
        WHERE id = ?
      `).run(
        params.clockInTime,
        params.clockOutTime || null,
        params.status,
        params.workMode || 'ON_SITE',
        totalMinutes,
        otMinutes,
        `Regularized: ${noteText}`,
        existing.id
      );
    } else {
      targetId = uuidv4();
      db.prepare(`
        INSERT INTO attendance (id, employee_id, date, clock_in_time, clock_out_time, status, work_mode, ip_address, total_worked_minutes, ot_minutes, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        targetId,
        params.employeeId,
        params.date,
        params.clockInTime,
        params.clockOutTime || null,
        params.status,
        params.workMode || 'ON_SITE',
        params.ipAddress || null,
        totalMinutes,
        otMinutes,
        `Regularized: ${noteText}`
      );
    }

    AuditService.log({
      userId: actor,
      action: 'ATTENDANCE_REGULARIZED',
      entityType: 'ATTENDANCE',
      entityId: targetId!,
      ipAddress: params.ipAddress,
      newValue: {
        employeeId: params.employeeId,
        date: params.date,
        status: params.status,
        reason: noteText,
        totalWorkedMinutes: totalMinutes,
      },
    });

    return this.getById(targetId!)!;
  }

  public static getTodayStatus(employeeId: string): AttendanceRow | null {
    const today = this.getLocalDateString();
    const stmt = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?');
    const result = stmt.get(employeeId, today);
    return (result as unknown as AttendanceRow) || null;
  }

  public static getById(id: string): AttendanceRow | null {
    const stmt = db.prepare(`
      SELECT a.*, (e.first_name || ' ' || e.last_name) as employee_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.id = ?
    `);
    const result = stmt.get(id);
    return (result as unknown as AttendanceRow) || null;
  }

  public static list(options?: {
    date?: string;
    employeeId?: string;
    departmentId?: string;
  }): AttendanceRow[] {
    let sql = `
      SELECT 
        a.*,
        (e.first_name || ' ' || e.last_name) as employee_name,
        e.employee_code,
        d.name as department_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      JOIN departments d ON e.department_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (options?.date) {
      sql += ' AND a.date = ?';
      params.push(options.date);
    }
    if (options?.employeeId) {
      sql += ' AND a.employee_id = ?';
      params.push(options.employeeId);
    }
    if (options?.departmentId) {
      sql += ' AND e.department_id = ?';
      params.push(options.departmentId);
    }

    sql += ' ORDER BY a.date DESC, a.clock_in_time DESC';
    return db.prepare(sql).all(...params) as unknown as AttendanceRow[];
  }
}
