import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import type { Models } from '../models/index.js';

interface DeliveryResponse {
  status: number;
  body: string;
}

function postRaw(targetUrl: string, body: string, headers: Record<string, string>, timeoutMs: number): Promise<DeliveryResponse> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(targetUrl);
    } catch (e) {
      reject(new Error('invalid_target_url'));
      return;
    }
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      {
        method: 'POST',
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body).toString() },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8').slice(0, 1900) });
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.write(body);
    req.end();
  });
}

export interface DeliveryWorkerOpts {
  models: Models;
  maxAttempts: number;
  initialDelayMs: number;
  backoffFactor: number;
  pollIntervalMs?: number;
  concurrency?: number;
  logger: {
    info: (obj: unknown, msg?: string) => void;
    warn: (obj: unknown, msg?: string) => void;
    error: (obj: unknown, msg?: string) => void;
  };
}

/**
 * Background worker that polls integration_webhook_deliveries for `pending` rows
 * whose `next_attempt_at` is due, signs the payload, POSTs to the target URL,
 * and bumps attempt counters / schedules the next retry on failure.
 *
 * Retry schedule (default): exponential 5s, 20s, 80s, 5m, 20m, 80m, 5h.
 * After WEBHOOK_MAX_ATTEMPTS the delivery moves to `dead_letter`.
 */
export class DeliveryWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private pollIntervalMs: number;
  private concurrency: number;

  constructor(private opts: DeliveryWorkerOpts) {
    this.pollIntervalMs = opts.pollIntervalMs ?? 5_000;
    this.concurrency = opts.concurrency ?? 5;
  }

  start(): void {
    if (this.timer) return;
    this.tick().catch((err) => this.opts.logger.error({ err: err.message }, 'delivery_worker_tick_failed'));
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
    this.opts.logger.info({ poll_ms: this.pollIntervalMs, concurrency: this.concurrency }, 'delivery_worker_started');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.opts.models.WebhookDelivery.findAll({
        where: { status: 'pending' },
        order: [['next_attempt_at', 'ASC']],
        limit: this.concurrency * 4,
      });
      // Filter in JS for "next_attempt_at IS NULL OR <= NOW()" without dragging in Op.
      const now = Date.now();
      const ready = due.filter((d: any) => !d.next_attempt_at || new Date(d.next_attempt_at).getTime() <= now);
      if (ready.length === 0) return;

      // Process up to `concurrency` in parallel
      const batches: any[][] = [];
      for (let i = 0; i < ready.length; i += this.concurrency) {
        batches.push(ready.slice(i, i + this.concurrency));
      }
      for (const batch of batches) {
        await Promise.all(batch.map((d) => this.attempt(d)));
      }
    } finally {
      this.running = false;
    }
  }

  private async attempt(delivery: any): Promise<void> {
    // Re-fetch + lock semantics: mark in_flight first so concurrent workers skip it.
    await delivery.update({ status: 'in_flight', last_attempt_at: new Date() });

    const webhook = await this.opts.models.Webhook.findByPk(delivery.webhook_id);
    if (!webhook || webhook.status !== 'active') {
      await delivery.update({ status: 'failed', error: webhook ? `webhook_${webhook.status}` : 'webhook_missing' });
      return;
    }

    const ts = Math.floor(Date.now() / 1000).toString();
    // delivery.payload comes from a JSON column. Sequelize-MySQL returns it as a string in some
    // configurations; ensure we always sign and send the SAME canonical JSON bytes either way.
    const payloadObj = typeof delivery.payload === 'string' ? JSON.parse(delivery.payload) : delivery.payload;
    const bodyStr = JSON.stringify(payloadObj);
    const sig = crypto.createHmac('sha256', webhook.secret).update(`${ts}.${bodyStr}`).digest('hex');

    try {
      const res = await postRaw(webhook.target_url, bodyStr, {
        'Content-Type': 'application/json',
        'X-Marketing-Event': delivery.event_kind,
        'X-Marketing-Event-Id': delivery.event_id,
        'X-Marketing-Timestamp': ts,
        'X-Marketing-Signature': sig,
        'User-Agent': 'marketing-platform-webhooks/1.0',
      }, 10_000);

      const newAttempts = delivery.attempts + 1;
      if (res.status >= 200 && res.status < 300) {
        await delivery.update({
          status: 'succeeded',
          attempts: newAttempts,
          response_status: res.status,
          response_body: res.body,
          delivered_at: new Date(),
          error: null,
        });
        await webhook.update({ last_delivery_at: new Date(), consecutive_failures: 0 });
      } else {
        await this.scheduleRetry(delivery, webhook, newAttempts, `HTTP ${res.status}`, res.status, res.body);
      }
    } catch (e: any) {
      const newAttempts = delivery.attempts + 1;
      await this.scheduleRetry(delivery, webhook, newAttempts, e.message ?? 'unknown error', null, null);
    }
  }

  private async scheduleRetry(delivery: any, webhook: any, attempts: number, error: string, status: number | null, body: string | null): Promise<void> {
    if (attempts >= this.opts.maxAttempts) {
      await delivery.update({
        status: 'dead_letter',
        attempts,
        response_status: status,
        response_body: body,
        error,
      });
      await webhook.update({ consecutive_failures: webhook.consecutive_failures + 1 });
      // Auto-disable webhook after enough consecutive failures
      if (webhook.consecutive_failures + 1 >= 20) {
        await webhook.update({ status: 'paused' });
      }
      this.opts.logger.warn({ delivery_id: delivery.id, attempts, error }, 'webhook_dead_letter');
      return;
    }
    const delay = this.opts.initialDelayMs * Math.pow(this.opts.backoffFactor, attempts - 1);
    const next = new Date(Date.now() + delay);
    await delivery.update({
      status: 'pending',
      attempts,
      next_attempt_at: next,
      response_status: status,
      response_body: body,
      error,
    });
    await webhook.update({ consecutive_failures: webhook.consecutive_failures + 1 });
  }
}

