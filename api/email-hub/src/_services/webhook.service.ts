import crypto from 'node:crypto';
import type { Models } from '../models/index.js';
import type { AudienceService } from './audience.service.js';
import type { EmailEventKind } from '../models/event.model.js';

/**
 * Accepts SendGrid's Event Webhook payload (array of event objects).
 * Persists each event and applies side-effects:
 *   - bounce / dropped / spamreport → mark contact unsubscribed
 *   - unsubscribe / group_unsubscribe → mark contact unsubscribed
 *
 * SendGrid signs every webhook with ECDSA over the public verification key.
 * If a public key is configured, we verify; if not, we accept (dev mode).
 */
export class EmailWebhookService {
  constructor(
    private models: Models,
    private audienceService: AudienceService,
    private verificationKeyPem: string,
    private logger: { info: (obj: unknown, msg?: string) => void; warn: (obj: unknown, msg?: string) => void },
  ) {}

  /**
   * Verifies a SendGrid webhook signature. Returns true if no key is configured
   * (dev mode) or if the signature is valid.
   * Signature format: ECDSA over timestamp + raw body, base64-encoded.
   */
  verifySignature(rawBody: Buffer, signature: string | undefined, timestamp: string | undefined): boolean {
    if (!this.verificationKeyPem) {
      return true; // dev mode
    }
    if (!signature || !timestamp) return false;
    try {
      const verifier = crypto.createVerify('SHA256');
      verifier.update(timestamp + rawBody.toString('utf8'));
      verifier.end();
      return verifier.verify(this.verificationKeyPem, signature, 'base64');
    } catch (err) {
      this.logger.warn({ err: (err as Error).message }, 'webhook_signature_verify_failed');
      return false;
    }
  }

  async ingest(events: any[]): Promise<{ accepted: number; skipped: number }> {
    let accepted = 0;
    let skipped = 0;
    for (const raw of events) {
      try {
        const kind = (raw.event as string) as EmailEventKind;
        if (!kind) {
          skipped++;
          continue;
        }
        const sg_event_id = raw.sg_event_id ?? raw['sg_event_id'];
        const sg_message_id = raw.sg_message_id ?? null;
        const email = (raw.email as string | undefined)?.toLowerCase();
        const workspace_id = raw.workspace_id ?? null;
        const send_id = raw.send_id ?? null;
        if (!email) {
          skipped++;
          continue;
        }

        // Idempotency: skip if sg_event_id already stored
        if (sg_event_id) {
          const existing = await this.models.EmailEvent.findOne({ where: { sg_event_id } });
          if (existing) {
            skipped++;
            continue;
          }
        }

        await this.models.EmailEvent.create({
          workspace_id,
          send_id,
          contact_email: email,
          kind,
          url: raw.url ?? null,
          reason: raw.reason ?? raw.response ?? null,
          sg_message_id,
          sg_event_id: sg_event_id ?? null,
          timestamp: new Date((raw.timestamp ?? Math.floor(Date.now() / 1000)) * 1000),
          raw,
        } as any);

        // Side effects
        if (['unsubscribe', 'group_unsubscribe', 'bounce', 'dropped', 'spamreport'].includes(kind)) {
          await this.audienceService.markUnsubscribed(workspace_id, email);
        }

        // Update aggregate counters on EmailSend
        if (send_id) {
          const update = COUNTER_MAP[kind];
          if (update) {
            await this.models.EmailSend.increment({ [update]: 1 } as any, { where: { id: send_id } });
          }
        }

        accepted++;
      } catch (err) {
        this.logger.warn({ err: (err as Error).message, raw }, 'event_ingest_failed');
        skipped++;
      }
    }
    return { accepted, skipped };
  }
}

const COUNTER_MAP: Partial<Record<EmailEventKind, string>> = {
  open: 'opens',
  click: 'clicks',
  bounce: 'bounces',
  unsubscribe: 'unsubscribes',
  group_unsubscribe: 'unsubscribes',
};
