import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { EmployeeRow, UserRole } from '../types/index.js';
import { AuditService } from './audit.service.js';

export class EmployeeService {
  public static list(options?: {
    departmentId?: string;
    managerId?: string;
    status?: string;
    search?: string;
  }): EmployeeRow[] {
    let sql = `
      SELECT 
        e.*,
        u.email,
        d.name as department_name,
        des.title as designation_title,
        (m.first_name || ' ' || m.last_name) as manager_name
      FROM employees e
      JOIN users u ON e.user_id = u.id
      JOIN departments d ON e.department_id = d.id
      JOIN designations des ON e.designation_id = des.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (options?.departmentId) {
      sql += ' AND e.department_id = ?';
      params.push(options.departmentId);
    }
    if (options?.managerId) {
      sql += ' AND e.manager_id = ?';
      params.push(options.managerId);
    }
    if (options?.status) {
      sql += ' AND e.employment_status = ?';
      params.push(options.status);
    }
    if (options?.search) {
      sql += ' AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.employee_code LIKE ? OR u.email LIKE ?)';
      const term = `%${options.search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY e.employee_code ASC';
    const stmt = db.prepare(sql);
    return stmt.all(...params) as unknown as EmployeeRow[];
  }

  public static getById(id: string): EmployeeRow | null {
    const stmt = db.prepare(`
      SELECT 
        e.*,
        u.email,
        u.role,
        d.name as department_name,
        des.title as designation_title,
        (m.first_name || ' ' || m.last_name) as manager_name
      FROM employees e
      JOIN users u ON e.user_id = u.id
      JOIN departments d ON e.department_id = d.id
      JOIN designations des ON e.designation_id = des.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE e.id = ?
    `);
    const result = stmt.get(id);
    return (result as unknown as EmployeeRow) || null;
  }

  public static create(
    data: {
      email: string;
      passwordPlain: string;
      role: UserRole;
      employeeCode: string;
      firstName: string;
      lastName: string;
      nicPassport: string;
      gender: 'MALE' | 'FEMALE' | 'OTHER';
      dateOfBirth: string;
      phone: string;
      emergencyContactName: string;
      emergencyContactPhone: string;
      departmentId: string;
      designationId: string;
      managerId?: string | null;
      employmentStatus?: 'ACTIVE' | 'PROBATION';
      hireDate: string;
      baseSalaryCents: number;
      bankName: string;
      bankAccountNumber: string;
      bankBranchCode: string;
    },
    creatorUserId?: string
  ): EmployeeRow {
    // Execute inside atomic transaction
    db.exec('BEGIN IMMEDIATE;');
    try {
      // 1. Verify uniqueness
      const checkCode = db.prepare('SELECT id FROM employees WHERE employee_code = ?').get(data.employeeCode);
      if (checkCode) throw new Error(`Employee code '${data.employeeCode}' already exists.`);

      const checkEmail = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(data.email);
      if (checkEmail) throw new Error(`User email '${data.email}' already exists.`);

      // 2. Create User Login
      const userId = uuidv4();
      const passwordHash = bcrypt.hashSync(data.passwordPlain, 10);
      db.prepare(`
        INSERT INTO users (id, email, password_hash, role, is_active)
        VALUES (?, ?, ?, ?, 1)
      `).run(userId, data.email, passwordHash, data.role);

      // 3. Create Employee Profile
      const empId = uuidv4();
      db.prepare(`
        INSERT INTO employees (
          id, user_id, employee_code, first_name, last_name, nic_passport,
          gender, date_of_birth, phone, emergency_contact_name, emergency_contact_phone,
          department_id, designation_id, manager_id, employment_status, hire_date,
          base_salary_cents, bank_name, bank_account_number, bank_branch_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        empId,
        userId,
        data.employeeCode,
        data.firstName,
        data.lastName,
        data.nicPassport,
        data.gender,
        data.dateOfBirth,
        data.phone,
        data.emergencyContactName,
        data.emergencyContactPhone,
        data.departmentId,
        data.designationId,
        data.managerId || null,
        data.employmentStatus || 'ACTIVE',
        data.hireDate,
        data.baseSalaryCents,
        data.bankName,
        data.bankAccountNumber,
        data.bankBranchCode
      );

      // 4. Seed Default Leave Balances for Current Year
      const currentYear = new Date().getFullYear();
      const leaveTypes = db.prepare('SELECT id, annual_entitlement FROM leave_types').all() as Array<{
        id: string;
        annual_entitlement: number;
      }>;

      const insertBalance = db.prepare(`
        INSERT INTO leave_balances (id, employee_id, leave_type_id, year, entitled_days, used_days, pending_days, remaining_days)
        VALUES (?, ?, ?, ?, ?, 0.0, 0.0, ?)
      `);

      for (const lt of leaveTypes) {
        insertBalance.run(uuidv4(), empId, lt.id, currentYear, lt.annual_entitlement, lt.annual_entitlement);
      }

      db.exec('COMMIT;');

      AuditService.log({
        userId: creatorUserId,
        action: 'CREATE_EMPLOYEE',
        entityType: 'EMPLOYEE',
        entityId: empId,
        newValue: { employeeCode: data.employeeCode, email: data.email },
      });

      return this.getById(empId)!;
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  public static update(
    id: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      phone: string;
      emergencyContactName: string;
      emergencyContactPhone: string;
      departmentId: string;
      designationId: string;
      managerId: string | null;
      baseSalaryCents: number;
      bankName: string;
      bankAccountNumber: string;
      bankBranchCode: string;
    }>,
    updaterUserId?: string
  ): EmployeeRow {
    const current = this.getById(id);
    if (!current) throw new Error('Employee not found.');

    const fields: string[] = [];
    const values: any[] = [];

    if (data.firstName !== undefined) { fields.push('first_name = ?'); values.push(data.firstName); }
    if (data.lastName !== undefined) { fields.push('last_name = ?'); values.push(data.lastName); }
    if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
    if (data.emergencyContactName !== undefined) { fields.push('emergency_contact_name = ?'); values.push(data.emergencyContactName); }
    if (data.emergencyContactPhone !== undefined) { fields.push('emergency_contact_phone = ?'); values.push(data.emergencyContactPhone); }
    if (data.departmentId !== undefined) { fields.push('department_id = ?'); values.push(data.departmentId); }
    if (data.designationId !== undefined) { fields.push('designation_id = ?'); values.push(data.designationId); }
    if (data.managerId !== undefined) { fields.push('manager_id = ?'); values.push(data.managerId); }
    if (data.baseSalaryCents !== undefined) { fields.push('base_salary_cents = ?'); values.push(data.baseSalaryCents); }
    if (data.bankName !== undefined) { fields.push('bank_name = ?'); values.push(data.bankName); }
    if (data.bankAccountNumber !== undefined) { fields.push('bank_account_number = ?'); values.push(data.bankAccountNumber); }
    if (data.bankBranchCode !== undefined) { fields.push('bank_branch_code = ?'); values.push(data.bankBranchCode); }

    if (fields.length === 0) return current;

    fields.push("updated_at = datetime('now')");
    values.push(id);

    const sql = `UPDATE employees SET ${fields.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...values);

    AuditService.log({
      userId: updaterUserId,
      action: 'UPDATE_EMPLOYEE',
      entityType: 'EMPLOYEE',
      entityId: id,
      oldValue: { baseSalaryCents: current.base_salary_cents, departmentId: current.department_id },
      newValue: data,
    });

    return this.getById(id)!;
  }

  public static updateStatus(
    id: string,
    status: 'ACTIVE' | 'PROBATION' | 'SUSPENDED' | 'TERMINATED',
    actorUserId?: string
  ): EmployeeRow {
    const current = this.getById(id);
    if (!current) throw new Error('Employee not found.');

    db.exec('BEGIN IMMEDIATE;');
    try {
      db.prepare("UPDATE employees SET employment_status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);

      // If terminated or suspended, deactivate user authentication immediately
      if (status === 'TERMINATED' || status === 'SUSPENDED') {
        db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(current.user_id);
        // Cancel all pending future leaves
        db.prepare("UPDATE leave_applications SET status = 'CANCELLED' WHERE employee_id = ? AND status = 'PENDING'").run(id);
      } else if (status === 'ACTIVE') {
        db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(current.user_id);
      }

      db.exec('COMMIT;');

      AuditService.log({
        userId: actorUserId,
        action: `EMPLOYEE_STATUS_${status}`,
        entityType: 'EMPLOYEE',
        entityId: id,
        oldValue: { status: current.employment_status },
        newValue: { status },
      });

      return this.getById(id)!;
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  public static getDepartments() {
    return db.prepare('SELECT * FROM departments ORDER BY name ASC').all();
  }

  public static getDesignations() {
    return db.prepare(`
      SELECT des.*, d.name as department_name 
      FROM designations des 
      JOIN departments d ON des.department_id = d.id 
      ORDER BY des.grade_level DESC, des.title ASC
    `).all();
  }
}
