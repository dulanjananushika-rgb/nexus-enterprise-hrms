import { Router, Response } from 'express';
import { z } from 'zod';
import { LeaveService } from '../services/leave.service.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validate.js';
import { db } from '../db/database.js';

const router = Router();

const applyLeaveSchema = z.object({
  leaveTypeId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalDays: z.number().positive(),
  reason: z.string().min(3),
});

const reviewLeaveSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().optional(),
});

router.post('/apply', authenticate, validateBody(applyLeaveSchema), (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.employeeId) {
      res.status(400).json({ success: false, error: { code: 'NO_EMPLOYEE', message: 'User is not linked to an employee profile.' } });
      return;
    }

    const application = LeaveService.apply({
      employeeId: req.user.employeeId,
      ...req.body,
    });

    res.status(201).json({ success: true, data: application });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to apply for leave.';
    res.status(400).json({ success: false, error: { code: 'LEAVE_APPLICATION_FAILED', message } });
  }
});

router.post(
  '/:id/review',
  authenticate,
  requireRole('SUPER_ADMIN', 'HR_MANAGER', 'LINE_MANAGER'),
  validateBody(reviewLeaveSchema),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const reviewed = LeaveService.review({
        applicationId: req.params.id as string,
        reviewerUserId: req.user!.id,
        reviewerRole: req.user!.role,
        decision: req.body.decision,
        rejectionReason: req.body.rejectionReason,
      });

      res.json({ success: true, data: reviewed });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to review leave application.';
      res.status(400).json({ success: false, error: { code: 'LEAVE_REVIEW_FAILED', message } });
    }
  }
);

router.get('/balances', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employeeId, year } = req.query as { employeeId?: string; year?: string };
    
    // An employee can only check their own balance
    let targetEmpId = employeeId;
    if (req.user?.role === 'EMPLOYEE' || !targetEmpId) {
      targetEmpId = req.user?.employeeId;
    }

    if (!targetEmpId) {
      res.json({ success: true, data: [] });
      return;
    }

    const balances = LeaveService.getBalances(targetEmpId, year ? parseInt(year, 10) : undefined);
    res.json({ success: true, data: balances });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching balances.';
    res.status(500).json({ success: false, error: { code: 'ERROR', message } });
  }
});

router.get('/applications', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, employeeId, departmentId } = req.query as Record<string, string | undefined>;

    let empFilter = employeeId;
    let managerFilter: string | undefined = undefined;

    if (req.user?.role === 'EMPLOYEE') {
      empFilter = req.user.employeeId;
    } else if (req.user?.role === 'LINE_MANAGER') {
      managerFilter = req.user.employeeId;
    }

    const applications = LeaveService.listApplications({
      status,
      employeeId: empFilter,
      managerId: managerFilter,
      departmentId: req.user?.role === 'LINE_MANAGER' ? req.user.departmentId : departmentId,
    });

    res.json({ success: true, data: applications });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching applications.';
    res.status(500).json({ success: false, error: { code: 'ERROR', message } });
  }
});

router.get('/types', authenticate, (_req: AuthenticatedRequest, res: Response) => {
  const types = db.prepare('SELECT * FROM leave_types ORDER BY is_paid DESC, code ASC').all();
  res.json({ success: true, data: types });
});

export default router;
