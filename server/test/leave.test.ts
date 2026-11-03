import { describe, it, expect, beforeEach } from 'vitest';
import { LeaveService } from '../src/services/leave.service.js';
import { EmployeeService } from '../src/services/employee.service.js';
import { initializeDatabase } from '../src/db/init.js';
import { seedDatabase } from '../src/db/seed.js';
import { db } from '../src/db/database.js';

describe('Leave Management Workflow & Business Rules', () => {
  let employeeId: string;
  let adminUserId: string;
  let annualLeaveTypeId: string;

  beforeEach(() => {
    initializeDatabase();
    seedDatabase();

    const emp = EmployeeService.list().find((e) => e.employee_code === 'EMP-0003');
    expect(emp).toBeDefined();
    employeeId = emp!.id;

    const admin = db.prepare("SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1").get() as { id: string };
    expect(admin).toBeDefined();
    adminUserId = admin.id;

    const leaveType = db.prepare("SELECT id FROM leave_types WHERE code = 'ANNUAL'").get() as { id: string };
    annualLeaveTypeId = leaveType.id;
  });

  it('rejects leave applications with invalid date ranges (start > end)', () => {
    expect(() => {
      LeaveService.apply({
        employeeId,
        leaveTypeId: annualLeaveTypeId,
        startDate: '2026-12-15',
        endDate: '2026-12-10', // Invalid: end before start
        totalDays: 5,
        reason: 'Testing date validity',
      });
    }).toThrow('Start date cannot be after end date.');
  });

  it('successfully creates a valid leave request and increments pending days', () => {
    const balancesBefore = LeaveService.getBalances(employeeId);
    const annualBefore = balancesBefore.find((b) => b.leave_type_id === annualLeaveTypeId);
    expect(annualBefore).toBeDefined();

    const application = LeaveService.apply({
      employeeId,
      leaveTypeId: annualLeaveTypeId,
      startDate: '2026-12-01',
      endDate: '2026-12-02',
      totalDays: 2,
      reason: 'Vacation in Nuwara Eliya',
    });

    expect(application).toBeDefined();
    expect(application.status).toBe('PENDING');
    expect(application.total_days).toBe(2);

    const balancesAfter = LeaveService.getBalances(employeeId);
    const annualAfter = balancesAfter.find((b) => b.leave_type_id === annualLeaveTypeId);
    expect(annualAfter!.pending_days).toBe(annualBefore!.pending_days + 2);
  });

  it('detects and rejects overlapping leave requests', () => {
    // 1. Create initial leave
    LeaveService.apply({
      employeeId,
      leaveTypeId: annualLeaveTypeId,
      startDate: '2026-12-01',
      endDate: '2026-12-03',
      totalDays: 3,
      reason: 'Initial leave',
    });

    // 2. Try overlapping leave
    expect(() => {
      LeaveService.apply({
        employeeId,
        leaveTypeId: annualLeaveTypeId,
        startDate: '2026-12-02', // Overlaps
        endDate: '2026-12-04',
        totalDays: 3,
        reason: 'Overlapping request attempt',
      });
    }).toThrow('You already have a pending or approved leave request during this date period.');
  });

  it('approves leave application through multi-tier workflow (HR finalizes balance)', () => {
    // Create leave application
    const app = LeaveService.apply({
      employeeId,
      leaveTypeId: annualLeaveTypeId,
      startDate: '2026-12-20',
      endDate: '2026-12-21',
      totalDays: 2,
      reason: 'Year end break',
    });

    const balancesBefore = LeaveService.getBalances(employeeId);
    const annualBefore = balancesBefore.find((b) => b.leave_type_id === annualLeaveTypeId);

    // HR approval with valid admin user ID
    const approved = LeaveService.review({
      applicationId: app.id,
      reviewerUserId: adminUserId,
      reviewerRole: 'HR_MANAGER',
      decision: 'APPROVE',
    });

    expect(approved.status).toBe('APPROVED_HR');

    const balancesAfter = LeaveService.getBalances(employeeId);
    const annualAfter = balancesAfter.find((b) => b.leave_type_id === annualLeaveTypeId);

    // Remaining days must decrease by 2, used days must increase by 2, pending days must decrease by 2
    expect(annualAfter!.used_days).toBe(annualBefore!.used_days + 2);
    expect(annualAfter!.remaining_days).toBe(annualBefore!.remaining_days - 2);
    expect(annualAfter!.pending_days).toBe(annualBefore!.pending_days - 2);
  });
});
