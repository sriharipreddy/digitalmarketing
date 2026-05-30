import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { PostService } from '../_services/post.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const createSchema = Joi.object({
  account_id: Joi.string().uuid().required(),
  content: Joi.string().min(1).max(10000).required(),
  media_urls: Joi.array().items(Joi.string().uri()).optional(),
  scheduled_at: Joi.alternatives().try(Joi.date(), Joi.allow(null)).optional(),
  campaign_external_id: Joi.string().max(64).optional(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class PostController {
  constructor(private postService: PostService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const limit = parseInt((req.query.limit as string) ?? '50', 10);
      const offset = parseInt((req.query.offset as string) ?? '0', 10);
      const status = req.query.status as string | undefined;
      const result = await this.postService.list(ws, { limit, offset, status });
      res.json({ data: result });
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
      const post = await this.postService.create(ws, req.user!.id, value);
      res.status(201).json({ data: { post } });
    } catch (err) {
      next(err);
    }
  };

  publish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const post = await this.postService.publishNow(ws, req.params.post_id as string);
      res.json({ data: { post } });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.postService.remove(ws, req.params.post_id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
