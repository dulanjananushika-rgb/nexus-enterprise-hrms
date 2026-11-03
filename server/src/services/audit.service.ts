import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { AuditLogRow } from '../types/index.js';

export class AuditService {
  public static log(params: {
    userId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    oldValue?: unknown;
    newValue?: unknown;
    ipAddress?: string | null;
  }): void {
    try {
      const stmt = db.prepare(`
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_value_json, new_value_json, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        uuidv4(),
        params.userId || null,
        params.action,
        params.entityType,
        params.entityId,
        params.oldValue ? JSON.stringify(params.oldValue) : null,
        params.newValue ? JSON.stringify(params.newValue) : null,
        params.ipAddress || null
      );
    } catch (err) {
      console.error('[AuditService] Failed to record audit log:', err);
    }
  }

  public static getRecent(limit = 100): AuditLogRow[] {
    const stmt = db.prepare(`
      SELECT a.*, u.email as user_email
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as unknown as AuditLogRow[];
  }
}
