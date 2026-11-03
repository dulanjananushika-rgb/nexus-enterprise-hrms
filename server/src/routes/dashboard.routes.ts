import { Router, Response } from 'express';
import { db } from '../db/database.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/summary', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Total Active Employees
    const totalEmpStmt = db.prepare("SELECT COUNT(*) as count FROM employees WHERE employment_status IN ('ACTIVE', 'PROBATION')");
    const totalEmployees = (totalEmpStmt.get() as { count: number }).count;

    // 2. Today's Attendance
    const todayAttendanceStmt = db.prepare('SELECT COUNT(*) as count FROM attendance WHERE date = ?');
    const todayPresent = (todayAttendanceStmt.get(today) as { count: number }).count;
    const attendancePercentage = totalEmployees > 0 ? Math.round((todayPresent / totalEmployees) * 100) : 0;

    // 3. Pending Leave Requests
    let pendingLeavesStmt;
    let pendingLeaves = 0;
    if (req.user?.role === 'LINE_MANAGER') {
      pendingLeavesStmt = db.prepare(`
        SELECT COUNT(*) as count FROM leave_applications l
        JOIN employees e ON l.employee_id = e.id
        WHERE l.status = 'PENDING' AND e.manager_id = ?
      `);
      pendingLeaves = (pendingLeavesStmt.get(req.user.employeeId || '') as { count: number }).count;
    } else {
      pendingLeavesStmt = db.prepare("SELECT COUNT(*) as count FROM leave_applications WHERE status IN ('PENDING', 'APPROVED_MANAGER')");
      pendingLeaves = (pendingLeavesStmt.get() as { count: number }).count;
    }

    // 4. Latest Payroll Expense
    const latestBatchStmt = db.prepare("SELECT total_gross_cents, total_net_cents, month FROM payroll_batches WHERE status = 'PAID' ORDER BY month DESC LIMIT 1");
    const latestPayroll = latestBatchStmt.get() as { total_gross_cents: number; total_net_cents: number; month: string } | undefined;

    // 5. Department Headcount Distribution
    const deptDistribution = db.prepare(`
      SELECT d.name, d.code, COUNT(e.id) as employee_count
      FROM departments d
      LEFT JOIN employees e ON d.id = e.department_id AND e.employment_status IN ('ACTIVE', 'PROBATION')
      GROUP BY d.id
      ORDER BY employee_count DESC
    `).all();

    // 6. Recent Today's Clock-ins
    const recentActivity = db.prepare(`
      SELECT a.*, (e.first_name || ' ' || e.last_name) as employee_name, e.employee_code, d.name as department_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      JOIN departments d ON e.department_id = d.id
      WHERE a.date = ?
      ORDER BY a.clock_in_time DESC
      LIMIT 5
    `).all(today);

    res.json({
      success: true,
      data: {
        totalEmployees,
        todayPresent,
        attendancePercentage,
        pendingLeaves,
        latestPayroll: latestPayroll || null,
        departmentDistribution: deptDistribution,
        recentActivity,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching dashboard metrics.';
    res.status(500).json({ success: false, error: { code: 'DASHBOARD_ERROR', message } });
  }
});

export default router;
