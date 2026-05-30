import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { TrackingLinkService } from '../_services/tracking-link.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const createSchema = Joi.object({
  affiliate_id: Joi.string().uuid().required(),
  destination_url: Joi.string().uri({ scheme: ['http', 'https'] }).max(2000).required(),
  label: Joi.string().max(255).optional(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class TrackingLinkController {
  constructor(
    private trackingLinkService: TrackingLinkService,
    private cookieDays: number,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const affiliate_id = req.query.affiliate_id as string | undefined;
      const links = await this.trackingLinkService.list(ws, { affiliate_id });
      res.json({ data: { links } });
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = createSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const link = await this.trackingLinkService.create(ws, value);
      res.status(201).json({ data: { link } });
    } catch (err) { next(err); }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.trackingLinkService.remove(ws, req.params.link_id as string);
      res.json({ data: result });
    } catch (err) { next(err); }
  };

  /** PUBLIC redirect — /a/:short_code → 302 with attribution cookie. */
  publicRedirect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const code = req.params.short_code as string;
      const result = await this.trackingLinkService.resolveClick(code);
      if (!result) {
        res.status(404).send('Link not found');
        return;
      }
      // Set attribution cookie. SameSite=Lax + HttpOnly so it survives the cross-site
      // redirect but isn't readable by the destination site's JS.
      res.cookie('aff_attr', `${result.workspace_id}:${result.affiliate_id}:${result.tracking_link_id}`, {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.secure,
        maxAge: this.cookieDays * 24 * 60 * 60 * 1000,
        path: '/',
      });
      res.redirect(302, result.destination_url);
    } catch (err) { next(err); }
  };
}
