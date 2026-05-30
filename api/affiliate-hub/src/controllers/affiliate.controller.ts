import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { AffiliateService } from '../_services/affiliate.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const applySchema = Joi.object({
  program_id: Joi.string().uuid().required(),
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  full_name: Joi.string().max(255).optional(),
  payout_method: Joi.string().max(32).optional(),
  payout_details: Joi.object().unknown(true).optional(),
});

const statusSchema = Joi.object({
  status: Joi.string().valid('pending', 'approved', 'rejected', 'suspended').required(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class AffiliateController {
  constructor(private affiliateService: AffiliateService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const program_id = req.query.program_id as string | undefined;
      const status = req.query.status as string | undefined;
      const affiliates = await this.affiliateService.list(ws, { program_id, status });
      res.json({ data: { affiliates } });
    } catch (err) { next(err); }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const affiliate = await this.affiliateService.get(ws, req.params.affiliate_id as string);
      res.json({ data: { affiliate } });
    } catch (err) { next(err); }
  };

  /** PUBLIC — affiliate self-applies to a program. No auth required. */
  publicApply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = applySchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = req.params.workspace_id as string;
      const affiliate = await this.affiliateService.apply(ws, value);
      res.status(201).json({ data: { affiliate: { id: affiliate.id, status: affiliate.status } } });
    } catch (err) { next(err); }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = statusSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const affiliate = await this.affiliateService.updateStatus(ws, req.params.affiliate_id as string, value.status);
      res.json({ data: { affiliate } });
    } catch (err) { next(err); }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.affiliateService.remove(ws, req.params.affiliate_id as string);
      res.json({ data: result });
    } catch (err) { next(err); }
  };
}
