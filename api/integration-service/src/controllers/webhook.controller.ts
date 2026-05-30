import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { WebhookService } from '../_services/webhook.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const createSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  target_url: Joi.string().uri({ scheme: ['http', 'https'] }).max(2000).required(),
  event_kinds: Joi.array().items(Joi.string().max(64)).min(1).required(),
});

const updateSchema = Joi.object({
  status: Joi.string().valid('active', 'paused', 'disabled').optional(),
  event_kinds: Joi.array().items(Joi.string().max(64)).min(1).optional(),
  target_url: Joi.string().uri({ scheme: ['http', 'https'] }).max(2000).optional(),
}).min(1);

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const webhooks = await this.webhookService.list(ws);
      res.json({ data: { webhooks: webhooks.map((w) => this.webhookService.publicWebhook(w)) } });
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = createSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const w = await this.webhookService.create(ws, req.user!.id, value);
      // Show the secret ONCE on creation (subsequent reads expose last 4 only).
      res.status(201).json({
        data: {
          webhook: this.webhookService.publicWebhook(w),
          /** Save this — we won't show it again. */
          signing_secret: w.secret,
        },
      });
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = updateSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const w = await this.webhookService.update(ws, req.params.webhook_id as string, value);
      res.json({ data: { webhook: this.webhookService.publicWebhook(w) } });
    } catch (err) { next(err); }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.webhookService.remove(ws, req.params.webhook_id as string);
      res.json({ data: result });
    } catch (err) { next(err); }
  };

  listDeliveries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const webhook_id = req.query.webhook_id as string | undefined;
      const status = req.query.status as string | undefined;
      const limit = parseInt((req.query.limit as string) ?? '100', 10);
      const rows = await this.webhookService.listDeliveries(ws, { webhook_id, status, limit });
      res.json({ data: { deliveries: rows.map((d) => this.webhookService.publicDelivery(d)) } });
    } catch (err) { next(err); }
  };
}
