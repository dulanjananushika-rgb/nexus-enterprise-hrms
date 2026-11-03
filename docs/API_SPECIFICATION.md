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

## 2. Authentication Endpoints

### `POST /api/auth/login`
- **Access:** Public (Rate-limited, 5-failure lockout)
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
- **Response (200 OK):** Returns full profile of logged in user, linked employee ID, designation, and department.

---

## 3. Employee Master (PIM) Endpoints

### `GET /api/employees`
- **Access:** Authenticated (`SUPER_ADMIN`, `HR_MANAGER`, `LINE_MANAGER`)
- **Query Params:**
  - `departmentId`: Filter by department UUID
  - `status`: Filter by status (`ACTIVE`, `PROBATION`, `SUSPENDED`, `TERMINATED`)
  - `search`: Case-insensitive search on name, code, or email
- **Behavior:** Line Managers automatically restricted to their direct/indirect team reportees.

### `POST /api/employees`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`
- **Request Body:** Creates user credentials and employee profile, seeds initial leave balances inside an atomic transaction.

### `PATCH /api/employees/:id/status`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`
- **Request Body:** `{ "status": "TERMINATED" }`
- **Behavior:** Setting to `TERMINATED` immediately revokes active login sessions and cancels pending scheduled leaves.

---

## 4. Time & Attendance Endpoints

### `POST /api/attendance/clock-in`
- **Access:** Authenticated Employee
- **Request Body:**
  ```json
  {
    "workMode": "ON_SITE",
    "notes": "Office Check-in"
  }
  ```
- **Business Rule:** Prohibits duplicate clock-in on the same date. Flags as `LATE` if after 08:30 AM.

### `POST /api/attendance/clock-out`
- **Access:** Authenticated Employee
- **Behavior:** Calculates total worked minutes and overtime (OT) minutes beyond 8 hours.

### `GET /api/attendance/today`
- **Access:** Authenticated Employee
- **Response (200 OK):** Current day punch state.

---

## 5. Leave & Absence Endpoints

### `POST /api/leaves/apply`
- **Access:** Authenticated Employee
- **Request Body:**
  ```json
  {
    "leaveTypeId": "uuid",
    "startDate": "2026-11-20",
    "endDate": "2026-11-21",
    "totalDays": 2,
    "reason": "Family ceremony"
  }
  ```
- **Business Rule:** Validates date order, checks for overlapping active requests, ensures sufficient remaining balance, increments `pending_days` atomically.

### `POST /api/leaves/:id/review`
- **Access:** `LINE_MANAGER`, `HR_MANAGER`, `SUPER_ADMIN`
- **Request Body:** `{ "decision": "APPROVE" }` or `{ "decision": "REJECT", "rejectionReason": "..." }`
- **Behavior:** Manager approval transitions to `APPROVED_MANAGER`; HR approval transitions to `APPROVED_HR` and finalizes balance deductions.

---

## 6. Payroll & Statutory Compliance Endpoints

### `POST /api/payroll/batches`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`
- **Request Body:** `{ "month": "2026-11" }`
- **Behavior:** Computes base salary, attendance OT, unpaid leave deductions, Employee EPF (8%), Employer EPF (12%), Employer ETF (3%), and APIT tax in exact integer cents.

### `POST /api/payroll/batches/:id/pay`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`
- **Behavior:** Authorizes batch as `PAID`.

### `GET /api/payroll/batches/:id/export-bank-csv`
- **Access:** `SUPER_ADMIN`, `HR_MANAGER`
- **Response:** Formatted CSV file download ready for corporate banking portals.

### `GET /api/payroll/my-payslips`
- **Access:** Authenticated Employee (ESS)
- **Response:** Returns itemized confidential payslips for the caller.

---

## 7. Audit & Executive Dashboard

### `GET /api/dashboard/summary`
- **Access:** Authenticated
- **Response:** Total active headcount, today's attendance %, pending leave count, latest closed payroll expense, and department distribution.

### `GET /api/audit-logs`
- **Access:** `SUPER_ADMIN`
- **Response:** Immutable audit events with actor, action tag, and before/after JSON diffs.
