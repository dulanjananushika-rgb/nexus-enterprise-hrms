import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';

export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'LEAVE' | 'PAYROLL' | 'ATTENDANCE' | 'SYSTEM';
  link?: string | null;
  is_read: number;
  created_at: string;
}

export class NotificationService {
  public static create(params: {
    userId: string;
    title: string;
    message: string;
    type: 'LEAVE' | 'PAYROLL' | 'ATTENDANCE' | 'SYSTEM';
    link?: string;
  }): NotificationRow {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, link, is_read)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(id, params.userId, params.title, params.message, params.type, params.link || null);

    return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as unknown as NotificationRow;
  }

  public static notifyRole(
    role: string,
    params: {
      title: string;
      message: string;
      type: 'LEAVE' | 'PAYROLL' | 'ATTENDANCE' | 'SYSTEM';
      link?: string;
    }
  ): void {
    const users = db.prepare('SELECT id FROM users WHERE role = ? AND is_active = 1').all(role) as Array<{ id: string }>;
    for (const u of users) {
      this.create({
        userId: u.id,
        title: params.title,
        message: params.message,
        type: params.type,
        link: params.link,
      });
    }
  }

  public static notifyAllActive(params: {
    title: string;
    message: string;
    type: 'LEAVE' | 'PAYROLL' | 'ATTENDANCE' | 'SYSTEM';
    link?: string;
  }): void {
    const users = db.prepare('SELECT id FROM users WHERE is_active = 1').all() as Array<{ id: string }>;
    for (const u of users) {
      this.create({
        userId: u.id,
        title: params.title,
        message: params.message,
        type: params.type,
        link: params.link,
      });
    }
  }

  public static getUserNotifications(userId: string, limit = 20): {
    notifications: NotificationRow[];
    unreadCount: number;
  } {
    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, limit) as unknown as NotificationRow[];

    const countRow = db.prepare(`
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).get(userId) as { count: number };

    return {
      notifications,
      unreadCount: countRow.count || 0,
    };
  }

  public static markAsRead(notificationId: string, userId: string): void {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(notificationId, userId);
  }

  public static markAllAsRead(userId: string): void {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
  }
}
