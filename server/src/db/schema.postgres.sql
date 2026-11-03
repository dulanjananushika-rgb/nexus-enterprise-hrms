-- ==============================================================================
-- NEXUS ENTERPRISE HRMS — POSTGRESQL PRODUCTION SCHEMA DDL
-- Standardized for PostgreSQL 14, 15, and 16
-- Enforces Full ACID transactions, Relational Integrity, and B-Tree Indexes
-- ==============================================================================

-- 1. Users & Credentials
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK(role IN ('SUPER_ADMIN', 'HR_MANAGER', 'LINE_MANAGER', 'EMPLOYEE')),
    is_active SMALLINT NOT NULL DEFAULT 1,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pg_users_email ON users(LOWER(email));

-- 2. Departments
CREATE TABLE IF NOT EXISTS departments (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Designations
CREATE TABLE IF NOT EXISTS designations (
    id VARCHAR(36) PRIMARY KEY,
    department_id VARCHAR(36) NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    title VARCHAR(100) NOT NULL,
    grade_level INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pg_designations_dept ON designations(department_id);

-- 4. Employees Master (PIM)
CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    nic_passport VARCHAR(50) UNIQUE NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK(gender IN ('MALE', 'FEMALE', 'OTHER')),
    date_of_birth DATE NOT NULL,
    phone VARCHAR(30) NOT NULL,
    emergency_contact_name VARCHAR(100) NOT NULL,
    emergency_contact_phone VARCHAR(30) NOT NULL,
    department_id VARCHAR(36) NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    designation_id VARCHAR(36) NOT NULL REFERENCES designations(id) ON DELETE RESTRICT,
    manager_id VARCHAR(36) REFERENCES employees(id) ON DELETE SET NULL,
    employment_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK(employment_status IN ('ACTIVE', 'PROBATION', 'SUSPENDED', 'TERMINATED')),
    hire_date DATE NOT NULL,
    base_salary_cents BIGINT NOT NULL CHECK(base_salary_cents >= 0),
    bank_name VARCHAR(100) NOT NULL,
    bank_account_number VARCHAR(50) NOT NULL,
    bank_branch_code VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pg_employees_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_pg_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_pg_employees_manager ON employees(manager_id);

-- 5. Time & Attendance
CREATE TABLE IF NOT EXISTS attendance (
    id VARCHAR(36) PRIMARY KEY,
    employee_id VARCHAR(36) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    clock_in_time TIMESTAMPTZ NOT NULL,
    clock_out_time TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL CHECK(status IN ('PRESENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'ABSENT')),
    work_mode VARCHAR(20) NOT NULL DEFAULT 'ON_SITE' CHECK(work_mode IN ('ON_SITE', 'REMOTE')),
    ip_address VARCHAR(50),
    total_worked_minutes INT NOT NULL DEFAULT 0,
    ot_minutes INT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_pg_attendance_emp_date UNIQUE(employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_pg_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_pg_attendance_emp_date ON attendance(employee_id, date);

-- 6. Leave Types & Allocations
CREATE TABLE IF NOT EXISTS leave_types (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    annual_entitlement INT NOT NULL DEFAULT 14,
    is_paid SMALLINT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS leave_balances (
    id VARCHAR(36) PRIMARY KEY,
    employee_id VARCHAR(36) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id VARCHAR(36) NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
    year INT NOT NULL,
    entitled_days NUMERIC(4, 1) NOT NULL DEFAULT 14.0,
    used_days NUMERIC(4, 1) NOT NULL DEFAULT 0.0,
    pending_days NUMERIC(4, 1) NOT NULL DEFAULT 0.0,
    remaining_days NUMERIC(4, 1) NOT NULL DEFAULT 14.0,
    CONSTRAINT uq_pg_leave_balance UNIQUE(employee_id, leave_type_id, year)
);

CREATE TABLE IF NOT EXISTS leave_applications (
    id VARCHAR(36) PRIMARY KEY,
    employee_id VARCHAR(36) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id VARCHAR(36) NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days NUMERIC(4, 1) NOT NULL CHECK(total_days > 0),
    reason TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED_MANAGER', 'APPROVED_HR', 'REJECTED', 'CANCELLED')),
    reviewed_by_user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    attachment_name VARCHAR(255),
    attachment_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pg_leaves_emp ON leave_applications(employee_id);
CREATE INDEX IF NOT EXISTS idx_pg_leaves_status ON leave_applications(status);

-- 7. Payroll Engine
CREATE TABLE IF NOT EXISTS payroll_batches (
    id VARCHAR(36) PRIMARY KEY,
    month VARCHAR(7) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'REVIEWED', 'PAID', 'CANCELLED')),
    total_gross_cents BIGINT NOT NULL DEFAULT 0,
    total_net_cents BIGINT NOT NULL DEFAULT 0,
    total_epf_cents BIGINT NOT NULL DEFAULT 0,
    created_by_user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payslips (
    id VARCHAR(36) PRIMARY KEY,
    batch_id VARCHAR(36) NOT NULL REFERENCES payroll_batches(id) ON DELETE CASCADE,
    employee_id VARCHAR(36) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    base_salary_cents BIGINT NOT NULL,
    allowances_cents BIGINT NOT NULL DEFAULT 0,
    overtime_pay_cents BIGINT NOT NULL DEFAULT 0,
    unpaid_leave_deductions_cents BIGINT NOT NULL DEFAULT 0,
    gross_salary_cents BIGINT NOT NULL,
    employee_epf_cents BIGINT NOT NULL DEFAULT 0,
    employer_epf_cents BIGINT NOT NULL DEFAULT 0,
    employer_etf_cents BIGINT NOT NULL DEFAULT 0,
    apit_tax_cents BIGINT NOT NULL DEFAULT 0,
    other_deductions_cents BIGINT NOT NULL DEFAULT 0,
    net_salary_cents BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'GENERATED' CHECK(status IN ('GENERATED', 'SENT', 'PAID')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_pg_payslips_batch_emp UNIQUE(batch_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_pg_payslips_emp ON payslips(employee_id);

-- 8. Immutable Audit Trail
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    old_value_json TEXT,
    new_value_json TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pg_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_pg_audit_entity ON audit_logs(entity_type, entity_id);

-- 9. Real-time In-App Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) NOT NULL CHECK(type IN ('LEAVE', 'PAYROLL', 'ATTENDANCE', 'SYSTEM')),
    link VARCHAR(255),
    is_read SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pg_notifications_user ON notifications(user_id, is_read);

-- 10. Employee Document Vault & Attachments
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(36) PRIMARY KEY,
    employee_id VARCHAR(36) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK(category IN ('NIC_PASSPORT', 'APPOINTMENT_LETTER', 'CV', 'MEDICAL_SLIP', 'CERTIFICATE', 'OTHER')),
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by_user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pg_documents_employee ON documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_pg_documents_category ON documents(category);
