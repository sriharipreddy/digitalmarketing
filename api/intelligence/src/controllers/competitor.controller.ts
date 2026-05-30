import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { CompetitorService } from '../_services/competitor.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const createSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  domain: Joi.string().min(4).max(255).required(),
});

const spySchema = Joi.object({
  platform: Joi.string().valid('meta', 'google', 'linkedin', 'tiktok').required(),
  limit: Joi.number().integer().min(1).max(50).optional(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class CompetitorController {
  constructor(private competitorService: CompetitorService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const competitors = await this.competitorService.list(ws);
      res.json({ data: { competitors } });
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
      const competitor = await this.competitorService.create(ws, req.user!.id, value);
      res.status(201).json({ data: { competitor } });
    } catch (err) {
      next(err);
    }
  };

  analyze = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const competitor = await this.competitorService.analyze(ws, req.params.competitor_id as string);
      res.json({ data: { competitor } });
    } catch (err) {
      next(err);
    }
  };

  spyAds = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = spySchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const result = await this.competitorService.spyAds(
        ws,
        req.params.competitor_id as string,
        value.platform,
        value.limit ?? 10,
      );
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  listAds = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const competitor_id = req.query.competitor_id as string | undefined;
      const platform = req.query.platform as any;
      const limit = parseInt((req.query.limit as string) ?? '50', 10);
      const ads = await this.competitorService.listAds(ws, { competitor_id, platform, limit });
      res.json({ data: { ads } });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.competitorService.remove(ws, req.params.competitor_id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
