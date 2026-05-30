import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { OutreachService } from '../_services/outreach.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const draftSchema = Joi.object({
  influencer_id: Joi.string().uuid().required(),
  channel: Joi.string().valid('email', 'dm', 'phone').optional(),
  campaign_brief: Joi.string().min(10).max(2000).required(),
});

const replySchema = Joi.object({
  summary: Joi.string().min(1).max(2000).required(),
  outcome: Joi.string().valid('replied', 'accepted', 'declined').required(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class OutreachController {
  constructor(private outreachService: OutreachService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const limit = parseInt((req.query.limit as string) ?? '50', 10);
      const offset = parseInt((req.query.offset as string) ?? '0', 10);
      const influencer_id = req.query.influencer_id as string | undefined;
      const result = await this.outreachService.list(ws, { limit, offset, influencer_id });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  draft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = draftSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const outreach = await this.outreachService.draft(ws, req.user!.id, value);
      res.status(201).json({ data: { outreach } });
    } catch (err) {
      next(err);
    }
  };

  send = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const outreach = await this.outreachService.send(ws, req.params.outreach_id as string);
      res.json({ data: { outreach } });
    } catch (err) {
      next(err);
    }
  };

  reply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = replySchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const outreach = await this.outreachService.markReply(
        ws,
        req.params.outreach_id as string,
        value.summary,
        value.outcome,
      );
      res.json({ data: { outreach } });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.outreachService.remove(ws, req.params.outreach_id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
