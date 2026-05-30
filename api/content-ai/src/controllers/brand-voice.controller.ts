import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { BrandVoiceService } from '../_services/brand-voice.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const createSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).allow('').optional(),
  tone: Joi.string().max(50).optional(),
  style: Joi.string().max(100).allow('').optional(),
  sample_text: Joi.string().max(8000).allow('').optional(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class BrandVoiceController {
  constructor(private brandVoiceService: BrandVoiceService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const voices = await this.brandVoiceService.list(ws);
      res.json({ data: { voices } });
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
      const voice = await this.brandVoiceService.create(ws, value);
      res.status(201).json({ data: { voice } });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.brandVoiceService.remove(ws, req.params.voice_id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
