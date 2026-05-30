import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { CommissionService } from '../_services/commission.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const recordSchema = Joi.object({
  affiliate_id: Joi.string().uuid().required(),
  tracking_link_id: Joi.string().uuid().optional(),
  order_external_id: Joi.string().max(255).required(),
  order_amount_usd: Joi.number().min(0).required(),
  customer_email: Joi.string().email({ tlds: { allow: false } }).optional(),
  metadata: Joi.object().unknown(true).optional(),
});

const transitionSchema = Joi.object({
  status: Joi.string().valid('approved', 'paid', 'reversed', 'rejected').required(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class CommissionController {
  constructor(private commissionService: CommissionService) {}

  record = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = recordSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const commission = await this.commissionService.record(ws, value);
      res.status(201).json({ data: { commission } });
    } catch (err) { next(err); }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const affiliate_id = req.query.affiliate_id as string | undefined;
      const status = req.query.status as string | undefined;
      const commissions = await this.commissionService.list(ws, { affiliate_id, status });
      res.json({ data: { commissions } });
    } catch (err) { next(err); }
  };

  transition = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = transitionSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const commission = await this.commissionService.transition(ws, req.params.commission_id as string, value.status);
      res.json({ data: { commission } });
    } catch (err) { next(err); }
  };

  summary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const totals = await this.commissionService.summary(ws);
      res.json({ data: { totals } });
    } catch (err) { next(err); }
  };
}
