import { describe, it, expect, beforeAll } from 'vitest';
import { AuthService } from '../src/services/auth.service.js';
import { LeaveService } from '../src/services/leave.service.js';
import { db } from '../src/db/database.js';
import { initializeDatabase } from '../src/db/init.js';
import { seedDatabase } from '../src/db/seed.js';

describe('Security Controls & BOLA Prevention', () => {
  beforeAll(() => {
    initializeDatabase();
    seedDatabase();
  });

  it('rejects weak passwords failing complexity rules (< 8 chars or missing numbers)', () => {
    const user = db.prepare("SELECT id FROM users WHERE email = 'dev@nexus.com'").get() as { id: string };
    
    expect(() => {
      AuthService.changePassword(user.id, 'Password123!', 'short');
    }).toThrow('New password must be at least 8 characters long.');

    expect(() => {
      AuthService.changePassword(user.id, 'Password123!', 'allalphabetpassword');
    }).toThrow('New password must contain both alphanumeric letters and at least one number.');
  });

  it('successfully changes password with valid credentials and complexity rules', () => {
    const user = db.prepare("SELECT id FROM users WHERE email = 'dev@nexus.com'").get() as { id: string };
    
    AuthService.changePassword(user.id, 'Password123!', 'NewSecurePass2026!');

    // Old password no longer works
    expect(() => {
      AuthService.login('dev@nexus.com', 'Password123!');
    }).toThrow('Invalid email or password.');

    // New password works
    const newLogin = AuthService.login('dev@nexus.com', 'NewSecurePass2026!');
    expect(newLogin.token).toBeDefined();

    // Reset back for subsequent test suites
    AuthService.changePassword(user.id, 'NewSecurePass2026!', 'Password123!');
  });

  it('locks user account after 5 consecutive failed attempts and unlocks via admin', () => {
    const targetUser = db.prepare("SELECT id FROM users WHERE email = 'manager@nexus.com'").get() as { id: string };

    for (let i = 0; i < 5; i++) {
      try {
        AuthService.login('manager@nexus.com', 'WrongAttempt!');
      } catch (e) {
        // expected
      }
    }

    // 6th attempt should be blocked by lock
    expect(() => {
      AuthService.login('manager@nexus.com', 'Password123!');
    }).toThrow(/Account is temporarily locked/);

    // Admin unlocks user
    const admin = db.prepare("SELECT id FROM users WHERE email = 'admin@nexus.com'").get() as { id: string };
    AuthService.unlockUser(targetUser.id, admin.id);

    // User can login immediately now
    const validLogin = AuthService.login('manager@nexus.com', 'Password123!');
    expect(validLogin.token).toBeDefined();
  });

  it('prevents Line Manager BOLA: line manager cannot approve leave for an employee outside their department', () => {
    // Line Manager of Engineering dept (manager@nexus.com)
    const managerUser = db.prepare("SELECT id FROM users WHERE email = 'manager@nexus.com'").get() as { id: string };
    const managerEmp = db.prepare("SELECT id, department_id FROM employees WHERE user_id = ?").get(managerUser.id) as { id: string; department_id: string };
    
    // HR Employee belongs to HR Dept (EMP-0001)
    const hrEmp = db.prepare("SELECT id FROM employees WHERE employee_code = 'EMP-0001'").get() as { id: string };
    const annualType = db.prepare("SELECT id FROM leave_types WHERE code = 'ANNUAL'").get() as { id: string };

    const application = LeaveService.apply({
      employeeId: hrEmp.id,
      leaveTypeId: annualType.id,
      startDate: '2026-12-01',
      endDate: '2026-12-02',
      totalDays: 2,
      reason: 'BOLA security verification test',
    });

    // Engineering Line Manager tries to review HR employee's leave
    expect(() => {
      LeaveService.review({
        applicationId: application.id,
        decision: 'APPROVE',
        reviewerUserId: managerUser.id,
        reviewerRole: 'LINE_MANAGER',
        reviewerEmployeeId: managerEmp.id,
        reviewerDepartmentId: managerEmp.department_id,
      });
    }).toThrow('Line Managers can only review leave requests for subordinates in their department.');
  });
});
