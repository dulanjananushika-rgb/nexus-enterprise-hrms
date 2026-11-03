# TEST PLAN & VERIFICATION TRACEABILITY MATRIX: NEXUS HRMS

## 1. Test Strategy & Scope
Nexus HRMS enforces automated verification across:
1. **Unit Tests:** Mathematical precision of statutory deductions (EPF 8%, EPF 12%, ETF 3%, progressive APIT tax).
2. **Integration & Business Rule Tests:** Leave conflict detection, balance decrements, and multi-tier approval state transitions.
3. **Security Tests:** Authentication validation, invalid password rejection, and session enforcement.

---

## 2. Requirements to Test Traceability Matrix

| Requirement ID | Domain | Test Suite | Test Case Description | Status |
|---|---|---|---|---|
| **FR-001 / FR-003** | Auth | `test/auth.test.ts` | Authenticates valid credentials and issues valid JWT payload | **VERIFIED (PASS)** |
| **FR-001** | Auth | `test/auth.test.ts` | Rejects invalid password with 401 error | **VERIFIED (PASS)** |
| **FR-004** | PIM | `test/auth.test.ts` | Retrieves complete user and employee profile | **VERIFIED (PASS)** |
| **FR-010 / BR-001** | Leave | `test/leave.test.ts` | Rejects leave applications with invalid date ranges (start > end) | **VERIFIED (PASS)** |
| **FR-011 / FR-012** | Leave | `test/leave.test.ts` | Creates valid leave request and increments pending days atomically | **VERIFIED (PASS)** |
| **BR-002** | Leave | `test/leave.test.ts` | Detects and rejects overlapping active leave requests | **VERIFIED (PASS)** |
| **FR-011** | Leave | `test/leave.test.ts` | Approves leave application through multi-tier workflow & deducts balance | **VERIFIED (PASS)** |
| **FR-013 / NFR-002** | Payroll | `test/payroll.test.ts` | Correctly calculates progressive APIT tax in integer cents | **VERIFIED (PASS)** |
| **FR-013 / BR-005** | Payroll | `test/payroll.test.ts` | Generates monthly payroll batch with accurate EPF/ETF statutory deductions | **VERIFIED (PASS)** |
| **FR-013 / BR-004** | Payroll | `test/payroll.test.ts` | Transitions payroll batch to PAID and locks records | **VERIFIED (PASS)** |
| **FR-015** | Payroll | `test/payroll.test.ts` | Exports bank bulk payment CSV with proper headers and monetary values | **VERIFIED (PASS)** |

---

## 3. Automated Test Execution Evidence
- **Test Runner:** Vitest v3.2.7
- **Test Results:** 3 test files, 11 tests executed, 11 passed, 0 failed.
- **Duration:** 2.79 seconds
