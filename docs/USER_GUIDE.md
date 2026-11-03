# USER & OPERATOR MANUAL: NEXUS HRMS

## 1. Quick Access Credentials (Pre-Seeded Baseline)

| Role Persona | Email | Password | Access Capabilities |
|---|---|---|---|
| **Super Administrator** | `admin@nexus.com` | `Password123!` | Global administrative control, full audit logs, system overview |
| **HR Manager** | `hr@nexus.com` | `Password123!` | Employee onboarding, payroll batch execution, bank CSV export, HR leave approval |
| **Line Manager** | `manager@nexus.com` | `Password123!` | Department attendance tracking, subordinate leave approval/rejection |
| **Staff Engineer** | `dev@nexus.com` | `Password123!` | Self-service attendance clock in/out, leave requests, personal payslips |

---

## 2. Step-by-Step Operator Workflows

### Workflow A: Onboarding a New Employee (HR & Super Admin)
1. Sign in as `hr@nexus.com` or `admin@nexus.com`.
2. Navigate to **Employee Directory** on the sidebar.
3. Click **"Onboard New Employee"**.
4. Fill in work email, temporary password, employee code (e.g. `EMP-0010`), personal details, department, designation, and base monthly salary (LKR).
5. Enter bank account details for payroll routing.
6. Click **"Confirm & Onboard"**.
   - *Result:* An active user login is generated, employee profile is stored, and statutory leave balances for the current year are provisioned automatically.

### Workflow B: Time & Attendance Clock-in (Employee Self-Service)
1. Sign in as any employee (e.g. `dev@nexus.com`).
2. Notice the live digital clock in the top navigation bar.
3. On the top bar or inside **Time & Attendance**, select work mode: `On-Site` or `Remote VPN`.
4. Click **"Clock In"**.
   - Arrival before 08:30 AM is recorded as `PRESENT`; arrival after 08:30 AM is recorded as `LATE`.
5. At the end of the shift, click **"Clock Out"**. Total worked duration and any overtime beyond 8 hours are calculated automatically.

### Workflow C: Leave Application & Multi-Tier Approval
1. **Employee applies:**
   - Go to **Leave Management**.
   - View current available balances (Annual, Casual, Medical).
   - Click **"Apply for Leave"**, select policy type, pick start and end dates, provide reason, and submit.
   - Status will show `PENDING`.
2. **Line Manager Reviews:**
   - Line Manager logs in (`manager@nexus.com`).
   - The **"Pending Review Inbox"** alerts the manager of the subordinate's request.
   - Click **"Approve"** (transitions to `APPROVED_MANAGER`) or **"Reject"** (with explanation).
3. **HR Final Approval:**
   - HR Manager logs in and conducts final authorization.
   - Balance is decremented from `remaining_days` and `pending_days` atomically.

### Workflow D: Monthly Payroll Execution & Bank Export (HR Manager)
1. Navigate to **Payroll & Compliance**.
2. Click **"Execute Monthly Payroll Run"**.
3. Select the target month (e.g. `2026-11`) and click **"Execute Batch Calculation"**.
   - The engine computes gross pay, overtime pay from attendance logs, unpaid leave deductions, statutory EPF (8% employee, 12% employer), ETF (3%), and progressive APIT tax in exact integer cents.
4. Review itemized payslips by clicking **"Itemized Slips"**.
5. Click **"Bank CSV"** to download the CEFT/SLIPS compliant bulk payment file for direct upload to corporate banking portals.
6. Click **"Mark Paid"** once funds are disbursed.

### Workflow E: Viewing & Printing Payslips (Employee)
1. Sign in as employee.
2. Click **"My Payslips (ESS)"**.
3. Click **"View Detailed Remuneration Statement"** on any month.
4. Review the breakdown of earnings, statutory deductions, take-home pay, and click **"Print Remuneration Advice"**.
