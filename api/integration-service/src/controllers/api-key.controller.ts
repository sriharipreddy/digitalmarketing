import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { ApiKeyService } from '../_services/api-key.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const createSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  scopes: Joi.array().items(Joi.string().max(64)).optional(),
  expires_at: Joi.alternatives().try(Joi.date(), Joi.allow(null)).optional(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class ApiKeyController {
  constructor(private apiKeyService: ApiKeyService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const keys = await this.apiKeyService.list(ws);
      res.json({ data: { keys: keys.map((k) => this.apiKeyService.publicApiKey(k)) } });
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = createSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const created = await this.apiKeyService.create(ws, req.user!.id, value);
      res.status(201).json({ data: { key: created } });
    } catch (err) { next(err); }
  };

  revoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const key = await this.apiKeyService.revoke(ws, req.params.key_id as string);
      res.json({ data: { key: this.apiKeyService.publicApiKey(key) } });
    } catch (err) { next(err); }
  };
}
