import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { SendService } from '../_services/send.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const filterSchema = Joi.object({
  tag_includes: Joi.array().items(Joi.string()).optional(),
  tag_excludes: Joi.array().items(Joi.string()).optional(),
  lifecycle_in: Joi.array().items(Joi.string()).optional(),
  source_match: Joi.string().max(64).optional(),
});

const sendSchema = Joi.object({
  list_id: Joi.string().uuid().optional(),
  inline_filter: filterSchema.optional(),
  subject: Joi.string().min(1).max(998).required(),
  html: Joi.string().min(1).max(500_000).required(),
  text: Joi.string().max(500_000).optional(),
  utm: Joi.object({
    source: Joi.string().required(),
    medium: Joi.string().required(),
    campaign: Joi.string().required(),
  }).optional(),
  campaign_external_id: Joi.string().max(64).optional(),
}).or('list_id', 'inline_filter');

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

function workspaceFromServiceParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (req.service?.workspace_id && req.service.workspace_id !== param) {
    throw new ForbiddenError('Service token workspace mismatch');
  }
  return param;
}

export class SendController {
  constructor(private sendService: SendService) {}

  /** User-initiated send (dashboard "send test" button etc.). */
  send = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = sendSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const result = await this.sendService.sendCampaign({ workspace_id: ws, ...value });
      res.status(202).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  /** Service-to-service send (campaign-manager → email-hub). */
  sendInternal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = sendSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromServiceParams(req);
      const result = await this.sendService.sendCampaign({ workspace_id: ws, ...value });
      res.status(202).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const limit = parseInt((req.query.limit as string) ?? '25', 10);
      const offset = parseInt((req.query.offset as string) ?? '0', 10);
      const result = await this.sendService.listSends(ws, { limit, offset });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const send = await this.sendService.getSend(ws, req.params.send_id as string);
      if (!send) {
        res.status(404).json({ error: { code: 'not_found', message: 'Send not found', request_id: req.id } });
        return;
      }
      res.json({ data: { send } });
    } catch (err) {
      next(err);
    }
  };
}
