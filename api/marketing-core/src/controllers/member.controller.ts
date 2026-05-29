import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { MemberService } from '../_services/member.service.js';
import type { AuditService } from '../_services/audit.service.js';
import { ValidationError } from '@marketing/shared-middleware';

const inviteSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  role: Joi.string().valid('editor', 'analyst', 'viewer').required(),
  full_name: Joi.string().min(2).max(255).optional(),
});

const updateRoleSchema = Joi.object({
  role: Joi.string().valid('editor', 'analyst', 'viewer').required(),
});

export class MemberController {
  constructor(
    private memberService: MemberService,
    private auditService: AuditService,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const workspace_id = req.params.workspace_id as string;
      const members = await this.memberService.list(workspace_id, req.user!.id);
      res.json({ data: { members } });
    } catch (err) {
      next(err);
    }
  };

  invite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = inviteSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(
          new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }),
        );
      }
      const workspace_id = req.params.workspace_id as string;
      const result = await this.memberService.invite(workspace_id, req.user!.id, value);

      this.auditService
        .record({
          workspace_id,
          actor_user_id: req.user!.id,
          action: 'member.invited',
          target_type: 'workspace_member',
          target_id: result.member.id,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'] as string,
          request_id: req.id,
          metadata: { invited_email: value.email, role: value.role },
        })
        .catch(() => undefined);

      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  acceptInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.body?.invite_token;
      if (!token || typeof token !== 'string') {
        return next(new ValidationError('Validation failed', { invite_token: ['Required'] }));
      }
      const member = await this.memberService.acceptInvite(token, req.user!.id);

      if (member) {
        this.auditService
          .record({
            workspace_id: member.workspace_id,
            actor_user_id: req.user!.id,
            action: 'member.joined',
            target_type: 'workspace_member',
            target_id: member.id,
            ip_address: req.ip,
            user_agent: req.headers['user-agent'] as string,
            request_id: req.id,
          })
          .catch(() => undefined);
      }

      res.json({ data: { member } });
    } catch (err) {
      next(err);
    }
  };

  updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = updateRoleSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(
          new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }),
        );
      }
      const workspace_id = req.params.workspace_id as string;
      const member_id = req.params.member_id as string;
      const member = await this.memberService.updateRole(
        workspace_id,
        req.user!.id,
        member_id,
        value.role,
      );

      this.auditService
        .record({
          workspace_id,
          actor_user_id: req.user!.id,
          action: 'member.role_changed',
          target_type: 'workspace_member',
          target_id: member_id,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'] as string,
          request_id: req.id,
          metadata: { new_role: value.role },
        })
        .catch(() => undefined);

      res.json({ data: { member } });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const workspace_id = req.params.workspace_id as string;
      const member_id = req.params.member_id as string;
      const result = await this.memberService.remove(workspace_id, req.user!.id, member_id);

      this.auditService
        .record({
          workspace_id,
          actor_user_id: req.user!.id,
          action: 'member.removed',
          target_type: 'workspace_member',
          target_id: member_id,
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
