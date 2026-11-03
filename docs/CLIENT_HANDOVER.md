# NEXUS HRMS ENTERPRISE — CLIENT HANDOVER & RUNBOOK
**System Version:** v1.0.0 Production Release  
**Release Date:** November 2026  
**Engineering Standard:** Tier-1 Enterprise Web Application  

---

## 1. Executive Summary & Deliverables

Nexus HRMS is a production-grade, full-stack Human Resource Management & Statutory Payroll System engineered for corporate operations. The software conforms strictly to the Sri Lankan Shop and Office Employees Act, Employees' Provident Fund (EPF) Act No. 15 of 1958, Employees' Trust Fund (ETF) Act No. 46 of 1980, and Inland Revenue Department Advance Personal Income Tax (APIT) withholding tables.

### Delivered Artifacts
1. **Source Code:** Complete, strictly typed TypeScript codebase (`client/` and `server/`).
2. **Unified Production Server:** Node.js/Express service serving domain REST APIs and pre-compiled React 19 SPA from a single HTTP port (`5000`).
3. **Database Engine:** Native embedded WAL-mode SQLite database (`server/data/nexus_hrms.db`) with relational integrity and automatic schema migrations.
4. **Automated Test Suite:** 24 unit, workflow, and security integration tests in Vitest with 100% pass rate.
5. **Client Documentation Suite (`docs/`):**
   - `ARCHITECTURE.md`: High-level system topology and layer boundaries.
   - `DATA_MODEL.md`: Entity-relationship dictionary and DDL specifications.
   - `API_SPECIFICATION.md`: REST API contract definitions.
   - `SECURITY.md`: Security controls, RBAC, BOLA mitigation, and audit trails.
   - `OPERATIONS_AND_BACKUPS.md`: Zero-downtime backup runbooks and disaster recovery.
   - `USER_GUIDE.md`: Role-based step-by-step user manual.
   - `TEST_PLAN.md`: Verification matrix and automated coverage report.

---

## 2. Production Installation & Quick Start

### Prerequisites
- Node.js runtime: v22 LTS or v24+ (Node.js v24.14.0 recommended).
- Operating System: Linux, Windows Server, or macOS.
- Memory: Minimum 512 MB RAM (1 GB recommended).
- Disk: Minimum 500 MB free space.

### Environment Setup
1. Clone or copy project directory to production server:
   ```bash
   cd /opt/nexus-hrms  # or D:\HRMS on Windows
   ```
2. Configure `.env` from `.env.example`:
   ```ini
   PORT=5000
   NODE_ENV=production
   JWT_SECRET=YOUR_ENTERPRISE_SECRET_KEY_MIN_32_CHARS
   DB_PATH=data/nexus_hrms.db
   ```
3. Install production dependencies and build:
   ```bash
   npm run build:all
   ```
4. Initialize and seed production database:
   ```bash
   npm run db:seed
   ```
5. Start service daemon:
   ```bash
   npm start
   ```
   The application is live at `http://localhost:5000`.

---

## 3. Standard Seed Credentials & Roles

| Role | Email | Password | Intended Operational Use |
|---|---|---|---|
| **SUPER_ADMIN** | `admin@nexus.com` | `Password123!` | System configuration, account unlocking, immutable audit review |
| **HR_MANAGER** | `hr@nexus.com` | `Password123!` | Employee lifecycle (PIM), final leave approval, payroll runs & statutory filings |
| **LINE_MANAGER** | `manager@nexus.com` | `Password123!` | Engineering lead, first-tier leave reviews, department attendance approvals |
| **EMPLOYEE** | `dev@nexus.com` | `Password123!` | Employee self-service (ESS), shift clock-ins, leave applications, payslip downloads |
| **EMPLOYEE (Probation)** | `kasun@nexus.com` | `Password123!` | Junior staff on probation |

*Important:* All administrative and employee users must change default passwords upon initial system login via the "Change Password" modal in the top navigation bar.

---

## 4. Key Functional Modules & Business Logic

### A. Employee Master Management (PIM)
- Enforces unique National Identity Card (NIC) / Passport numbers and corporate employee codes.
- Maintains bank remittance details (Bank Name, Branch Code, Account Number) for salary transfers.
- Immediate deactivation on employee termination: revokes active sessions and automatically cancels upcoming scheduled leaves.
- Self-service portal for employees to update phone numbers and emergency contacts.

### B. Time & Attendance Terminal
- Accurate calendar date calculation based on local corporate timezone (GMT+5:30).
- Biometric & Remote shift recording (On-Site vs Remote VPN).
- Automatic calculation of shift duration and overtime (OT) beyond 8 standard working hours.
- Administrative Regularization workflow with mandatory audit trail logging for missed hardware punches.

### C. Leave Management & Restitution
- Multi-tier approval hierarchy:
  - First tier: Line Manager review (strictly scoped to direct team reportees).
  - Second tier: HR Manager final authorization.
- Atomic balance reservation: increments `pending_days` on application to eliminate double-booking.
- Resilient Cancellation Restitution:
  - Cancelling `PENDING` leaves restores `pending_days`.
  - Cancelling `APPROVED` leaves restores `remaining_days` back into available balance.

### D. Payroll Engine & Statutory Schedules
- **Zero-drift Integer Cent Arithmetic:** Avoids floating-point rounding bugs (`cents / 100`).
- **Statutory Rules:**
  - Employee EPF: 8% of Base Salary.
  - Employer EPF: 12% of Base Salary.
  - Employer ETF: 3% of Base Salary.
  - Progressive APIT Withholding: 0% up to LKR 100k; 6% (100k-141.6k); 12% (141.6k-183.3k); 18% (183.3k-225k); 24% (225k-266.6k); 30% (266.6k-308.3k); 36% (>308.3k).
- **Remittance Exports:**
  - Standard Bank CSV for CEFT/SLIPS automated bulk bank transfers.
  - Sri Lankan Department of Labour compliant **EPF Form C & ETF Remittance Schedule CSV**.
- **Draft Batch Lifecycle:** Recalculate draft batch before payment; delete draft batch if cancelled; historical finalized `PAID` batches are immutable.

### E. Executive Reports & Analytics
- Monthly Attendance Summary: Worked hours, present days, tardiness, overtime by department.
- Leave Utilization: Annual entitlement, utilized days, pending requests, remaining balance per employee.
- EPF/ETF Reconciliation: Real-time mathematical verification of employer and member contributions.

### F. Security & Immutable Audit Trail
- Passwords hashed with salted bcrypt (cost factor 10).
- Account lockout: 5 consecutive failed login attempts locks account for 15 minutes; Super Admin unlock endpoint.
- Broken Object Level Authorization (BOLA) mitigations: Line managers restricted strictly to reportees.
- Cryptographically logged audit trail for all salary changes, status updates, logins, and overrides.

---

## 5. Operations & Disaster Recovery Runbook

### Routine Hot Backups
SQLite database in WAL mode supports online backups without stopping the service:
```bash
# Execute safe snapshot while service is running
sqlite3 server/data/nexus_hrms.db ".backup 'backups/nexus_hrms_$(date +%Y%m%d_%H%M%S).db'"
```

### Database Restoration
1. Stop Node.js service:
   ```bash
   pkill -f "nexus-hrms"
   ```
2. Replace `server/data/nexus_hrms.db` with validated backup snapshot.
3. Start service:
   ```bash
   npm start
   ```

---

## 6. Verification & Quality Assurance Summary

| Test Suite | File | Tests | Status |
|---|---|---|---|
| **Authentication & Profile** | `server/test/auth.test.ts` | 3 | PASSED |
| **Leave Workflow & Overlap** | `server/test/leave.test.ts` | 4 | PASSED |
| **Statutory Payroll Engine** | `server/test/payroll.test.ts` | 4 | PASSED |
| **Security Controls & BOLA** | `server/test/security.test.ts` | 4 | PASSED |
| **Leave Cancellation Refunds** | `server/test/leave-cancellation.test.ts` | 3 | PASSED |
| **Advanced Payroll & Form C** | `server/test/payroll-advanced.test.ts` | 2 | PASSED |
| **Attendance Regularization** | `server/test/attendance-regularize.test.ts` | 1 | PASSED |
| **Reports & Reconciliations** | `server/test/report.test.ts` | 3 | PASSED |
| **Total Test Coverage** | **8 Test Suites** | **24 Tests** | **100% PASS** |

---

## 7. Handover Acceptance Sign-off

Nexus HRMS v1.0.0 has met all engineering quality gates, business logic requirements, security validations, and statutory calculations. The system is verified and ready for client acceptance and production staging.
