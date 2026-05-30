import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { UtmService } from '../_services/utm.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const createSchema = Joi.object({
  destination_url: Joi.string().uri({ scheme: ['http', 'https'] }).max(2000).required(),
  source: Joi.string().max(64).required(),
  medium: Joi.string().max(64).required(),
  campaign: Joi.string().max(255).required(),
  term: Joi.string().max(255).allow('').optional(),
  content: Joi.string().max(255).allow('').optional(),
  campaign_id: Joi.string().uuid().optional(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class UtmController {
  constructor(private utmService: UtmService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const limit = parseInt((req.query.limit as string) ?? '50', 10);
      const offset = parseInt((req.query.offset as string) ?? '0', 10);
      const campaign_id = req.query.campaign_id as string | undefined;
      const result = await this.utmService.list(ws, { limit, offset, campaign_id });
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
      const link = await this.utmService.create(ws, req.user!.id, value);
      res.status(201).json({ data: { link } });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.utmService.remove(ws, req.params.link_id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  /** PUBLIC redirect handler — /u/:short_code → 302 to the destination. */
  publicRedirect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const code = req.params.short_code as string;
      const dest = await this.utmService.resolveClick(code);
      if (!dest) {
        res.status(404).send('Link not found');
        return;
      }
      res.redirect(302, dest);
    } catch (err) {
      next(err);
    }
  };
}
