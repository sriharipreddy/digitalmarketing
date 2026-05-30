import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { ContactService } from '../_services/contact.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const createSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).optional(),
  first_name: Joi.string().max(100).allow('').optional(),
  last_name: Joi.string().max(100).allow('').optional(),
  phone: Joi.string().max(50).allow('').optional(),
  company: Joi.string().max(255).allow('').optional(),
  lifecycle_stage: Joi.string()
    .valid('subscriber', 'lead', 'mql', 'sql', 'customer', 'evangelist', 'churned')
    .optional(),
  source: Joi.string().max(64).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  custom_fields: Joi.object().unknown(true).optional(),
}).or('email', 'phone');

const updateSchema = Joi.object({
  first_name: Joi.string().max(100).allow('').optional(),
  last_name: Joi.string().max(100).allow('').optional(),
  phone: Joi.string().max(50).allow('').optional(),
  company: Joi.string().max(255).allow('').optional(),
  lifecycle_stage: Joi.string()
    .valid('subscriber', 'lead', 'mql', 'sql', 'customer', 'evangelist', 'churned')
    .optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  custom_fields: Joi.object().unknown(true).optional(),
  lead_score: Joi.number().integer().min(0).max(1000).optional(),
}).min(1);

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class ContactController {
  constructor(private contactService: ContactService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const limit = parseInt((req.query.limit as string) ?? '50', 10);
      const offset = parseInt((req.query.offset as string) ?? '0', 10);
      const stage = req.query.stage as string | undefined;
      const result = await this.contactService.list(ws, { limit, offset, stage });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const contact = await this.contactService.get(ws, req.params.contact_id as string);
      res.json({ data: { contact } });
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
      const contact = await this.contactService.create(ws, value);
      res.status(201).json({ data: { contact } });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = updateSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const contact = await this.contactService.update(ws, req.params.contact_id as string, value);
      res.json({ data: { contact } });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.contactService.remove(ws, req.params.contact_id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
