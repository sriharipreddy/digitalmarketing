import type { Request, Response, NextFunction } from 'express';
import type { EmailWebhookService } from '../_services/webhook.service.js';

export class EmailWebhookController {
  constructor(private webhookService: EmailWebhookService) {}

  /** POST /webhooks/sendgrid — body is RAW. */
  receive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawBody = (req.body as Buffer) ?? Buffer.alloc(0);
      const signature = req.headers['x-twilio-email-event-webhook-signature'] as string | undefined;
      const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string | undefined;
      const ok = this.webhookService.verifySignature(rawBody, signature, timestamp);
      if (!ok) {
        res.status(401).json({ error: { code: 'bad_signature', message: 'Webhook signature failed', request_id: req.id } });
        return;
      }
      let events: any[];
      try {
        events = JSON.parse(rawBody.toString('utf8'));
        if (!Array.isArray(events)) events = [events];
      } catch {
        res.status(400).json({ error: { code: 'bad_request', message: 'Invalid JSON', request_id: req.id } });
        return;
      }
      const result = await this.webhookService.ingest(events);
      res.json({ received: events.length, ...result });
    } catch (err) {
      next(err);
    }
  };
}
