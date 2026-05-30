import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { InfluencerService } from '../_services/influencer.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const discoverSchema = Joi.object({
  platform: Joi.string().valid('instagram', 'tiktok', 'youtube', 'twitter', 'linkedin').required(),
  topic: Joi.string().min(2).max(64).optional(),
  country: Joi.string().length(2).uppercase().optional(),
  min_followers: Joi.number().integer().min(0).optional(),
  max_followers: Joi.number().integer().min(1).optional(),
  min_engagement_rate: Joi.number().min(0).max(1).optional(),
  limit: Joi.number().integer().min(1).max(50).optional(),
});

const updateSchema = Joi.object({
  status: Joi.string()
    .valid('discovered', 'shortlisted', 'contacted', 'negotiating', 'contracted', 'declined', 'paused')
    .required(),
  notes: Joi.string().max(8000).allow('').optional(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class InfluencerController {
  constructor(private influencerService: InfluencerService) {}

  discover = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = discoverSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const result = await this.influencerService.discover(ws, req.user!.id, {
        ...value,
        limit: value.limit ?? 10,
      });
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const limit = parseInt((req.query.limit as string) ?? '50', 10);
      const offset = parseInt((req.query.offset as string) ?? '0', 10);
      const status = req.query.status as string | undefined;
      const platform = req.query.platform as any;
      const result = await this.influencerService.list(ws, { limit, offset, status, platform });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const inf = await this.influencerService.get(ws, req.params.influencer_id as string);
      res.json({ data: { influencer: this.influencerService.publicInfluencer(inf) } });
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
      const inf = await this.influencerService.updateStatus(
        ws,
        req.params.influencer_id as string,
        value.status,
        value.notes,
      );
      res.json({ data: { influencer: inf } });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.influencerService.remove(ws, req.params.influencer_id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
