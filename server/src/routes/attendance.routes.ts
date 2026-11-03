import { Router, Response } from 'express';
import { z } from 'zod';
import { AttendanceService } from '../services/attendance.service.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

const clockInSchema = z.object({
  workMode: z.enum(['ON_SITE', 'REMOTE']).default('ON_SITE'),
  notes: z.string().max(255).optional(),
});

router.post('/clock-in', authenticate, validateBody(clockInSchema), (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.employeeId) {
      res.status(400).json({ success: false, error: { code: 'NO_EMPLOYEE_RECORD', message: 'User is not linked to an employee profile.' } });
      return;
    }
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const record = AttendanceService.clockIn(req.user.employeeId, req.body.workMode, ip, req.body.notes);
    res.json({ success: true, data: record });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Clock-in failed.';
    res.status(400).json({ success: false, error: { code: 'CLOCK_IN_FAILED', message } });
  }
});

router.post('/clock-out', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.employeeId) {
      res.status(400).json({ success: false, error: { code: 'NO_EMPLOYEE_RECORD', message: 'User is not linked to an employee profile.' } });
      return;
    }
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const record = AttendanceService.clockOut(req.user.employeeId, ip);
    res.json({ success: true, data: record });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Clock-out failed.';
    res.status(400).json({ success: false, error: { code: 'CLOCK_OUT_FAILED', message } });
  }
});

router.get('/today', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.employeeId) {
      res.json({ success: true, data: null });
      return;
    }
    const status = AttendanceService.getTodayStatus(req.user.employeeId);
    res.json({ success: true, data: status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching attendance.';
    res.status(500).json({ success: false, error: { code: 'ERROR', message } });
  }
});

router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, employeeId, departmentId } = req.query as Record<string, string | undefined>;
    
    // Non-admins can only see their own attendance unless they are manager
    let targetEmployeeId = employeeId;
    if (req.user?.role === 'EMPLOYEE') {
      targetEmployeeId = req.user.employeeId;
    }

    const records = AttendanceService.list({
      date,
      employeeId: targetEmployeeId,
      departmentId: req.user?.role === 'LINE_MANAGER' ? req.user.departmentId : departmentId,
    });

    res.json({ success: true, data: records });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching attendance records.';
    res.status(500).json({ success: false, error: { code: 'ATTENDANCE_FETCH_ERROR', message } });
  }
});

export default router;
