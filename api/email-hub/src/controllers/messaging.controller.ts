import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { MessagingService } from '../_services/messaging.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const sendSchema = Joi.object({
  channel: Joi.string().valid('sms', 'whatsapp', 'push').required(),
  to: Joi.string().min(1).max(255).required(),
  body: Joi.string().min(1).max(4000).required(),
  from: Joi.string().max(255).allow(null, '').optional(),
  template_external_id: Joi.string().max(255).allow(null, '').optional(),
  metadata: Joi.object().unknown(true).optional(),
  recipient_timezone: Joi.string().max(64).optional(),
});

const suppressSchema = Joi.object({
  channel: Joi.string().valid('sms', 'whatsapp', 'push').required(),
  address: Joi.string().min(1).max(255).required(),
  reason: Joi.string().max(500).allow(null, '').optional(),
});

const inboundSchema = Joi.object({
  channel: Joi.string().valid('sms', 'whatsapp', 'push').required(),
  from: Joi.string().min(1).max(255).required(),
  body: Joi.string().min(1).max(4000).required(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class MessagingController {
  constructor(private messaging: MessagingService) {}

  send = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = sendSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const row = await this.messaging.send(ws, value);
      res.status(202).json({ data: { message: row } });
    } catch (err) { next(err); }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const channel = req.query.channel as any;
      const limit = parseInt((req.query.limit as string) ?? '100', 10);
      const rows = await this.messaging.list(ws, { channel, limit });
      res.json({ data: { messages: rows } });
    } catch (err) { next(err); }
  };

  listSuppressions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const channel = req.query.channel as any;
      const rows = await this.messaging.listSuppressions(ws, channel);
      res.json({ data: { suppressions: rows } });
    } catch (err) { next(err); }
  };

  suppress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = suppressSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const row = await this.messaging.suppress(ws, value.channel, value.address, value.reason ?? 'manual');
      res.status(201).json({ data: { suppression: row } });
    } catch (err) { next(err); }
  };

  unsuppress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = suppressSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      await this.messaging.unsuppress(ws, value.channel, value.address);
      res.status(204).end();
    } catch (err) { next(err); }
  };

  /** Inbound webhook from SMS/WhatsApp provider — handles STOP/HELP/START. */
  inbound = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = inboundSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const result = await this.messaging.handleInbound(ws, value.channel, value.from, value.body);
      res.json({ data: result });
    } catch (err) { next(err); }
  };
}
