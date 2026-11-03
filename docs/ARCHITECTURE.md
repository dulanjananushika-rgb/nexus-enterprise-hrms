# SYSTEM ARCHITECTURE & TECHNICAL DESIGN: NEXUS HRMS

## 1. High-Level Architectural Overview

Nexus HRMS employs a decoupled, layered Full-Stack TypeScript architecture adhering to Clean Architecture principles. It separates presentation, HTTP transport, domain business logic, and data persistence.

```
+-------------------------------------------------------------------+
|                        Client Layer (React)                       |
|   - Tailwind CSS + Lucide Icons + Vite                            |
|   - Responsive Dashboard, ESS, Admin Portals                     |
|   - Client-side Routing, React Query / State Management           |
+----------------------------------+--------------------------------+
                                   | HTTPS / JSON REST API
                                   v
+-------------------------------------------------------------------+
|                     API & Transport Layer (Express)               |
|   - Helmet Security Headers, CORS, Rate Limiting                  |
|   - Cookie / Bearer JWT Authentication Middleware                 |
|   - Role-Based Access Control (RBAC) Guard Middleware             |
|   - Request Body Validation (Zod Schemas)                         |
+----------------------------------+--------------------------------+
                                   |
                                   v
+-------------------------------------------------------------------+
|                       Domain Service Layer                        |
|   - AuthService (Password hashing, Token issuance)                |
|   - EmployeeService (PIM, Status transitions)                     |
|   - AttendanceService (Clock in/out, Geolocation validation)      |
|   - LeaveService (Overlap checks, Balance decrement, Approvals)   |
|   - PayrollEngine (Statutory deductions, Integer math, Payslips)  |
|   - AuditLogger (Append-only audit events)                        |
+----------------------------------+--------------------------------+
                                   |
                                   v
+-------------------------------------------------------------------+
|                 Persistence & Storage Layer (SQLite / ACID)       |
|   - Transactional integrity (BEGIN IMMEDIATE / COMMIT / ROLLBACK) |
|   - Foreign Key enforcement, Cascades, Indexes                    |
|   - Migration runner for reproducible schema setup                |
+-------------------------------------------------------------------+
```

---

## 2. Component Boundaries & Responsibilities

### Client (Frontend)
- **Role:** Pure presentation and user interaction orchestration.
- **Rules:**
  - Never stores raw sensitive credentials in `localStorage` without encryption.
  - UI visibility toggling (hiding a button) is treated strictly as UX convenience; no security is assumed on client state.
  - Form validation is mirrored on the client for immediate UX feedback.

### Server (Backend)
- **Role:** Single source of truth for business rules, authorization, and data integrity.
- **Rules:**
  - All incoming payload validated against strict Zod schemas before touching service layers.
  - Every resource mutation executes within an authenticated and authorized context.
  - All financial math computed using integer cents or scaled decimal representations.
  - Sensitive operations emit immutable audit log entries.

---

## 3. Authentication & Authorization Strategy

### Authentication Flow
1. User submits email and password to `POST /api/auth/login`.
2. Server verifies email existence, checks account lockout state (5 failed attempts $\rightarrow$ 15m lockout), and compares password hash with `bcrypt`.
3. Server generates:
   - Access Token (JWT, 1-hour expiry, signed with server secret, contains `sub`, `email`, `role`, `employeeId`, `departmentId`).
   - Refresh Token (Cryptographically secure random token, 7-day expiry, stored hashed in DB).
4. Access token returned in response body and/or secure HTTP-Only cookie.

### Authorization Hierarchy
| Role | Permissions Overview |
|---|---|
| `SUPER_ADMIN` | Global access to all organizations, settings, audit logs, payroll approval, and user management. |
| `HR_MANAGER` | Employee records CRUD, company-wide leave approvals, shift scheduling, payroll run execution, policy configuration. |
| `LINE_MANAGER` | Subordinate attendance viewing, subordinate leave approval/rejection, team performance evaluation. |
| `EMPLOYEE` | View personal profile, submit leave, punch attendance, view own payslips, submit reimbursement claims. |

---

## 4. Error Handling & Resilience
- **Standardized Error Envelope:**
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_FAILED",
      "message": "Start date cannot be after end date.",
      "details": []
    }
  }
  ```
- **Transaction Rollback:** Every multi-step mutation (e.g., payroll batch generation, leave deduction) executes in an isolated transaction block with automatic rollback on error.
