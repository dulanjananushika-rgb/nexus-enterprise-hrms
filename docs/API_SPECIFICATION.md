# API SPECIFICATION: NEXUS HRMS (REST v1)

## 1. Authentication & Security
- **Header:** `Authorization: Bearer <JWT_ACCESS_TOKEN>`
- **Content-Type:** `application/json`
- **Standard Success Response:**
  ```json
  {
    "success": true,
    "data": { ... }
  }
  ```
- **Standard Error Response:**
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE",
      "message": "Human readable error description",
      "details": []
    }
  }
  ```

---

## 2. Authentication & Credential Management

### `POST /api/auth/login`
- **Access:** Public (5-consecutive failed attempt lockout for 15 minutes)
- **Request Body:**
  ```json
  {
    "email": "admin@nexus.com",
    "password": "Password123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOi...",
      "user": {
        "id": "uuid-v4",
        "email": "admin@nexus.com",
        "role": "SUPER_ADMIN"
      }
    }
  }
  ```

### `GET /api/auth/me`
- **Access:** Authenticated
- **Response (200 OK):** Returns profile of logged-in user, linked employee ID, designation, and department.

### `POST /api/auth/change-password`
- **Access:** Authenticated (Any User)
- **Request Body:**
  ```json
  {
    "oldPasswordPlain": "CurrentPass123!",
    "newPasswordPlain": "NewSecurePass2026!"
  }
  ```
- **Validation:** Minimum 8 characters, alphanumeric with letters and numbers.
- **Audit Action:** `PASSWORD_CHANGED`

### `POST /api/auth/unlock-user`
- **Access:** `SUPER_ADMIN`
- **Request Body:** `{ "targetUserId": "uuid" }`
- **Audit Action:** `USER_ACCOUNT_UNLOCKED`

---

## 3. Employee Master (PIM) Endpoints

### `GET /api/employees`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`, `LINE_MANAGER`
- **Query Params:** `departmentId`, `status`, `search`
- **Scoping Rule:** Line Managers restricted to their department or team reportees.

### `GET /api/employees/me/profile`
- **Access:** Authenticated Employee
- **Response (200 OK):** Detailed employee record including salary, department, bank account, and emergency contact details.

### `PUT /api/employees/me/profile`
- **Access:** Authenticated Employee
- **Request Body:**
  ```json
  {
    "phone": "+94 77 123 4567",
    "emergencyContactName": "Kamal Perera",
    "emergencyContactPhone": "+94 71 987 6543"
  }
  ```
- **Audit Action:** `SELF_UPDATE_PROFILE`

### `POST /api/employees`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`
- **Request Body:** Complete employee master record with initial salary and bank details.
- **Behavior:** Atoms user account, profile record, and initial year leave balances.

### `PUT /api/employees/:id`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`
- **Request Body:** Partial or complete employee profile fields.

### `PATCH /api/employees/:id/status`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`
- **Request Body:** `{ "status": "TERMINATED" | "ACTIVE" | "PROBATION" | "SUSPENDED" }`
- **Behavior:** Immediately revokes login privileges and cancels upcoming scheduled leaves on deactivation.

---

## 4. Time & Attendance Endpoints

### `POST /api/attendance/clock-in`
- **Access:** Authenticated Employee
- **Request Body:** `{ "workMode": "ON_SITE" | "REMOTE", "notes": "Shift notes" }`
- **Business Rule:** Prohibits duplicate clock-in on same date. Auto-flags as `LATE` if after 08:30 AM local time.

### `POST /api/attendance/clock-out`
- **Access:** Authenticated Employee
- **Behavior:** Computes total worked minutes and overtime beyond standard 8-hour shift.

### `GET /api/attendance/today`
- **Access:** Authenticated Employee
- **Response (200 OK):** Current day punch state.

### `POST /api/attendance/regularize`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`, `LINE_MANAGER`
- **Request Body:**
  ```json
  {
    "employeeId": "uuid",
    "date": "2026-05-15",
    "clockInTime": "08:30",
    "clockOutTime": "17:30",
    "status": "PRESENT",
    "workMode": "ON_SITE",
    "reason": "Biometric hardware glitch"
  }
  ```
- **Audit Action:** `ATTENDANCE_REGULARIZED`

---

## 5. Leave Management Workflow Endpoints

### `GET /api/leaves/balances`
- **Access:** Authenticated (Scoping enforced: Employees see self; Line Managers see team; HR sees all)
- **Response (200 OK):** Balance breakdown (`entitled_days`, `used_days`, `pending_days`, `remaining_days`).

### `POST /api/leaves/apply`
- **Access:** Authenticated Employee
- **Request Body:**
  ```json
  {
    "leaveTypeId": "uuid",
    "startDate": "2026-06-01",
    "endDate": "2026-06-03",
    "totalDays": 3,
    "reason": "Annual family travel"
  }
  ```
- **Business Rules:** Overlap prevention, balance availability checks, incrementing `pending_days`.

### `POST /api/leaves/:id/review`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`, `LINE_MANAGER`
- **Request Body:** `{ "decision": "APPROVE" | "REJECT", "rejectionReason": "Optional note" }`
- **Multi-tier Logic:**
  - `LINE_MANAGER`: Sets status to `APPROVED_MANAGER` (scoping restricts to department reportees).
  - `HR_MANAGER` / `SUPER_ADMIN`: Sets status to `APPROVED_HR`, releases `pending_days`, and debits `remaining_days`.

### `POST /api/leaves/:id/cancel`
- **Access:** Owner Employee, `SUPER_ADMIN`, `HR_MANAGER`
- **Behavior:** Cancels request and executes atomic restitution of `pending_days` or `remaining_days`.

---

## 6. Payroll & Statutory Compliance Endpoints

### `GET /api/payroll/batches`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`
- **Response (200 OK):** Historical batch list with total gross, net, and EPF fund amounts.

### `POST /api/payroll/batches`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`
- **Request Body:** `{ "month": "YYYY-MM" }`
- **Behavior:** Computes Base Salary, Overtime Pay, Unpaid Leave Deductions, Fixed Allowances, EPF 8%, EPF 12%, ETF 3%, and APIT Tax.

### `POST /api/payroll/batches/:id/recalculate`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`
- **Behavior:** Re-computes all draft payslips against latest attendance and leave changes.

### `DELETE /api/payroll/batches/:id`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`
- **Behavior:** Deletes draft batch and its payslips. Prohibits deletion of finalized `PAID` batches.

### `POST /api/payroll/batches/:id/pay`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`
- **Behavior:** Authorizes batch, marks batch and payslips as `PAID`.

### `GET /api/payroll/batches/:id/export-bank-csv`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`
- **Response:** Formatted CSV for CEFT/SLIPS corporate bulk payments.

### `GET /api/payroll/batches/:id/export-epf-cform-csv`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`
- **Response:** Department of Labour compliant EPF Form C and ETF Remittance schedule.

### `GET /api/payroll/my-payslips`
- **Access:** Authenticated Employee
- **Response (200 OK):** Itemized historical salary slips.

---

## 7. Reports & Compliance Audits

### `GET /api/reports/attendance`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`, `LINE_MANAGER`
- **Query Params:** `month`, `startDate`, `endDate`, `departmentId`
- **Returns:** Aggregated work hours, present days, late arrivals, half days, and overtime.

### `GET /api/reports/attendance/csv`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`, `LINE_MANAGER`
- **Response:** Downloadable CSV of attendance summaries.

### `GET /api/reports/leaves`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`, `LINE_MANAGER`
- **Query Params:** `year`, `departmentId`
- **Returns:** Company-wide leave utilization and balance schedule.

### `GET /api/reports/leaves/csv`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`, `LINE_MANAGER`
- **Response:** Downloadable CSV of leave utilization.

### `GET /api/reports/epf-etf`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`
- **Query Params:** `batchId`, `month`
- **Returns:** Statutory gross remuneration, member EPF 8%, employer EPF 12%, employer ETF 3%, total remittances, and balance verification.

### `GET /api/reports/epf-etf/csv`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`
- **Response:** Downloadable CSV schedule with total remittance reconciliations.
