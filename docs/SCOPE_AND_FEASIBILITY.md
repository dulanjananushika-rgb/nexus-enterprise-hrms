# SCOPE, PRIORITIES & FEASIBILITY SPECIFICATION

## 1. Scope Breakdown

### A. Essential MVP Functionality (Must-Have for Production Release)
1. **Core Authentication & RBAC Engine:**
   - JWT-based auth with refresh mechanism and role checking (`SUPER_ADMIN`, `HR_MANAGER`, `LINE_MANAGER`, `EMPLOYEE`).
   - Secure seed script initializing default Admin, HR, Manager, and Employee demo accounts.
2. **Organization & Employee Directory (PIM):**
   - Department, Designation, and Employee CRUD operations.
   - Manager-subordinate hierarchy mapping.
   - Comprehensive profile view with emergency contacts and compensation details.
3. **Leave & Absence Workflow:**
   - Leave policy allocation per employee.
   - Employee self-service application form with date validation and conflict checking.
   - Manager/HR review inbox (Approve/Reject with comments).
   - Balance recalculation engine.
4. **Time & Attendance Tracking:**
   - Web/Mobile punch in/out with IP, timestamp, and notes.
   - Daily attendance overview table with late-arrival, present, absent, on-leave flags.
   - Basic shift time comparison (Worked hours vs Scheduled hours).
5. **Production Payroll & Compliance Engine:**
   - Monthly payroll run initialization per department or company-wide.
   - Statutory calculations: Employee EPF (8%), Employer EPF (12%), Employer ETF (3%), APIT Tax withholding, Overtime Pay, and Unpaid Leave deductions.
   - Payslip generation and exportable breakdown.
   - Bank transfer file exporter (CSV format for bulk corporate uploads).
6. **Executive Dashboard & Reporting:**
   - Real-time statistics: Headcount, Today's Attendance %, Pending Leaves, Total Monthly Payroll Cost.
7. **Immutable Audit Logs:**
   - Automated event logging on sensitive operations.

### B. Important Post-MVP Functionality (Phase 2 Roadmap)
1. Direct biometric device socket sync (ZKTeco / Anviz TCP listeners).
2. Automated recurring email dispatch for monthly payslips.
3. Multi-currency payroll processing for international subsidiaries.
4. Annual 360-degree performance appraisal cycle module.

### C. Explicitly Out-of-Scope (To Avoid Scope Creep & Anti-Patterns)
1. **Full General Ledger Accounting:** No double-entry general ledger, invoicing, or balance sheet tools (integrated via accounting export).
2. **Internal Team Chat / Messaging System:** Does not replace Slack or Microsoft Teams.
3. **Screen Surveillance / Keystroke Logging:** Excluded on ethical, legal, and privacy grounds.
4. **Project Task Tracking (Jira / Asana replacement):** Focus remains on time and attendance, not project task micro-management.

---

## 2. Technical Feasibility & Delivery Risk Matrix

| Risk Factor | Impact | Likelihood | Mitigation Strategy |
|---|---|---|---|
| **Floating Point Inaccuracies in Payroll** | CRITICAL | HIGH if unhandled | Use integer currency units (cents/cents equivalent) or fixed-point decimal arithmetic in computation pipelines. |
| **Concurrency in Leave & Attendance** | HIGH | MEDIUM | Enforce database-level transactions with strict row locks or atomic checks during request submissions. |
| **Data Leak Between Departments** | CRITICAL | LOW | Server-side query scoping (`where tenant_id / department_id = manager.department_id`) enforced in repository layer, never relying on frontend filters. |
| **Dependency Security Vulnerabilities** | MEDIUM | LOW | Use pinned, well-audited production packages; run `npm audit` and vulnerability scanners. |
