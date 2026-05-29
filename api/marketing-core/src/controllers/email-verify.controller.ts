import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { EmailVerifyService } from '../_services/email-verify.service.js';
import type { AuditService } from '../_services/audit.service.js';
import { ValidationError } from '@marketing/shared-middleware';
import type { Models } from '../models/index.js';

const resendSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
});

const verifySchema = Joi.object({
  token: Joi.string().min(16).required(),
});

export class EmailVerifyController {
  constructor(
    private emailVerifyService: EmailVerifyService,
    private auditService: AuditService,
    private models: Models,
  ) {}

  /** Public: resend verification email. Idempotent; rate-limited per user. */
  resend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = resendSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(
          new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }),
        );
      }
      const user = await this.models.User.findOne({ where: { user_email: value.email } });
      // Always 200 to avoid email enumeration
      if (!user) {
        res.json({ data: { sent: true } });
        return;
      }
      if (user.email_verified) {
        res.json({ data: { sent: false, already_verified: true } });
        return;
      }
      try {
        const result = await this.emailVerifyService.sendVerificationEmail(user.id);
        res.json({ data: { sent: result.sent, preview_link: result.preview_link } });
      } catch (sendErr: any) {
        if (sendErr.code === 'bad_request') {
          res.status(429).json({ error: { code: 'rate_limited', message: sendErr.message, request_id: req.id } });
          return;
        }
        throw sendErr;
      }
    } catch (err) {
      next(err);
    }
  };

  /** Public: verify the token. */
  verify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = verifySchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(
          new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }),
        );
      }
      const result = await this.emailVerifyService.verify(value.token);

      this.auditService
        .record({
          actor_user_id: result.user_id,
          action: 'user.email_verified',
          target_type: 'user',
          target_id: result.user_id,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'] as string,
          request_id: req.id,
        })
        .catch(() => undefined);

      res.json({ data: { verified: true, email: result.email } });
    } catch (err) {
      next(err);
    }
  };
}
