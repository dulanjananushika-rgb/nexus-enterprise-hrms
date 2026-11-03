# PROJECT BRIEF: NEXUS HRMS (Industry-Ready Human Resource Management System)

## 1. Executive Summary
**Nexus HRMS** is an enterprise-grade, compliance-driven, full-stack Human Resource Management System designed for mid-to-large modern enterprises and growing businesses. It automates the complete employee lifecycle—from onboarding and organizational hierarchy management to attendance tracking, multi-tier leave administration, performance appraisals, and audit-compliant payroll execution with statutory deductions.

## 2. Problem Statement
Many organizations struggle with fragmented HR operations:
- Spreadsheets and disconnected tools cause errors in attendance tracking, leave balances, and salary computations.
- Non-compliance with statutory labor regulations (such as EPF, ETF, APIT/PAYE taxation, and overtime regulations) leads to financial penalties and employee dissatisfaction.
- Lack of centralized Role-Based Access Control (RBAC) and immutable audit trails creates data leak risks for confidential salary and personal records.
- Employees lack transparent Self-Service (ESS) portals to view payslips, request time off, and track expense reimbursements.

## 3. Target Users & Personas
1. **Super Admin / Executive Leadership:** Full organizational oversight, company policies, system-wide settings, master audit logs, executive headcount & payroll expense reports.
2. **HR Manager / HR Specialist:** Employee records management, document verification, leave policy definitions, shift scheduling, payroll run execution, disciplinary & performance tracking.
3. **Department Head / Line Manager:** Team attendance tracking, shift allocation, leave approval/rejection workflows, performance appraisal scoring.
4. **Employee (Self-Service User):** Personal profile management, daily attendance punch-in/out (with geofence/IP verification), leave requests, payslip download (PDF), expense reimbursement claims.

## 4. Value Proposition & Key Differentiators
- **Strict Compliance & Precision Payroll:** Zero floating-point arithmetic errors—implements exact integer/fixed-point minor currency calculations for salary, allowances, statutory deductions (EPF 12%+8%, ETF 3%, progressive income tax), and OT.
- **Granular RBAC & Data Isolation:** Server-enforced permissions ensuring managers only view their departmental subordinates and employees only see their own records.
- **Biometric & Remote-Ready Time Management:** Unified clock-in engine supporting hardware biometric log imports and geofenced web/mobile clock-in.
- **Tamper-Evident Audit Trails:** Every salary modification, leave approval, and designation change is logged immutably with timestamp, user ID, and diff.
- **Modern, Accessible UI/UX:** Fast, keyboard-accessible, responsive interface built with React, Tailwind CSS, and Lucide icons.

## 5. Discovery Findings & Environment Status
- **Host System:** Windows OS, Node.js v24.14.0, npm v11.9.0, Git v2.54.0.
- **Project Location:** Isolated repository at `D:\HRMS` (preserving existing work in `D:\JAR`).
- **Tech Stack Selected:** Full-Stack TypeScript (Node.js/Express backend + React/Vite frontend + SQLite with ACID transaction support / PostgreSQL-ready architecture + Tailwind CSS).
