import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { FormService } from '../_services/form.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const fieldSchema = Joi.object({
  name: Joi.string().regex(/^[a-z][a-z0-9_]*$/).max(64).required(),
  label: Joi.string().max(120).required(),
  type: Joi.string().valid('text', 'email', 'tel', 'textarea', 'select', 'checkbox').required(),
  required: Joi.boolean().optional(),
  options: Joi.array().items(Joi.string()).optional(),
});

const createSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  description: Joi.string().max(1000).allow('').optional(),
  fields: Joi.array().items(fieldSchema).min(1).required(),
  on_submit_tags: Joi.array().items(Joi.string()).optional(),
  on_submit_lifecycle: Joi.string().valid('subscriber', 'lead', 'mql').optional(),
  success_message: Joi.string().max(500).optional(),
  slug: Joi.string().regex(/^[a-z0-9-]+$/).max(64).optional(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class FormController {
  constructor(private formService: FormService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const forms = await this.formService.list(ws);
      res.json({ data: { forms } });
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
      const form = await this.formService.create(ws, value);
      res.status(201).json({ data: { form } });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.formService.remove(ws, req.params.form_id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  /** PUBLIC — slug lookup so the form can be rendered on a landing page. */
  publicGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const form = await this.formService.getBySlug(req.params.slug as string);
      res.json({
        data: {
          slug: form.slug,
          name: form.name,
          description: form.description,
          fields: form.fields,
          success_message: form.success_message,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /** PUBLIC — accept a submission, upsert contact. No auth required. */
  publicSubmit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const slug = req.params.slug as string;
      const result = await this.formService.submit(slug, req.body ?? {}, {
        ip: req.ip,
        user_agent: req.headers['user-agent'] as string,
      });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
