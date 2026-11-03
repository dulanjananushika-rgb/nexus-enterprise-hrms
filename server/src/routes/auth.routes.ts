import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post('/login', validateBody(loginSchema), (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const result = AuthService.login(email, password, ipAddress);
    res.json({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed.';
    res.status(400).json({ success: false, error: { code: 'AUTH_FAILED', message } });
  }
});

router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const profile = AuthService.getProfile(req.user!.id);
    res.json({ success: true, data: profile });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve profile.';
    res.status(400).json({ success: false, error: { code: 'PROFILE_ERROR', message } });
  }
});

router.post('/change-password', authenticate, validateBody(changePasswordSchema), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    AuthService.changePassword(req.user!.id, oldPassword, newPassword, ipAddress);
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update password.';
    res.status(400).json({ success: false, error: { code: 'PASSWORD_CHANGE_FAILED', message } });
  }
});

router.post('/unlock-user/:id', authenticate, requireRole('SUPER_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    AuthService.unlockUser(req.params.id as string, req.user!.id, ipAddress);
    res.json({ success: true, message: 'User account unlocked successfully.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to unlock user.';
    res.status(400).json({ success: false, error: { code: 'UNLOCK_FAILED', message } });
  }
});

export default router;
