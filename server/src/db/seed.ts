import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from './database.js';
import { initializeDatabase } from './init.js';

export function seedDatabase(): void {
  initializeDatabase();

  console.log('[SEED] Starting realistic enterprise seed data...');

  const passwordHash = bcrypt.hashSync('Password123!', 10);

  // Clean existing data for clean re-seeding
  db.exec('DELETE FROM payslips;');
  db.exec('DELETE FROM payroll_batches;');
  db.exec('DELETE FROM leave_applications;');
  db.exec('DELETE FROM leave_balances;');
  db.exec('DELETE FROM leave_types;');
  db.exec('DELETE FROM attendance;');
  db.exec('DELETE FROM employees;');
  db.exec('DELETE FROM designations;');
  db.exec('DELETE FROM departments;');
  db.exec('DELETE FROM audit_logs;');
  db.exec('DELETE FROM users;');

  // 1. Seed Users
  const userAdminId = uuidv4();
  const userHrId = uuidv4();
  const userManagerId = uuidv4();
  const userEmp1Id = uuidv4();
  const userEmp2Id = uuidv4();

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, role, is_active)
    VALUES (?, ?, ?, ?, 1)
  `);

  insertUser.run(userAdminId, 'admin@nexus.com', passwordHash, 'SUPER_ADMIN');
  insertUser.run(userHrId, 'hr@nexus.com', passwordHash, 'HR_MANAGER');
  insertUser.run(userManagerId, 'manager@nexus.com', passwordHash, 'LINE_MANAGER');
  insertUser.run(userEmp1Id, 'dev@nexus.com', passwordHash, 'EMPLOYEE');
  insertUser.run(userEmp2Id, 'kasun@nexus.com', passwordHash, 'EMPLOYEE');

  // 2. Seed Departments
  const deptEngId = uuidv4();
  const deptHrId = uuidv4();
  const deptFinId = uuidv4();

  const insertDept = db.prepare(`
    INSERT INTO departments (id, name, code, description)
    VALUES (?, ?, ?, ?)
  `);

  insertDept.run(deptEngId, 'Engineering & Technology', 'ENG', 'Core platform development, cloud architecture, and security.');
  insertDept.run(deptHrId, 'Human Resources & People', 'HR', 'Talent acquisition, organizational culture, and legal compliance.');
  insertDept.run(deptFinId, 'Finance & Accounting', 'FIN', 'Corporate payroll, statutory filings, and treasury.');

  // 3. Seed Designations
  const desLeadId = uuidv4();
  const desSeniorDevId = uuidv4();
  const desHrExecId = uuidv4();

  const insertDes = db.prepare(`
    INSERT INTO designations (id, department_id, title, grade_level)
    VALUES (?, ?, ?, ?)
  `);

  insertDes.run(desLeadId, deptEngId, 'Lead Systems Architect', 5);
  insertDes.run(desSeniorDevId, deptEngId, 'Senior Full-Stack Engineer', 4);
  insertDes.run(desHrExecId, deptHrId, 'People Operations Specialist', 3);

  // 4. Seed Employees
  const empManagerId = uuidv4();
  const empDevId = uuidv4();
  const empKasunId = uuidv4();
  const empHrId = uuidv4();

  const insertEmp = db.prepare(`
    INSERT INTO employees (
      id, user_id, employee_code, first_name, last_name, nic_passport,
      gender, date_of_birth, phone, emergency_contact_name, emergency_contact_phone,
      department_id, designation_id, manager_id, employment_status, hire_date,
      base_salary_cents, bank_name, bank_account_number, bank_branch_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // HR Lead
  insertEmp.run(
    empHrId, userHrId, 'EMP-0001', 'Dilani', 'Perera', '198854300123',
    'FEMALE', '1988-06-15', '+94 77 123 4567', 'Sunil Perera', '+94 71 987 6543',
    deptHrId, desHrExecId, null, 'ACTIVE', '2021-03-01',
    35000000, 'Commercial Bank of Ceylon', '1002345678', '045'
  );

  // Engineering Manager (Line Manager)
  insertEmp.run(
    empManagerId, userManagerId, 'EMP-0002', 'Nuwan', 'Jayawardena', '198512300456',
    'MALE', '1985-11-20', '+94 77 234 5678', 'Anoma Jayawardena', '+94 70 876 5432',
    deptEngId, desLeadId, null, 'ACTIVE', '2020-01-15',
    55000000, 'Sampath Bank', '0012903847', '012'
  );

  // Senior Developer (Reports to Nuwan)
  insertEmp.run(
    empDevId, userEmp1Id, 'EMP-0003', 'Sahan', 'Wickramasinghe', '199520400789',
    'MALE', '1995-04-10', '+94 77 345 6789', 'Manoji Wickramasinghe', '+94 76 543 2109',
    deptEngId, desSeniorDevId, empManagerId, 'ACTIVE', '2022-06-01',
    38000000, 'Hatton National Bank', '0894029384', '005'
  );

  // Developer 2 (Reports to Nuwan)
  insertEmp.run(
    empKasunId, userEmp2Id, 'EMP-0004', 'Kasun', 'Bandara', '199730200321',
    'MALE', '1997-09-25', '+94 77 456 7890', 'Nimal Bandara', '+94 75 123 9876',
    deptEngId, desSeniorDevId, empManagerId, 'PROBATION', '2024-02-01',
    24000000, 'Commercial Bank of Ceylon', '1009876543', '045'
  );

  // 5. Seed Leave Types
  const ltAnnualId = uuidv4();
  const ltCasualId = uuidv4();
  const ltMedicalId = uuidv4();
  const ltUnpaidId = uuidv4();

  const insertLeaveType = db.prepare(`
    INSERT INTO leave_types (id, code, name, annual_entitlement, is_paid)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertLeaveType.run(ltAnnualId, 'ANNUAL', 'Annual Vacation Leave', 14, 1);
  insertLeaveType.run(ltCasualId, 'CASUAL', 'Casual / Personal Leave', 7, 1);
  insertLeaveType.run(ltMedicalId, 'MEDICAL', 'Medical & Hospitalization', 14, 1);
  insertLeaveType.run(ltUnpaidId, 'UNPAID', 'Unpaid Leave (No-Pay)', 0, 0);

  // 6. Seed Leave Balances for 2026
  const insertBalance = db.prepare(`
    INSERT INTO leave_balances (id, employee_id, leave_type_id, year, entitled_days, used_days, pending_days, remaining_days)
    VALUES (?, ?, ?, 2026, ?, ?, ?, ?)
  `);

  for (const emp of [empHrId, empManagerId, empDevId, empKasunId]) {
    insertBalance.run(uuidv4(), emp, ltAnnualId, 14.0, 2.0, 1.0, 11.0);
    insertBalance.run(uuidv4(), emp, ltCasualId, 7.0, 1.0, 0.0, 6.0);
    insertBalance.run(uuidv4(), emp, ltMedicalId, 14.0, 0.0, 0.0, 14.0);
  }

  // 7. Seed Pending Leave Application for Sahan
  const insertLeaveApp = db.prepare(`
    INSERT INTO leave_applications (
      id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertLeaveApp.run(
    uuidv4(), empDevId, ltAnnualId, '2026-11-10', '2026-11-10', 1.0,
    'Attending family ceremony in Kandy.', 'PENDING'
  );

  // 8. Seed Attendance Records for Today
  const todayStr = new Date().toISOString().split('T')[0];
  const insertAttendance = db.prepare(`
    INSERT INTO attendance (
      id, employee_id, date, clock_in_time, clock_out_time, status, work_mode, ip_address, total_worked_minutes, ot_minutes, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAttendance.run(
    uuidv4(), empManagerId, todayStr, `${todayStr}T08:25:00.000Z`, null, 'PRESENT', 'ON_SITE', '192.168.1.101', 0, 0, 'On-site Office'
  );
  insertAttendance.run(
    uuidv4(), empDevId, todayStr, `${todayStr}T08:42:00.000Z`, null, 'LATE', 'REMOTE', '124.43.15.62', 0, 0, 'Remote VPN Check-in (Late by 12 mins)'
  );
  insertAttendance.run(
    uuidv4(), empHrId, todayStr, `${todayStr}T08:15:00.000Z`, null, 'PRESENT', 'ON_SITE', '192.168.1.105', 0, 0, 'On-site HR Dept'
  );

  // 9. Seed Sample Processed Payroll Batch (October 2026)
  const batchId = uuidv4();
  const insertBatch = db.prepare(`
    INSERT INTO payroll_batches (
      id, month, status, total_gross_cents, total_net_cents, total_epf_cents, created_by_user_id, paid_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertBatch.run(
    batchId, '2026-10', 'PAID', 152000000, 131800000, 30400000, userAdminId, '2026-10-28T10:00:00.000Z'
  );

  // Seed sample payslip for Sahan (Dev)
  // Base: 380,000 LKR (38000000 cents)
  // Allowance: 20,000 LKR (2000000 cents)
  // Gross: 400,000 LKR (40000000 cents)
  // EPF Employee (8% of Base): 30,400 LKR (3040000 cents)
  // EPF Employer (12% of Base): 45,600 LKR (4560000 cents)
  // ETF Employer (3% of Base): 11,400 LKR (1140000 cents)
  // APIT Tax (approx): 25,000 LKR (2500000 cents)
  // Net Salary: 400,000 - 30,400 - 25,000 = 344,600 LKR (34460000 cents)
  const insertPayslip = db.prepare(`
    INSERT INTO payslips (
      id, batch_id, employee_id, base_salary_cents, allowances_cents, overtime_pay_cents,
      unpaid_leave_deductions_cents, gross_salary_cents, employee_epf_cents, employer_epf_cents,
      employer_etf_cents, apit_tax_cents, other_deductions_cents, net_salary_cents, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID')
  `);

  insertPayslip.run(
    uuidv4(), batchId, empDevId,
    38000000, 2000000, 0, 0, 40000000,
    3040000, 4560000, 1140000,
    2500000, 0, 34460000
  );

  // 10. Audit Log Initial Entry
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value_json, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertAudit.run(
    uuidv4(), userAdminId, 'SYSTEM_INITIALIZATION', 'SYSTEM', 'ROOT',
    JSON.stringify({ message: 'Nexus HRMS database seeded with enterprise baseline.' }), '127.0.0.1'
  );

  console.log('[SEED] Enterprise seed finished successfully!');
}

// Direct execution support
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  try {
    seedDatabase();
    console.log('[SEED] Ready to run.');
  } catch (error) {
    console.error('[SEED] Seeding failed:', error);
    process.exit(1);
  }
}
