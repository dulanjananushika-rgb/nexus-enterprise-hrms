import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { AuthUser, UserRow, EmployeeRow } from '../types/index.js';
import { AuditService } from './audit.service.js';

export class AuthService {
  public static login(email: string, passwordPlain: string, ipAddress?: string): { token: string; user: AuthUser } {
    const userStmt = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE');
    const user = userStmt.get(email) as UserRow | undefined;

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    // Check account lockout
    if (user.locked_until) {
      const lockExpiry = new Date(user.locked_until).getTime();
      if (Date.now() < lockExpiry) {
        const remainingMinutes = Math.ceil((lockExpiry - Date.now()) / (1000 * 60));
        throw new Error(`Account is temporarily locked due to multiple failed attempts. Please retry in ${remainingMinutes} minute(s).`);
      } else {
        // Unlock expired lock
        db.prepare('UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE id = ?').run(user.id);
      }
    }

    if (user.is_active !== 1) {
      throw new Error('Account has been deactivated. Please contact HR administration.');
    }

    // Verify password
    const isPasswordValid = bcrypt.compareSync(passwordPlain, user.password_hash);
    if (!isPasswordValid) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      let lockedUntil: string | null = null;
      if (attempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }

      db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?').run(attempts, lockedUntil, user.id);

      AuditService.log({
        userId: user.id,
        action: 'FAILED_LOGIN_ATTEMPT',
        entityType: 'USER',
        entityId: user.id,
        ipAddress,
        newValue: { attempts },
      });

      throw new Error(attempts >= 5 ? 'Account locked for 15 minutes due to 5 failed attempts.' : 'Invalid email or password.');
    }

    // Reset failed attempts on success
    db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);

    // Look up associated employee record
    const empStmt = db.prepare('SELECT id, department_id FROM employees WHERE user_id = ?');
    const emp = empStmt.get(user.id) as Pick<EmployeeRow, 'id' | 'department_id'> | undefined;

    const authPayload: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: emp?.id,
      departmentId: emp?.department_id,
    };

    const token = jwt.sign(authPayload, JWT_SECRET, { expiresIn: '8h' });

    AuditService.log({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'USER',
      entityId: user.id,
      ipAddress,
    });

    return { token, user: authPayload };
  }

  public static changePassword(
    userId: string,
    oldPasswordPlain: string,
    newPasswordPlain: string,
    ipAddress?: string
  ): void {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
    if (!user) throw new Error('User not found.');

    const isOldValid = bcrypt.compareSync(oldPasswordPlain, user.password_hash);
    if (!isOldValid) {
      throw new Error('Current password does not match records.');
    }

    if (newPasswordPlain.length < 8) {
      throw new Error('New password must be at least 8 characters long.');
    }
    if (!/[A-Za-z]/.test(newPasswordPlain) || !/[0-9]/.test(newPasswordPlain)) {
      throw new Error('New password must contain both alphanumeric letters and at least one number.');
    }

    const newHash = bcrypt.hashSync(newPasswordPlain, 10);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(newHash, userId);

    AuditService.log({
      userId,
      action: 'PASSWORD_CHANGED',
      entityType: 'USER',
      entityId: userId,
      ipAddress,
    });
  }

  public static unlockUser(targetUserId: string, adminUserId: string, ipAddress?: string): void {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId) as UserRow | undefined;
    if (!user) throw new Error('Target user not found.');

    db.prepare("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?").run(
      targetUserId
    );

    AuditService.log({
      userId: adminUserId,
      action: 'USER_ACCOUNT_UNLOCKED',
      entityType: 'USER',
      entityId: targetUserId,
      ipAddress,
      newValue: { targetEmail: user.email },
    });
  }

  public static getProfile(userId: string) {
    const stmt = db.prepare(`
      SELECT 
        u.id as user_id, u.email, u.role, u.is_active,
        e.id as employee_id, e.employee_code, e.first_name, e.last_name,
        e.nic_passport, e.gender, e.phone, e.emergency_contact_name, e.emergency_contact_phone,
        e.hire_date, e.employment_status,
        e.base_salary_cents, e.bank_name, e.bank_account_number, e.bank_branch_code,
        d.name as department_name, d.code as department_code,
        des.title as designation_title
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE u.id = ?
    `);

    const result = stmt.get(userId);
    if (!result) throw new Error('User not found.');
    return result;
  }
}
