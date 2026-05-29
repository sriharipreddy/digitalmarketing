import type { Models } from '../models/index.js';

export interface AuditEntry {
  workspace_id?: string | null;
  actor_user_id?: string | null;
  actor_type?: 'user' | 'system' | 'api_key';
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  request_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class AuditService {
  constructor(private models: Models) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.models.AuditLog.create({
      workspace_id: entry.workspace_id ?? null,
      actor_user_id: entry.actor_user_id ?? null,
      actor_type: entry.actor_type ?? 'user',
      action: entry.action,
      target_type: entry.target_type ?? null,
      target_id: entry.target_id ?? null,
      ip_address: entry.ip_address ?? null,
      user_agent: entry.user_agent ?? null,
      request_id: entry.request_id ?? null,
      metadata: entry.metadata ?? null,
    } as any);
  }

  async list(opts: {
    workspace_id: string;
    limit?: number;
    offset?: number;
    action?: string;
    target_type?: string;
  }) {
    const where: any = { workspace_id: opts.workspace_id };
    if (opts.action) where.action = opts.action;
    if (opts.target_type) where.target_type = opts.target_type;
    const { rows, count } = await this.models.AuditLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Math.min(opts.limit ?? 50, 200),
      offset: opts.offset ?? 0,
    });
    return { rows, total: count };
  }
}
