import { describe, it, expect, beforeAll } from 'vitest';
import { AttendanceService } from '../src/services/attendance.service.js';
import { db } from '../src/db/database.js';
import { initializeDatabase } from '../src/db/init.js';
import { seedDatabase } from '../src/db/seed.js';

describe('Time & Attendance Regularization', () => {
  let adminUserId: string;
  let employeeId: string;

  beforeAll(() => {
    initializeDatabase();
    seedDatabase();
    const admin = db.prepare("SELECT id FROM users WHERE email = 'admin@nexus.com'").get() as { id: string };
    adminUserId = admin.id;

    const emp = db.prepare("SELECT id FROM employees WHERE employee_code = 'EMP-0003'").get() as { id: string };
    employeeId = emp.id;
  });

  it('regularizes attendance for an employee for a past date with audit justification', () => {
    const pastDate = '2026-05-15';
    db.prepare('DELETE FROM attendance WHERE employee_id = ? AND date = ?').run(employeeId, pastDate);

    const record = AttendanceService.regularize(
      {
        employeeId,
        date: pastDate,
        clockInTime: '08:30',
        clockOutTime: '17:30',
        status: 'PRESENT',
        totalWorkedMinutes: 540,
        otMinutes: 0,
        reason: 'Biometric fingerprint scanner reader malfunction',
      },
      adminUserId
    );

    expect(record).toBeDefined();
    expect(record.employee_id).toBe(employeeId);
    expect(record.date).toBe(pastDate);
    expect(record.status).toBe('PRESENT');
    expect(record.total_worked_minutes).toBe(540);
    expect(record.notes).toContain('Biometric fingerprint scanner reader malfunction');

    // Verify audit log
    const audit = db.prepare("SELECT * FROM audit_logs WHERE action = 'ATTENDANCE_REGULARIZED' AND entity_id = ?").get(record.id) as any;
    expect(audit).toBeDefined();
    expect(audit.user_id).toBe(adminUserId);
  });
});
