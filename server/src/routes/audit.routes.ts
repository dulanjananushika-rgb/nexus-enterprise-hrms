import { Router, Response } from 'express';
import { AuditService } from '../services/audit.service.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

router.get('/', authenticate, requireRole('SUPER_ADMIN'), (_req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = AuditService.getRecent(100);
    res.json({ success: true, data: logs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching audit logs.';
    res.status(500).json({ success: false, error: { code: 'AUDIT_ERROR', message } });
  }
});

export default router;
