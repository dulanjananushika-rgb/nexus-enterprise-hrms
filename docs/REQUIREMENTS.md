# REQUIREMENTS SPECIFICATION: NEXUS HRMS

## 1. Functional Requirements (FR)

### Module 1: Authentication & Access Control
- **FR-001: Multi-Role Authentication:** System must authenticate users via email/password using argon2/bcrypt hashing with JWT bearer tokens and secure HTTP-only cookies.
- **FR-002: Role-Based Authorization (RBAC):** Server must enforce access per endpoint across 4 distinct roles: `SUPER_ADMIN`, `HR_MANAGER`, `LINE_MANAGER`, and `EMPLOYEE`.
- **FR-003: Password Policy & Session Expiry:** Enforce minimum 8 characters with numbers/symbols, account lockout after 5 consecutive failed attempts for 15 minutes, and session token expiry within 8 hours.

### Module 2: Employee Profile & Organization Management (PIM)
- **FR-004: Centralized Employee Master:** Maintain employee records including official ID, personal info, national identity (NIC/Passport), bank account details, emergency contacts, hire date, employment status (`ACTIVE`, `PROBATION`, `SUSPENDED`, `TERMINATED`).
- **FR-005: Department & Designation Hierarchy:** Manage departmental tree, designation levels, and reporting manager relationships (`reportsToEmployeeId`).
- **FR-006: Document Management:** Secure storage and retrieval of identification docs, appointment letters, and qualification records with access restriction to HR and the owner.

### Module 3: Time & Attendance Management
- **FR-007: Attendance Clock-in/out:** Support web/mobile punching with client timestamp, server validation, IP logging, and work-type tag (`ON_SITE`, `REMOTE`).
- **FR-008: Shift & Roster Scheduling:** Configure standard shifts (e.g. 08:30 - 17:00 with grace period), night shifts, and flexible shifts.
- **FR-009: Overtime (OT) Computation:** Automatically compute approved normal OT and double OT (weekends/holidays) based on clock-out delta beyond shift duration.

### Module 4: Leave & Absence Management
- **FR-010: Configurable Leave Policies:** Define annual, casual, medical, maternity, and unpaid leave allocations per employment type (Permanent, Contract, Intern).
- **FR-011: Multi-Level Leave Approval Workflow:** Employee requests leave $\rightarrow$ Line Manager reviews/approves $\rightarrow$ HR Final Approval $\rightarrow$ Balance deducted. Supports rejection with mandatory reason.
- **FR-012: Leave Balance & Proration:** Real-time tracking of Entitled, Utilized, Pending, and Remaining balances; automatic validation against negative balances unless configured for advance leave.

### Module 5: Payroll & Statutory Compliance
- **FR-013: Payroll Execution Engine:** Process monthly payroll with transaction atomicity:
  - Base salary
  - Fixed & variable allowances (Travel, Attendance incentive, Housing)
  - Deductions (Unpaid leave / No-pay days, Advances)
  - Statutory Deductions: Employee EPF (8%), Employer EPF (12%), Employer ETF (3%), APIT/PAYE progressive tax withholding.
- **FR-014: Payslip Generation & Distribution:** Generate secure digital payslips in PDF format with itemized earnings, deductions, net salary, and statutory contributions.
- **FR-015: Bank Export File Generation:** Export bulk payroll payment instructions in standard bank transfer formats (CSV/CEFT/SLIPS).

### Module 6: Audit, Self-Service & Reporting
- **FR-016: Immutable Audit Trail:** Record all state modifications to sensitive entities (salary changes, role promotions, status updates) with actor ID, timestamp, before-state, and after-state.
- **FR-017: Employee Self-Service (ESS):** Single portal for employees to view personal data, download payslips, punch in/out, view leave balances, and submit requests.
- **FR-018: Executive HR Dashboard:** Real-time analytics on headcount by department, monthly payroll cost trends, attendance percentages, and pending approval queues.

---

## 2. Non-Functional Requirements (NFR)
- **NFR-001 (Security & Encryption):** Sensitive fields (e.g., bank account numbers, salary figures) encrypted; passwords hashed with bcrypt (salt rounds $\ge 10$); all communication encrypted via HTTPS/TLS in production.
- **NFR-002 (Precision & Integrity):** All financial calculations executed in integer minor currency units (cents) or fixed precision decimal types (`DECIMAL(12, 2)`) to eliminate binary floating-point roundoff errors.
- **NFR-003 (Performance):** Dashboard APIs respond in $< 200\text{ ms}$ for datasets up to 10,000 employees; payroll generation batch handles 500 employees in $< 10\text{ seconds}$.
- **NFR-004 (Reliability & ACID Transactions):** Payroll processing and leave deductions must execute within isolated database transactions; rollback guaranteed on partial failure.
- **NFR-005 (Auditability):** Audit log entries cannot be modified or deleted through normal application APIs (append-only architecture).
- **NFR-006 (Usability & Accessibility):** WCAG 2.1 AA compliant contrast ratios, accessible form controls, responsive design for desktop, tablet, and mobile browsers.
- **NFR-007 (Maintainability):** Modular layered architecture separating Presentation (React), Transport (Express Routes/Controllers), Domain Logic (Services), and Data Access (Repositories/DB Client).
- **NFR-008 (Portability):** Configurable via environment variables (`.env`), containerizable via Docker, zero platform-specific proprietary dependencies.

---

## 3. Mandatory Business Rules (BR)

| Rule ID | Domain | Business Rule Statement | Enforcement Layer |
|---|---|---|---|
| **BR-001** | Leave | An employee cannot request leave exceeding their available balance unless unpaid leave is explicitly selected. | Backend Service + DB Constraint |
| **BR-002** | Leave | Overlapping leave requests for the same employee are strictly prohibited. | Backend Validation Query |
| **BR-003** | Attendance | An employee cannot check in twice without an intervening check-out on the same working shift. | Backend Service |
| **BR-004** | Payroll | Once a monthly payroll batch is marked `PAID` or `CLOSED`, it cannot be modified or re-run without an explicit rollback authorization from `SUPER_ADMIN`. | Backend Transaction State Machine |
| **BR-005** | Payroll | Statutory EPF/ETF contributions must strictly adhere to the legal base earnings formula (Basic Salary + Budgetary Relief Allowances). | Payroll Computation Service |
| **BR-006** | Access | Line Managers can only approve/reject leaves and view attendance for direct or indirect reportees in their department. | Server RBAC Middleware / Service Filter |
| **BR-007** | Profile | Employee termination (`TERMINATED`) immediately revokes active login sessions and sets future scheduled leaves to cancelled. | Cascade Service Handler |
| **BR-008** | Audit | Any change to base salary, bank account details, or role requires an audit entry with a mandatory reason. | Domain Model Interceptor |
