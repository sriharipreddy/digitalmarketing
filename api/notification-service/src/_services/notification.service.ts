import type { Models } from '../models/index.js';
import type { NotificationBus } from './bus.service.js';
import {
  NotFoundError,
  ValidationError,
} from '@marketing/shared-middleware';
import type { NotificationKind, NotificationSeverity } from '../models/notification.model.js';

export interface PublishInput {
  workspace_id: string;
  /** When null/missing, the notification is workspace-wide. */
  user_id?: string | null;
  kind: NotificationKind;
  severity?: NotificationSeverity;
  title: string;
  body?: string;
  action_url?: string;
  metadata?: Record<string, unknown>;
  /** Which service is publishing (recorded for auditability). */
  from_service: string;
}

export class NotificationService {
  constructor(
    private models: Models,
    private bus: NotificationBus,
  ) {}

  async publish(input: PublishInput) {
    if (!input.workspace_id) throw new ValidationError('workspace_id required', { workspace_id: ['Required'] });
    if (!input.kind) throw new ValidationError('kind required', { kind: ['Required'] });
    if (!input.title || input.title.trim().length === 0) {
      throw new ValidationError('title required', { title: ['Required'] });
    }

    const row = await this.models.Notification.create({
      workspace_id: input.workspace_id,
      user_id: input.user_id ?? null,
      kind: input.kind,
      severity: input.severity ?? 'info',
      title: input.title.trim(),
      body: input.body ?? null,
      action_url: input.action_url ?? null,
      metadata: input.metadata ?? null,
      from_service: input.from_service,
    } as any);

    const publicRow = this.publicNotification(row);
    this.bus.publish({
      workspace_id: input.workspace_id,
      user_id: input.user_id ?? null,
      notification: publicRow,
    });

    return row;
  }

  async list(workspaceId: string, userId: string, opts: { unread_only?: boolean; limit?: number; offset?: number }) {
    // Sequelize Op.or is verbose for a 2-clause filter; raw SQL keeps it readable.
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;
    const unreadClause = opts.unread_only ? 'AND read_at IS NULL' : '';
    const rows: any[] = await this.models.Notification.sequelize!.query(
      `SELECT *
         FROM notif_notifications
        WHERE workspace_id = :ws
          AND (user_id = :uid OR user_id IS NULL)
          ${unreadClause}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset`,
      { replacements: { ws: workspaceId, uid: userId, limit, offset }, type: 'SELECT' as any },
    );
    const [{ cnt }]: any = await this.models.Notification.sequelize!.query(
      `SELECT COUNT(*) AS cnt
         FROM notif_notifications
        WHERE workspace_id = :ws
          AND (user_id = :uid OR user_id IS NULL)
          ${unreadClause}`,
      { replacements: { ws: workspaceId, uid: userId }, type: 'SELECT' as any },
    );
    return { rows: rows.map((r) => this.publicNotification(r)), total: Number(cnt ?? 0) };
  }

  async unreadCount(workspaceId: string, userId: string): Promise<number> {
    // Use raw SQL for the OR (user_id = :uid OR user_id IS NULL) AND read_at IS NULL filter.
    const [row]: any = await this.models.Notification.sequelize!.query(
      `SELECT COUNT(*) AS cnt
         FROM notif_notifications
        WHERE workspace_id = :ws
          AND (user_id = :uid OR user_id IS NULL)
          AND read_at IS NULL`,
      { replacements: { ws: workspaceId, uid: userId }, type: 'SELECT' as any },
    );
    return Number(row?.cnt ?? 0);
  }

  async markRead(workspaceId: string, userId: string, id: string) {
    const n = await this.models.Notification.findOne({
      where: { id, workspace_id: workspaceId },
    });
    if (!n) throw new NotFoundError('Notification not found');
    if (n.user_id != null && n.user_id !== userId) {
      throw new NotFoundError('Notification not found');
    }
    if (n.read_at == null) await n.update({ read_at: new Date() });
    return n;
  }

  async markAllRead(workspaceId: string, userId: string) {
    const [count] = await this.models.Notification.sequelize!.query(
      `UPDATE notif_notifications
          SET read_at = NOW()
        WHERE workspace_id = :ws
          AND (user_id = :uid OR user_id IS NULL)
          AND read_at IS NULL`,
      { replacements: { ws: workspaceId, uid: userId } },
    );
    return { marked: Number((count as any).affectedRows ?? 0) };
  }

  publicNotification(n: any) {
    return {
      id: n.id,
      workspace_id: n.workspace_id,
      user_id: n.user_id,
      kind: n.kind,
      severity: n.severity,
      title: n.title,
      body: n.body,
      action_url: n.action_url,
      metadata: parseJsonField(n.metadata),
      read_at: n.read_at,
      from_service: n.from_service,
      created_at: n.created_at,
    };
  }
}

function parseJsonField<T>(value: T | string | null): T | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return value as unknown as T; }
  }
  return value;
}
