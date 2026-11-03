import { Router, Response } from 'express';
import { AuditService } from '../services/audit.service.js';
import { BackupService } from '../services/backup.service.js';
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

// Create system backup snapshot
router.post('/backup', authenticate, requireRole('SUPER_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const backup = BackupService.createBackup(req.user!.id);
    res.status(201).json({ success: true, data: backup, message: 'System database and document vault backed up successfully.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Backup generation failed.';
    res.status(500).json({ success: false, error: { code: 'BACKUP_FAILED', message } });
  }
});

// List system backups
router.get('/backups', authenticate, requireRole('SUPER_ADMIN'), (_req: AuthenticatedRequest, res: Response) => {
  try {
    const backups = BackupService.listBackups();
    res.json({ success: true, data: backups });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve backups list.';
    res.status(500).json({ success: false, error: { code: 'FETCH_FAILED', message } });
  }
});

export default router;
