import { Router, Response } from 'express';
import { ReportService } from '../services/report.service.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// 1. Attendance Summary Report
router.get('/attendance', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER', 'LINE_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { month, startDate, endDate, departmentId } = req.query as Record<string, string | undefined>;
    
    // Line Manager is locked to their own department
    const targetDept = req.user?.role === 'LINE_MANAGER' ? req.user.departmentId : departmentId;

    const data = ReportService.getAttendanceSummary({
      month,
      startDate,
      endDate,
      departmentId: targetDept,
    });

    res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate attendance report.';
    res.status(500).json({ success: false, error: { code: 'REPORT_FAILED', message } });
  }
});

router.get('/attendance/csv', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER', 'LINE_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { month, startDate, endDate, departmentId } = req.query as Record<string, string | undefined>;
    const targetDept = req.user?.role === 'LINE_MANAGER' ? req.user.departmentId : departmentId;

    const data = ReportService.getAttendanceSummary({
      month,
      startDate,
      endDate,
      departmentId: targetDept,
    });

    const headers = [
      'Employee Code',
      'Employee Name',
      'Department',
      'Present Days',
      'Late Days',
      'Half Days',
      'On Leave Days',
      'Total Worked Hours',
      'Total Overtime Hours',
    ];

    const rows = data.map((r) => [
      `"${r.employeeCode}"`,
      `"${r.fullName}"`,
      `"${r.departmentName}"`,
      r.presentDays,
      r.lateDays,
      r.halfDays,
      r.onLeaveDays,
      r.totalWorkedHours.toFixed(1),
      r.totalOtHours.toFixed(1),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const filename = `attendance_summary_${month || 'period'}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to export attendance CSV.';
    res.status(500).json({ success: false, error: { code: 'EXPORT_FAILED', message } });
  }
});

// 2. Leave Utilization Report
router.get('/leaves', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER', 'LINE_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { year, departmentId } = req.query as Record<string, string | undefined>;
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
    const targetDept = req.user?.role === 'LINE_MANAGER' ? req.user.departmentId : departmentId;

    const data = ReportService.getLeaveUtilization({
      year: targetYear,
      departmentId: targetDept,
    });

    res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate leave report.';
    res.status(500).json({ success: false, error: { code: 'REPORT_FAILED', message } });
  }
});

router.get('/leaves/csv', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER', 'LINE_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { year, departmentId } = req.query as Record<string, string | undefined>;
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
    const targetDept = req.user?.role === 'LINE_MANAGER' ? req.user.departmentId : departmentId;

    const data = ReportService.getLeaveUtilization({
      year: targetYear,
      departmentId: targetDept,
    });

    const headers = [
      'Employee Code',
      'Employee Name',
      'Department',
      'Leave Type Code',
      'Leave Type',
      'Entitled Days',
      'Used Days',
      'Pending Days',
      'Remaining Days',
    ];

    const rows = data.map((r) => [
      `"${r.employeeCode}"`,
      `"${r.fullName}"`,
      `"${r.departmentName}"`,
      `"${r.leaveTypeCode}"`,
      `"${r.leaveTypeName}"`,
      r.entitledDays.toFixed(1),
      r.usedDays.toFixed(1),
      r.pendingDays.toFixed(1),
      r.remainingDays.toFixed(1),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const filename = `leave_utilization_${targetYear}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to export leave CSV.';
    res.status(500).json({ success: false, error: { code: 'EXPORT_FAILED', message } });
  }
});

// 3. EPF/ETF Reconciliation Report
router.get('/epf-etf', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { batchId, month } = req.query as Record<string, string | undefined>;

    const report = ReportService.getEpfEtfReconciliation({ batchId, month });
    if (!report) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No payroll batch found for the given criteria.' } });
      return;
    }

    res.json({ success: true, data: report });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate EPF/ETF reconciliation.';
    res.status(500).json({ success: false, error: { code: 'REPORT_FAILED', message } });
  }
});

router.get('/epf-etf/csv', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { batchId, month } = req.query as Record<string, string | undefined>;

    const report = ReportService.getEpfEtfReconciliation({ batchId, month });
    if (!report) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No payroll batch found for export.' } });
      return;
    }

    const headers = [
      'Employee Code',
      'Employee Name',
      'NIC/Passport',
      'Gross Salary (LKR)',
      'Employee EPF 8% (LKR)',
      'Employer EPF 12% (LKR)',
      'Total EPF 20% (LKR)',
      'Employer ETF 3% (LKR)',
      'Total Remittance (LKR)',
    ];

    const rows = report.records.map((r) => [
      `"${r.employeeCode}"`,
      `"${r.fullName}"`,
      `"${r.nicPassport}"`,
      (r.grossSalaryCents / 100).toFixed(2),
      (r.employeeEpfCents / 100).toFixed(2),
      (r.employerEpfCents / 100).toFixed(2),
      (r.totalEpfCents / 100).toFixed(2),
      (r.employerEtfCents / 100).toFixed(2),
      (r.totalRemittanceCents / 100).toFixed(2),
    ]);

    // Add summary row
    const summaryRow = [
      '"TOTAL"',
      '""',
      '""',
      (report.totals.totalGrossCents / 100).toFixed(2),
      (report.totals.totalEmployeeEpfCents / 100).toFixed(2),
      (report.totals.totalEmployerEpfCents / 100).toFixed(2),
      (report.totals.totalEpfCents / 100).toFixed(2),
      (report.totals.totalEmployerEtfCents / 100).toFixed(2),
      (report.totals.grandTotalRemittanceCents / 100).toFixed(2),
    ];

    const csv = [headers.join(','), ...rows.map((r) => r.join(',')), summaryRow.join(',')].join('\r\n');
    const filename = `epf_etf_reconciliation_${report.month}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to export EPF/ETF CSV.';
    res.status(500).json({ success: false, error: { code: 'EXPORT_FAILED', message } });
  }
});

// 4. Sri Lanka Statutory Gratuity Provisions (Payment of Gratuity Act No. 12 of 1983)
router.get('/gratuity', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER'), (_req: AuthenticatedRequest, res: Response) => {
  try {
    const data = ReportService.getGratuityProvisions();
    res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate gratuity report.';
    res.status(500).json({ success: false, error: { code: 'REPORT_FAILED', message } });
  }
});

router.get('/gratuity/csv', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER'), (_req: AuthenticatedRequest, res: Response) => {
  try {
    const csv = ReportService.exportGratuityCsv();
    const filename = `gratuity_provisions_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to export Gratuity CSV.';
    res.status(500).json({ success: false, error: { code: 'EXPORT_FAILED', message } });
  }
});

export default router;
