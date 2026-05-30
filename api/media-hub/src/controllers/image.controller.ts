import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { ImageService } from '../_services/image.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const generateSchema = Joi.object({
  prompt: Joi.string().min(4).max(4000).required(),
  size: Joi.string().valid('1024x1024', '1792x1024', '1024x1792').optional(),
  style: Joi.string().valid('natural', 'vivid').optional(),
  model: Joi.string().max(64).optional(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class ImageController {
  constructor(private imageService: ImageService) {}

  generate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = generateSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const image = await this.imageService.generate(ws, req.user!.id, value);
      res.status(201).json({ data: { image } });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const limit = parseInt((req.query.limit as string) ?? '25', 10);
      const offset = parseInt((req.query.offset as string) ?? '0', 10);
      const result = await this.imageService.list(ws, { limit, offset });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.imageService.remove(ws, req.params.image_id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
