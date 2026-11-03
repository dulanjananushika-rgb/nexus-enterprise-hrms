-- NEXUS HRMS SCHEMA DDL
-- Enforces Foreign Keys, Relational Integrity, and Indexes

PRAGMA foreign_keys = ON;

-- 1. Users & Credentials
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('SUPER_ADMIN', 'HR_MANAGER', 'LINE_MANAGER', 'EMPLOYEE')),
    is_active INTEGER NOT NULL DEFAULT 1,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Departments
CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Designations
CREATE TABLE IF NOT EXISTS designations (
    id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL,
    title TEXT NOT NULL,
    grade_level INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(department_id) REFERENCES departments(id) ON DELETE RESTRICT
);

-- 4. Employees Master (PIM)
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    employee_code TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    nic_passport TEXT UNIQUE NOT NULL,
    gender TEXT NOT NULL CHECK(gender IN ('MALE', 'FEMALE', 'OTHER')),
    date_of_birth TEXT NOT NULL,
    phone TEXT NOT NULL,
    emergency_contact_name TEXT NOT NULL,
    emergency_contact_phone TEXT NOT NULL,
    department_id TEXT NOT NULL,
    designation_id TEXT NOT NULL,
    manager_id TEXT,
    employment_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(employment_status IN ('ACTIVE', 'PROBATION', 'SUSPENDED', 'TERMINATED')),
    hire_date TEXT NOT NULL,
    base_salary_cents INTEGER NOT NULL CHECK(base_salary_cents >= 0),
    bank_name TEXT NOT NULL,
    bank_account_number TEXT NOT NULL,
    bank_branch_code TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(department_id) REFERENCES departments(id) ON DELETE RESTRICT,
    FOREIGN KEY(designation_id) REFERENCES designations(id) ON DELETE RESTRICT,
    FOREIGN KEY(manager_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employees_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);

-- 5. Time & Attendance
CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    date TEXT NOT NULL,
    clock_in_time TEXT NOT NULL,
    clock_out_time TEXT,
    status TEXT NOT NULL CHECK(status IN ('PRESENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'ABSENT')),
    work_mode TEXT NOT NULL DEFAULT 'ON_SITE' CHECK(work_mode IN ('ON_SITE', 'REMOTE')),
    ip_address TEXT,
    total_worked_minutes INTEGER NOT NULL DEFAULT 0,
    ot_minutes INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_id, date);

-- 6. Leave Types & Allocations
CREATE TABLE IF NOT EXISTS leave_types (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    annual_entitlement INTEGER NOT NULL DEFAULT 14,
    is_paid INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS leave_balances (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    leave_type_id TEXT NOT NULL,
    year INTEGER NOT NULL,
    entitled_days REAL NOT NULL DEFAULT 14.0,
    used_days REAL NOT NULL DEFAULT 0.0,
    pending_days REAL NOT NULL DEFAULT 0.0,
    remaining_days REAL NOT NULL DEFAULT 14.0,
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY(leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT,
    UNIQUE(employee_id, leave_type_id, year)
);

CREATE TABLE IF NOT EXISTS leave_applications (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    leave_type_id TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    total_days REAL NOT NULL CHECK(total_days > 0),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED_MANAGER', 'APPROVED_HR', 'REJECTED', 'CANCELLED')),
    reviewed_by_user_id TEXT,
    rejection_reason TEXT,
    attachment_name TEXT,
    attachment_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY(leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT,
    FOREIGN KEY(reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_leaves_emp ON leave_applications(employee_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leave_applications(status);

-- 7. Payroll Engine
CREATE TABLE IF NOT EXISTS payroll_batches (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL UNIQUE, -- YYYY-MM
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'REVIEWED', 'PAID', 'CANCELLED')),
    total_gross_cents INTEGER NOT NULL DEFAULT 0,
    total_net_cents INTEGER NOT NULL DEFAULT 0,
    total_epf_cents INTEGER NOT NULL DEFAULT 0,
    created_by_user_id TEXT NOT NULL,
    paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS payslips (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    base_salary_cents INTEGER NOT NULL,
    allowances_cents INTEGER NOT NULL DEFAULT 0,
    overtime_pay_cents INTEGER NOT NULL DEFAULT 0,
    unpaid_leave_deductions_cents INTEGER NOT NULL DEFAULT 0,
    gross_salary_cents INTEGER NOT NULL,
    employee_epf_cents INTEGER NOT NULL DEFAULT 0,
    employer_epf_cents INTEGER NOT NULL DEFAULT 0,
    employer_etf_cents INTEGER NOT NULL DEFAULT 0,
    apit_tax_cents INTEGER NOT NULL DEFAULT 0,
    other_deductions_cents INTEGER NOT NULL DEFAULT 0,
    net_salary_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'GENERATED' CHECK(status IN ('GENERATED', 'SENT', 'PAID')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(batch_id) REFERENCES payroll_batches(id) ON DELETE CASCADE,
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(batch_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_payslips_emp ON payslips(employee_id);

-- 8. Immutable Audit Trail
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_value_json TEXT,
    new_value_json TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- 9. Real-time In-App Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('LEAVE', 'PAYROLL', 'ATTENDANCE', 'SYSTEM')),
    link TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- 10. Employee Document Vault & Attachments
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('NIC_PASSPORT', 'APPOINTMENT_LETTER', 'CV', 'MEDICAL_SLIP', 'CERTIFICATE', 'OTHER')),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    uploaded_by_user_id TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY(uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_employee ON documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);


