import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { WorkspaceService } from '../_services/workspace.service.js';
import type { AuditService } from '../_services/audit.service.js';
import { ValidationError } from '@marketing/shared-middleware';

const updateSchema = Joi.object({
  name: Joi.string().min(2).max(255).optional(),
  timezone: Joi.string().max(50).optional(),
  industry: Joi.string().max(100).optional(),
  country: Joi.string().length(2).uppercase().optional(),
  logo_url: Joi.string().uri().max(500).optional(),
}).min(1);

const createSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  timezone: Joi.string().max(50).optional(),
  industry: Joi.string().max(100).optional(),
  country: Joi.string().length(2).uppercase().optional(),
});

export class WorkspaceController {
  constructor(
    private workspaceService: WorkspaceService,
    private auditService: AuditService,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const memberships = await this.workspaceService.listForUser(userId);
      res.json({ data: { memberships } });
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
      const result = await this.workspaceService.create(req.user!.id, value);
      const wsId = result.workspace!.id;
      await this.auditService.record({
        workspace_id: wsId,
        actor_user_id: req.user!.id,
        actor_type: 'user',
        action: 'workspace.created',
        target_type: 'workspace',
        target_id: wsId,
        request_id: req.id,
        ip_address: req.ip ?? null,
        user_agent: req.get('user-agent') ?? null,
      });
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const workspace_id = req.params.workspace_id as string;
      const result = await this.workspaceService.get(workspace_id, req.user!.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = updateSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(
          new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }),
        );
      }
      const workspace_id = req.params.workspace_id as string;
      const result = await this.workspaceService.update(workspace_id, req.user!.id, value);

      this.auditService
        .record({
          workspace_id,
          actor_user_id: req.user!.id,
          action: 'workspace.updated',
          target_type: 'workspace',
          target_id: workspace_id,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'] as string,
          request_id: req.id,
          metadata: { changed_fields: Object.keys(value) },
        })
        .catch(() => undefined);

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  requestDeletion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const workspace_id = req.params.workspace_id as string;
      const result = await this.workspaceService.requestDeletion(workspace_id, req.user!.id);

      this.auditService
        .record({
          workspace_id,
          actor_user_id: req.user!.id,
          action: 'workspace.deletion_requested',
          target_type: 'workspace',
          target_id: workspace_id,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'] as string,
          request_id: req.id,
        })
        .catch(() => undefined);

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
