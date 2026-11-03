# SECURITY & PRIVACY REVIEW: NEXUS HRMS

## 1. Threat Model & Controls

| Vulnerability / Threat | Risk Level | Applied Mitigation Mechanism |
|---|---|---|
| **Brute-Force & Credential Stuffing** | HIGH | Progressive failed attempt counter in database. Account locked for 15 minutes after 5 consecutive failed attempts. |
| **Weak Password Storage** | CRITICAL | bcrypt hashing with cost factor of 10. Passwords never stored or logged in plain text. |
| **SQL Injection** | CRITICAL | 100% parameter-bound prepared statements (`node:sqlite`). Zero dynamic string concatenation in SQL queries. |
| **Cross-Site Scripting (XSS)** | HIGH | React automated JSX escaping + Helmet HTTP security headers. |
| **Broken Object-Level Authorization (BOLA / IDOR)** | CRITICAL | Backend-enforced RBAC. Line managers can only access reportees within their department; employees can only access their own records. |
| **Unauthorized State Modifications** | HIGH | Append-only immutable `audit_logs` table tracking user ID, timestamp, before-state, and after-state. |
| **Floating-Point Arithmetic Discrepancies** | CRITICAL | All monetary values (salary, allowances, statutory EPF/ETF, taxes) handled in integer minor currency units (cents). |
| **Session Revocation upon Offboarding** | CRITICAL | Immediate authentication token revocation on employee status transition to `SUSPENDED` or `TERMINATED`. |

---

## 2. Cryptographic Architecture
- **Password Hashing:** `bcryptjs` with salt rounds = 10.
- **Session Tokens:** JSON Web Tokens (JWT) signed with HMAC-SHA256 (`HS256`).
- **Token Lifetime:** Short-lived access tokens (8 hours).

---

## 3. Data Protection & Privacy (GDPR / Personal Data Protection)
- **Data Minimization:** Only statutory identity, employment, and banking details necessary for payroll and compliance are collected.
- **Relational Integrity:** Foreign keys enabled (`PRAGMA foreign_keys = ON;`) to prevent orphan records.
- **Separation of Duties:** Separation between Line Managers (operational leave approval), HR (remuneration, hiring, policy), and Super Admin (system settings, audit review).
