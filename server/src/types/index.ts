export type UserRole = 'SUPER_ADMIN' | 'HR_MANAGER' | 'LINE_MANAGER' | 'EMPLOYEE';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  departmentId?: string;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: number;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeRow {
  id: string;
  user_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  nic_passport: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  date_of_birth: string;
  phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  department_id: string;
  department_name?: string;
  designation_id: string;
  designation_title?: string;
  manager_id: string | null;
  manager_name?: string;
  employment_status: 'ACTIVE' | 'PROBATION' | 'SUSPENDED' | 'TERMINATED';
  hire_date: string;
  base_salary_cents: number;
  bank_name: string;
  bank_account_number: string;
  bank_branch_code: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRow {
  id: string;
  employee_id: string;
  employee_name?: string;
  date: string;
  clock_in_time: string;
  clock_out_time: string | null;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ON_LEAVE' | 'ABSENT';
  work_mode: 'ON_SITE' | 'REMOTE';
  ip_address: string | null;
  total_worked_minutes: number;
  ot_minutes: number;
  notes: string | null;
  created_at: string;
}

export interface LeaveApplicationRow {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  leave_type_id: string;
  leave_type_name?: string;
  leave_type_code?: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: 'PENDING' | 'APPROVED_MANAGER' | 'APPROVED_HR' | 'REJECTED' | 'CANCELLED';
  reviewed_by_user_id: string | null;
  rejection_reason: string | null;
  attachment_name?: string | null;
  attachment_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveBalanceRow {
  id: string;
  employee_id: string;
  leave_type_id: string;
  leave_type_name?: string;
  leave_type_code?: string;
  year: number;
  entitled_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
}

export interface PayrollBatchRow {
  id: string;
  month: string;
  status: 'DRAFT' | 'REVIEWED' | 'PAID' | 'CANCELLED';
  total_gross_cents: number;
  total_net_cents: number;
  total_epf_cents: number;
  created_by_user_id: string;
  paid_at: string | null;
  created_at: string;
}

export interface PayslipRow {
  id: string;
  batch_id: string;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  base_salary_cents: number;
  allowances_cents: number;
  overtime_pay_cents: number;
  unpaid_leave_deductions_cents: number;
  gross_salary_cents: number;
  employee_epf_cents: number;
  employer_epf_cents: number;
  employer_etf_cents: number;
  apit_tax_cents: number;
  other_deductions_cents: number;
  net_salary_cents: number;
  status: 'GENERATED' | 'SENT' | 'PAID';
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  user_email?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value_json: string | null;
  new_value_json: string | null;
  ip_address: string | null;
  created_at: string;
}

export type DocumentCategory = 'NIC_PASSPORT' | 'APPOINTMENT_LETTER' | 'CV' | 'MEDICAL_SLIP' | 'CERTIFICATE' | 'OTHER';

export interface DocumentRow {
  id: string;
  employee_id: string;
  title: string;
  category: DocumentCategory;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  mime_type: string;
  uploaded_by_user_id: string;
  notes: string | null;
  created_at: string;
  employee_name?: string;
}

export interface GratuityProvisionRow {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  hireDate: string;
  yearsOfService: number;
  isVested: boolean;
  baseSalaryCents: number;
  monthlySalaryLkr: number;
  statutoryGratuityLiabilityCents: number;
  accruedLkas19ReserveCents: number;
}

export interface GratuitySummaryReport {
  records: GratuityProvisionRow[];
  totals: {
    totalEmployees: number;
    vestedEmployees: number;
    unvestedEmployees: number;
    totalStatutoryLiabilityCents: number;
    totalLkas19ReserveCents: number;
    averageTenureYears: number;
  };
}

