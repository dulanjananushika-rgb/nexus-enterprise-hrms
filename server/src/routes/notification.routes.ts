import { Router, Response } from 'express';
import { NotificationService } from '../services/notification.service.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = NotificationService.getUserNotifications(req.user!.id);
    res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch notifications.';
    res.status(500).json({ success: false, error: { code: 'NOTIFICATION_FETCH_FAILED', message } });
  }
});

router.patch('/:id/read', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    NotificationService.markAsRead(req.params.id as string, req.user!.id);
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update notification.';
    res.status(400).json({ success: false, error: { code: 'UPDATE_FAILED', message } });
  }
});

router.post('/read-all', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    NotificationService.markAllAsRead(req.user!.id);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to clear unread notifications.';
    res.status(400).json({ success: false, error: { code: 'UPDATE_FAILED', message } });
  }
});

export default router;
