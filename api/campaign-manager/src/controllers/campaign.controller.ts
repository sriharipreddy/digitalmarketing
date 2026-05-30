import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { CampaignService } from '../_services/campaign.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const channelSchema = Joi.object({
  kind: Joi.string()
    .valid('email', 'sms', 'push', 'facebook', 'instagram', 'linkedin', 'twitter', 'tiktok', 'google_ads')
    .required(),
  config: Joi.object().unknown(true).required(),
});

const createSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  description: Joi.string().max(1000).allow('').optional(),
  kind: Joi.string().valid('email', 'social', 'multi_channel', 'one_click').required(),
  goal: Joi.string().max(255).allow('').optional(),
  channels: Joi.array().items(channelSchema).optional(),
});

const updateSchema = Joi.object({
  name: Joi.string().min(2).max(255).optional(),
  description: Joi.string().max(1000).allow('').optional(),
  goal: Joi.string().max(255).allow('').optional(),
  status: Joi.string().valid('draft', 'paused', 'cancelled').optional(),
  scheduled_at: Joi.alternatives().try(Joi.date(), Joi.allow(null)).optional(),
}).min(1);

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class CampaignController {
  constructor(private campaignService: CampaignService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const limit = parseInt((req.query.limit as string) ?? '50', 10);
      const offset = parseInt((req.query.offset as string) ?? '0', 10);
      const status = req.query.status as string | undefined;
      const result = await this.campaignService.list(ws, { limit, offset, status });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const campaign = await this.campaignService.get(ws, req.params.campaign_id as string);
      res.json({ data: { campaign } });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = createSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const campaign = await this.campaignService.create(ws, req.user!.id, value);
      res.status(201).json({ data: { campaign } });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = updateSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const campaign = await this.campaignService.update(ws, req.params.campaign_id as string, value);
      res.json({ data: { campaign } });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.campaignService.remove(ws, req.params.campaign_id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  dispatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.campaignService.dispatch(ws, req.params.campaign_id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
