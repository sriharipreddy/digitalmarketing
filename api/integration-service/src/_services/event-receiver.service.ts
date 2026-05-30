import crypto from 'node:crypto';
import type { Models } from '../models/index.js';
import type { WebhookService } from './webhook.service.js';

export interface IncomingEvent {
  workspace_id: string;
  /** Optional client-supplied id for idempotency. Otherwise we generate one. */
  event_id?: string;
  kind: string;
  payload: Record<string, unknown>;
}

export class EventReceiverService {
  constructor(
    private models: Models,
    private webhookService: WebhookService,
  ) {}

  /**
   * Fan an incoming event out to every webhook in the workspace whose
   * event_kinds list matches. Creates one delivery row per match; the
   * delivery worker picks them up + signs + POSTs.
   *
   * Idempotency: (webhook_id, event_id) has a unique constraint.
   */
  async receive(event: IncomingEvent): Promise<{ enqueued: number; skipped: number }> {
    const event_id = event.event_id ?? crypto.randomUUID();
    const webhooks = await this.models.Webhook.findAll({
      where: { workspace_id: event.workspace_id, status: 'active' },
    });

    let enqueued = 0;
    let skipped = 0;
    for (const w of webhooks) {
      const eventKinds = parseJsonField<string[]>(w.event_kinds) ?? [];
      if (!this.webhookService.matchesEventKind(eventKinds, event.kind)) {
        continue;
      }
      try {
        await this.models.WebhookDelivery.create({
          workspace_id: event.workspace_id,
          webhook_id: w.id,
          event_id,
          event_kind: event.kind,
          payload: { id: event_id, kind: event.kind, workspace_id: event.workspace_id, data: event.payload, created_at: new Date().toISOString() },
          status: 'pending',
          attempts: 0,
          next_attempt_at: new Date(),
        } as any);
        enqueued++;
      } catch (e: any) {
        // Unique-constraint violation on (webhook_id, event_id) → idempotent skip
        if (e.name === 'SequelizeUniqueConstraintError') {
          skipped++;
        } else {
          throw e;
        }
      }
    }
    return { enqueued, skipped };
  }
}

function parseJsonField<T>(value: T | string | null): T | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return value as unknown as T; }
  }
  return value;
}
