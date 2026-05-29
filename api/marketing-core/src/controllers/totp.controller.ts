import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { TotpService } from '../_services/totp.service.js';
import type { AuthService } from '../_services/auth.service.js';
import type { AuditService } from '../_services/audit.service.js';
import { ValidationError } from '@marketing/shared-middleware';

const codeSchema = Joi.object({ code: Joi.string().length(6).pattern(/^\d{6}$/).required() });
const loginVerifySchema = Joi.object({
  challenge_token: Joi.string().required(),
  code: Joi.string().length(6).pattern(/^\d{6}$/).required(),
});

export class TotpController {
  constructor(
    private totpService: TotpService,
    private authService: AuthService,
    private auditService: AuditService,
    private cookieDomain: string,
    private refreshCookieMaxAge: number,
    private isProduction: boolean,
  ) {}

  /** POST /2fa/begin (authenticated) — start enrolment, return QR + secret. */
  begin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.totpService.beginEnrollment(req.user!.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  /** POST /2fa/confirm (authenticated) — user submits code from app, 2FA goes live. */
  confirm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = codeSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(
          new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }),
        );
      }
      await this.totpService.confirmEnrollment(req.user!.id, value.code);
      this.auditService
        .record({
          actor_user_id: req.user!.id,
          action: 'user.2fa_enabled',
          target_type: 'user',
          target_id: req.user!.id,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'] as string,
          request_id: req.id,
        })
        .catch(() => undefined);
      res.json({ data: { enabled: true } });
    } catch (err) {
      next(err);
    }
  };

  /** POST /2fa/disable (authenticated) — user submits valid code to disable. */
  disable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = codeSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(
          new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }),
        );
      }
      await this.totpService.disable(req.user!.id, value.code);
      this.auditService
        .record({
          actor_user_id: req.user!.id,
          action: 'user.2fa_disabled',
          target_type: 'user',
          target_id: req.user!.id,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'] as string,
          request_id: req.id,
        })
        .catch(() => undefined);
      res.json({ data: { enabled: false } });
    } catch (err) {
      next(err);
    }
  };

  /** POST /auth/2fa/verify (PUBLIC) — login step 2. Returns access/refresh tokens. */
  loginVerify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = loginVerifySchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(
          new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }),
        );
      }
      const userId = this.authService.verifyChallenge(value.challenge_token);
      const ok = await this.totpService.verifyLoginCode(userId, value.code);
      if (!ok) {
        return next(new ValidationError('Invalid 2FA code', { code: ['Code did not match'] }));
      }
      const tokens = await this.authService.completeLoginAfter2FA(userId, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.cookie('refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: this.isProduction,
        sameSite: 'lax',
        domain: this.cookieDomain || undefined,
        path: '/api/v1/core/auth',
        maxAge: this.refreshCookieMaxAge,
      });
      const { refresh_token, ...safe } = tokens;
      void refresh_token;
      res.json({ data: safe });
    } catch (err) {
      next(err);
    }
  };
}
