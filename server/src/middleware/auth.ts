import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';
import { AuthUser, UserRow } from '../types/index.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'nexus-hrms-production-secure-key-2026';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header.' },
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;

    // Verify active status in DB to allow immediate revocation upon termination
    const stmt = db.prepare('SELECT id, email, role, is_active FROM users WHERE id = ?');
    const user = stmt.get(decoded.id) as Pick<UserRow, 'id' | 'email' | 'role' | 'is_active'> | undefined;

    if (!user || user.is_active !== 1) {
      res.status(401).json({
        success: false,
        error: { code: 'ACCOUNT_DEACTIVATED', message: 'User account is deactivated or no longer exists.' },
      });
      return;
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Session token has expired or is invalid.' },
    });
  }
}
