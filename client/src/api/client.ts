import {
  User,
  Employee,
  Attendance,
  LeaveBalance,
  LeaveApplication,
  PayrollBatch,
  Payslip,
  AuditLog,
  DashboardSummary,
  AttendanceReportRow,
  LeaveReportRow,
  EpfEtfReport,
  AppNotification,
  EmployeeDocument,
  GratuitySummaryReport,
} from '../types';

const API_BASE = '/api';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('nexus_auth_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      if (response.status === 401) {
        // Clear token on authentication failure
        localStorage.removeItem('nexus_auth_token');
        localStorage.removeItem('nexus_auth_user');
      }
      throw new Error(data.error?.message || 'An unexpected API error occurred.');
    }

    return data.data;
  }

  // Auth
  async login(email: string, password: string):Promise<{ token: string; user: User }> {
    return this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getProfile(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async changePassword(oldPasswordPlain: string, newPasswordPlain: string): Promise<void> {
    return this.request<void>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPasswordPlain, newPasswordPlain }),
    });
  }

  async unlockUser(targetUserId: string): Promise<void> {
    return this.request<void>('/auth/unlock-user', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  }

  // Dashboard
  async getDashboardSummary(): Promise<DashboardSummary> {
    return this.request<DashboardSummary>('/dashboard/summary');
  }

  // Employees
  async getEmployees(params?: { departmentId?: string; search?: string; status?: string }): Promise<Employee[]> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<Employee[]>(`/employees${query ? `?${query}` : ''}`);
  }

  async getEmployeeById(id: string): Promise<Employee> {
    return this.request<Employee>(`/employees/${id}`);
  }

  async createEmployee(data: Record<string, any>): Promise<Employee> {
    return this.request<Employee>('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmployee(id: string, data: Partial<Employee>): Promise<Employee> {
    return this.request<Employee>(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getMyProfile(): Promise<Employee> {
    return this.request<Employee>('/employees/me/profile');
  }

  async updateMyProfile(data: {
    phone?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  }): Promise<Employee> {
    return this.request<Employee>('/employees/me/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateEmployeeStatus(id: string, status: string): Promise<Employee> {
    return this.request<Employee>(`/employees/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async getDepartments(): Promise<Array<{ id: string; name: string; code: string }>> {
    return this.request('/employees/departments');
  }

  async getDesignations(): Promise<Array<{ id: string; title: string; department_id: string }>> {
    return this.request('/employees/designations');
  }

  // Attendance
  async clockIn(workMode: 'ON_SITE' | 'REMOTE', notes?: string): Promise<Attendance> {
    return this.request<Attendance>('/attendance/clock-in', {
      method: 'POST',
      body: JSON.stringify({ workMode, notes }),
    });
  }

  async clockOut(): Promise<Attendance> {
    return this.request<Attendance>('/attendance/clock-out', {
      method: 'POST',
    });
  }

  async getTodayAttendance(): Promise<Attendance | null> {
    return this.request<Attendance | null>('/attendance/today');
  }

  async getAttendanceList(params?: { date?: string; employeeId?: string }): Promise<Attendance[]> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<Attendance[]>(`/attendance${query ? `?${query}` : ''}`);
  }

  async regularizeAttendance(data: {
    employeeId: string;
    date: string;
    clockInTime: string;
    clockOutTime?: string;
    status: 'PRESENT' | 'LATE' | 'HALF_DAY';
    workMode?: 'ON_SITE' | 'REMOTE';
    notes: string;
  }): Promise<Attendance> {
    return this.request<Attendance>('/attendance/regularize', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Leaves
  async applyLeave(data: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    reason: string;
    attachmentName?: string;
    attachmentUrl?: string;
  }): Promise<LeaveApplication> {
    return this.request<LeaveApplication>('/leaves/apply', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async reviewLeave(id: string, decision: 'APPROVE' | 'REJECT', rejectionReason?: string): Promise<LeaveApplication> {
    return this.request<LeaveApplication>(`/leaves/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, rejectionReason }),
    });
  }

  async cancelLeave(id: string): Promise<LeaveApplication> {
    return this.request<LeaveApplication>(`/leaves/${id}/cancel`, {
      method: 'POST',
    });
  }

  async getLeaveBalances(employeeId?: string): Promise<LeaveBalance[]> {
    return this.request<LeaveBalance[]>(`/leaves/balances${employeeId ? `?employeeId=${employeeId}` : ''}`);
  }

  async getLeaveApplications(params?: { status?: string; employeeId?: string }): Promise<LeaveApplication[]> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<LeaveApplication[]>(`/leaves/applications${query ? `?${query}` : ''}`);
  }

  async getLeaveTypes(): Promise<Array<{ id: string; code: string; name: string; is_paid: number }>> {
    return this.request('/leaves/types');
  }

  // Payroll
  async getPayrollBatches(): Promise<PayrollBatch[]> {
    return this.request<PayrollBatch[]>('/payroll/batches');
  }

  async generatePayrollBatch(month: string): Promise<PayrollBatch> {
    return this.request<PayrollBatch>('/payroll/batches', {
      method: 'POST',
      body: JSON.stringify({ month }),
    });
  }

  async getBatchPayslips(batchId: string): Promise<Payslip[]> {
    return this.request<Payslip[]>(`/payroll/batches/${batchId}/payslips`);
  }

  async markBatchPaid(batchId: string): Promise<PayrollBatch> {
    return this.request<PayrollBatch>(`/payroll/batches/${batchId}/pay`, {
      method: 'POST',
    });
  }

  async recalculateBatch(batchId: string): Promise<PayrollBatch> {
    return this.request<PayrollBatch>(`/payroll/batches/${batchId}/recalculate`, {
      method: 'POST',
    });
  }

  async deleteDraftBatch(batchId: string): Promise<void> {
    return this.request<void>(`/payroll/batches/${batchId}`, {
      method: 'DELETE',
    });
  }

  async getMyPayslips(): Promise<Payslip[]> {
    return this.request<Payslip[]>('/payroll/my-payslips');
  }

  // Reports
  async getAttendanceReport(params?: {
    month?: string;
    startDate?: string;
    endDate?: string;
    departmentId?: string;
  }): Promise<AttendanceReportRow[]> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<AttendanceReportRow[]>(`/reports/attendance${query ? `?${query}` : ''}`);
  }

  async getLeaveReport(params?: { year?: number; departmentId?: string }): Promise<LeaveReportRow[]> {
    const query = new URLSearchParams(params as any).toString();
    return this.request<LeaveReportRow[]>(`/reports/leaves${query ? `?${query}` : ''}`);
  }

  async getEpfReport(params?: { batchId?: string; month?: string }): Promise<EpfEtfReport> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<EpfEtfReport>(`/reports/epf-etf${query ? `?${query}` : ''}`);
  }

  async getGratuityProvisions(): Promise<GratuitySummaryReport> {
    return this.request<GratuitySummaryReport>('/reports/gratuity');
  }

  // Documents Vault
  async uploadDocument(data: {
    employeeId: string;
    title: string;
    category: string;
    fileName: string;
    mimeType: string;
    base64Data: string;
    notes?: string;
  }): Promise<EmployeeDocument> {
    return this.request<EmployeeDocument>('/documents/upload', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]> {
    return this.request<EmployeeDocument[]>(`/documents/employee/${employeeId}`);
  }

  async deleteDocument(id: string): Promise<void> {
    return this.request<void>(`/documents/${id}`, {
      method: 'DELETE',
    });
  }

  // Audit
  async getAuditLogs(): Promise<AuditLog[]> {
    return this.request<AuditLog[]>('/audit-logs');
  }

  // Notifications
  async getNotifications(): Promise<{ notifications: AppNotification[]; unreadCount: number }> {
    return this.request<{ notifications: AppNotification[]; unreadCount: number }>('/notifications');
  }

  async markNotificationRead(id: string): Promise<void> {
    return this.request<void>(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsRead(): Promise<void> {
    return this.request<void>('/notifications/read-all', {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
