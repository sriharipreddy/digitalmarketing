import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { KeywordService } from '../_services/keyword.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const researchSchema = Joi.object({
  seed: Joi.string().min(2).max(255).required(),
  country: Joi.string().length(2).optional(),
  language: Joi.string().length(2).optional(),
  limit: Joi.number().integer().min(1).max(50).optional(),
});

const saveSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        keyword: Joi.string().min(1).max(255).required(),
        search_volume: Joi.number().allow(null),
        difficulty: Joi.number().allow(null),
        cpc: Joi.number().allow(null),
        intent: Joi.string().valid('informational', 'navigational', 'transactional', 'commercial').allow(null),
        country: Joi.string().length(2).optional(),
        language: Joi.string().length(2).optional(),
        tags: Joi.array().items(Joi.string()).optional(),
      }),
    )
    .min(1)
    .required(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class KeywordController {
  constructor(private keywordService: KeywordService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const limit = parseInt((req.query.limit as string) ?? '50', 10);
      const offset = parseInt((req.query.offset as string) ?? '0', 10);
      const q = req.query.q as string | undefined;
      const result = await this.keywordService.list(ws, { limit, offset, q });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  research = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = researchSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const result = await this.keywordService.research(ws, value);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  save = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = saveSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const result = await this.keywordService.save(ws, value.items);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.keywordService.remove(ws, req.params.keyword_id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
