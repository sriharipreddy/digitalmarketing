import crypto from 'node:crypto';
import type { Models } from '../models/index.js';
import { NotFoundError, ValidationError } from '@marketing/shared-middleware';
import type { WebhookStatus } from '../models/webhook.model.js';

export class WebhookService {
  constructor(private models: Models) {}

  async list(workspaceId: string) {
    return this.models.Webhook.findAll({
      where: { workspace_id: workspaceId },
      order: [['created_at', 'DESC']],
    });
  }

  async create(workspaceId: string, userId: string, input: {
    name: string;
    target_url: string;
    event_kinds: string[];
  }) {
    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError('Invalid name', { name: ['Required'] });
    }
    if (!/^https?:\/\//.test(input.target_url)) {
      throw new ValidationError('Invalid target URL', { target_url: ['Must be http(s)'] });
    }
    if (!Array.isArray(input.event_kinds) || input.event_kinds.length === 0) {
      throw new ValidationError('event_kinds required', { event_kinds: ['Must include at least one event kind'] });
    }
    const secret = `whsec_${crypto.randomBytes(24).toString('base64url')}`;
    return this.models.Webhook.create({
      workspace_id: workspaceId,
      name: input.name.trim(),
      target_url: input.target_url,
      secret,
      event_kinds: input.event_kinds,
      status: 'active',
      consecutive_failures: 0,
      created_by: userId,
    } as any);
  }

  async update(workspaceId: string, id: string, patch: { status?: WebhookStatus; event_kinds?: string[]; target_url?: string }) {
    const w = await this.models.Webhook.findOne({ where: { id, workspace_id: workspaceId } });
    if (!w) throw new NotFoundError('Webhook not found');
    const update: Record<string, unknown> = {};
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.event_kinds !== undefined) update.event_kinds = patch.event_kinds;
    if (patch.target_url !== undefined) {
      if (!/^https?:\/\//.test(patch.target_url)) {
        throw new ValidationError('Invalid target URL', { target_url: ['Must be http(s)'] });
      }
      update.target_url = patch.target_url;
    }
    if (Object.keys(update).length > 0) await w.update(update);
    return w;
  }

  async remove(workspaceId: string, id: string) {
    const w = await this.models.Webhook.findOne({ where: { id, workspace_id: workspaceId } });
    if (!w) throw new NotFoundError('Webhook not found');
    await this.models.WebhookDelivery.destroy({ where: { webhook_id: id } });
    await w.destroy();
    return { id, removed: true };
  }

  async listDeliveries(workspaceId: string, opts: { webhook_id?: string; status?: string; limit?: number }) {
    const where: any = { workspace_id: workspaceId };
    if (opts.webhook_id) where.webhook_id = opts.webhook_id;
    if (opts.status) where.status = opts.status;
    return this.models.WebhookDelivery.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Math.min(opts.limit ?? 100, 500),
      include: [{ model: this.models.Webhook, as: 'webhook' }],
    });
  }

  /** Returns true if the webhook should fire for this event kind. */
  matchesEventKind(subscribed: string[], eventKind: string): boolean {
    return subscribed.includes('*') || subscribed.includes(eventKind);
  }

  publicWebhook(w: any) {
    return {
      id: w.id,
      workspace_id: w.workspace_id,
      name: w.name,
      target_url: w.target_url,
      // secret is shown once at create time only; subsequent reads expose only last 4
      secret_last4: typeof w.secret === 'string' ? w.secret.slice(-4) : null,
      event_kinds: parseJsonField(w.event_kinds),
      status: w.status,
      last_delivery_at: w.last_delivery_at,
      consecutive_failures: w.consecutive_failures,
      created_at: w.created_at,
    };
  }

  publicDelivery(d: any) {
    return {
      id: d.id,
      webhook_id: d.webhook_id,
      event_id: d.event_id,
      event_kind: d.event_kind,
      status: d.status,
      attempts: d.attempts,
      last_attempt_at: d.last_attempt_at,
      next_attempt_at: d.next_attempt_at,
      response_status: d.response_status,
      error: d.error,
      delivered_at: d.delivered_at,
      created_at: d.created_at,
      webhook: d.webhook ? { id: d.webhook.id, name: d.webhook.name, target_url: d.webhook.target_url } : null,
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
