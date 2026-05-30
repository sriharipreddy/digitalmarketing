import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { GenerationService } from '../_services/generation.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const generateSchema = Joi.object({
  kind: Joi.string().valid('blog', 'social', 'email', 'ad_copy', 'headline').required(),
  prompt: Joi.string().min(4).max(8000).required(),
  brand_voice_id: Joi.string().uuid().optional(),
  model: Joi.string().max(64).optional(),
  max_tokens: Joi.number().integer().min(50).max(4000).optional(),
  temperature: Joi.number().min(0).max(2).optional(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class GenerationController {
  constructor(private generationService: GenerationService) {}

  generate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = generateSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const result = await this.generationService.generate(ws, req.user!.id, value);
      res.status(201).json({
        data: {
          generation: {
            id: result.generation.id,
            kind: result.generation.kind,
            output: result.generation.output,
            model: result.generation.model,
            prompt_tokens: result.generation.prompt_tokens,
            completion_tokens: result.generation.completion_tokens,
            total_tokens: result.generation.total_tokens,
            cost_usd: result.generation.cost_usd,
            created_at: result.generation.created_at,
          },
          quota: result.quota,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  listRecent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const limit = parseInt((req.query.limit as string) ?? '25', 10);
      const offset = parseInt((req.query.offset as string) ?? '0', 10);
      const result = await this.generationService.listRecent(ws, { limit, offset });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
