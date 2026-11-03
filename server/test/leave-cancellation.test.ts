import { describe, it, expect, beforeAll } from 'vitest';
import { LeaveService } from '../src/services/leave.service.js';
import { db } from '../src/db/database.js';
import { initializeDatabase } from '../src/db/init.js';
import { seedDatabase } from '../src/db/seed.js';

describe('Leave Lifecycle & Cancellation Restitution', () => {
  beforeAll(() => {
    initializeDatabase();
    seedDatabase();
  });

  it('cancels a PENDING leave request and restores pending_days to leave balance', () => {
    const emp = db.prepare("SELECT e.id, e.user_id FROM employees e WHERE e.employee_code = 'EMP-0003'").get() as { id: string; user_id: string };
    const leaveType = db.prepare("SELECT id FROM leave_types WHERE code = 'CASUAL'").get() as { id: string };

    const initialBalances = LeaveService.getBalances(emp.id, 2026);
    const initialCasual = initialBalances.find((b) => b.leave_type_code === 'CASUAL')!;
    const initialPending = initialCasual.pending_days;

    // Apply 2 days
    const leave = LeaveService.apply({
      employeeId: emp.id,
      leaveTypeId: leaveType.id,
      startDate: '2026-08-10',
      endDate: '2026-08-11',
      totalDays: 2,
      reason: 'Personal errands',
    });

    const midBalances = LeaveService.getBalances(emp.id, 2026);
    const midCasual = midBalances.find((b) => b.leave_type_code === 'CASUAL')!;
    expect(midCasual.pending_days).toBe(initialPending + 2);

    // Cancel leave as owner
    const cancelled = LeaveService.cancel({
      applicationId: leave.id,
      actorUserId: emp.user_id,
      actorRole: 'EMPLOYEE',
      actorEmployeeId: emp.id,
    });
    expect(cancelled.status).toBe('CANCELLED');

    // Verify balance restitution
    const finalBalances = LeaveService.getBalances(emp.id, 2026);
    const finalCasual = finalBalances.find((b) => b.leave_type_code === 'CASUAL')!;
    expect(finalCasual.pending_days).toBe(initialPending);
  });

  it('cancels an APPROVED leave request and restores remaining_days into balance', () => {
    const emp = db.prepare("SELECT e.id, e.user_id FROM employees e WHERE e.employee_code = 'EMP-0003'").get() as { id: string; user_id: string };
    const admin = db.prepare("SELECT id FROM users WHERE email = 'admin@nexus.com'").get() as { id: string };
    const leaveType = db.prepare("SELECT id FROM leave_types WHERE code = 'ANNUAL'").get() as { id: string };

    const initialBalances = LeaveService.getBalances(emp.id, 2026);
    const initialAnnual = initialBalances.find((b) => b.leave_type_code === 'ANNUAL')!;
    const initialRemaining = initialAnnual.remaining_days;

    // Apply 3 days
    const leave = LeaveService.apply({
      employeeId: emp.id,
      leaveTypeId: leaveType.id,
      startDate: '2026-09-01',
      endDate: '2026-09-03',
      totalDays: 3,
      reason: 'Family trip',
    });

    // HR Approves
    LeaveService.review({
      applicationId: leave.id,
      decision: 'APPROVE',
      reviewerUserId: admin.id,
      reviewerRole: 'SUPER_ADMIN',
    });

    const approvedBalances = LeaveService.getBalances(emp.id, 2026);
    const approvedAnnual = approvedBalances.find((b) => b.leave_type_code === 'ANNUAL')!;
    expect(approvedAnnual.remaining_days).toBe(initialRemaining - 3);

    // Cancel approved leave
    const cancelled = LeaveService.cancel({
      applicationId: leave.id,
      actorUserId: emp.user_id,
      actorRole: 'EMPLOYEE',
      actorEmployeeId: emp.id,
    });
    expect(cancelled.status).toBe('CANCELLED');

    // Verify restitution
    const restoredBalances = LeaveService.getBalances(emp.id, 2026);
    const restoredAnnual = restoredBalances.find((b) => b.leave_type_code === 'ANNUAL')!;
    expect(restoredAnnual.remaining_days).toBe(initialRemaining);
  });

  it('prevents unauthorized cancellation of another employee leave', () => {
    const emp1 = db.prepare("SELECT e.id, e.user_id FROM employees e WHERE e.employee_code = 'EMP-0001'").get() as { id: string; user_id: string };
    const emp2 = db.prepare("SELECT e.id, e.user_id FROM employees e WHERE e.employee_code = 'EMP-0003'").get() as { id: string; user_id: string };
    const leaveType = db.prepare("SELECT id FROM leave_types WHERE code = 'CASUAL'").get() as { id: string };

    const leave = LeaveService.apply({
      employeeId: emp1.id,
      leaveTypeId: leaveType.id,
      startDate: '2026-11-15',
      endDate: '2026-11-15',
      totalDays: 1,
      reason: 'Personal test',
    });

    // emp2 tries to cancel emp1's leave
    expect(() => {
      LeaveService.cancel({
        applicationId: leave.id,
        actorUserId: emp2.user_id,
        actorRole: 'EMPLOYEE',
        actorEmployeeId: emp2.id,
      });
    }).toThrow('Access denied: You can only cancel your own leave applications.');
  });
});
