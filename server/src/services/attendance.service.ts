import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { AttendanceRow } from '../types/index.js';
import { AuditService } from './audit.service.js';

export class AttendanceService {
  public static clockIn(
    employeeId: string,
    workMode: 'ON_SITE' | 'REMOTE' = 'ON_SITE',
    ipAddress?: string,
    notes?: string
  ): AttendanceRow {
    const today = new Date().toISOString().split('T')[0];

    // Check if already clocked in today
    const existing = db.prepare('SELECT id, clock_in_time FROM attendance WHERE employee_id = ? AND date = ?').get(employeeId, today) as
      | { id: string; clock_in_time: string }
      | undefined;

    if (existing) {
      throw new Error(`Already clocked in for today at ${new Date(existing.clock_in_time).toLocaleTimeString()}.`);
    }

    const now = new Date();
    const clockInIso = now.toISOString();

    // Standard Shift: 08:30 AM grace period
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
    const today = new Date().toISOString().split('T')[0];

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

  public static getTodayStatus(employeeId: string): AttendanceRow | null {
    const today = new Date().toISOString().split('T')[0];
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
