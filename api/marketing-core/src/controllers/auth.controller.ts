import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { AuthService } from '../_services/auth.service.js';
import type { EmailVerifyService } from '../_services/email-verify.service.js';
import { ValidationError } from '@marketing/shared-middleware';

const registerSchema = Joi.object({
  full_name: Joi.string().min(2).max(255).required(),
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(12).required(),
  workspace_name: Joi.string().min(2).max(255).optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().required(),
});

export class AuthController {
  constructor(
    private authService: AuthService,
    private emailVerifyService: EmailVerifyService,
    private cookieDomain: string,
    private refreshCookieMaxAge: number,
    private isProduction: boolean,
    private requireEmailVerification: boolean,
  ) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
      if (error) {
        next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
        return;
      }
      const result = await this.authService.register(value);

      let preview_link: string | undefined;
      if (this.requireEmailVerification) {
        try {
          const sent = await this.emailVerifyService.sendVerificationEmail(result.user.id);
          preview_link = sent.preview_link;
        } catch {
          // Don't fail registration if email send fails; user can request resend.
        }
      }

      res.status(201).json({
        data: {
          ...result,
          email_verification_required: this.requireEmailVerification,
          email_verification_preview_link: preview_link,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
      if (error) {
        next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
        return;
      }
      const result = await this.authService.login({
        ...value,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      if ('requires_2fa' in result && result.requires_2fa) {
        res.status(200).json({ data: result });
        return;
      }

      res.cookie('refresh_token', result.refresh_token, {
        httpOnly: true,
        secure: this.isProduction,
        sameSite: 'lax',
        domain: this.cookieDomain || undefined,
        path: '/api/v1/core/auth',
        maxAge: this.refreshCookieMaxAge,
      });

      const { refresh_token, ...safe } = result;
      void refresh_token;
      res.status(200).json({ data: safe });
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cookieToken = req.cookies?.refresh_token as string | undefined;
      const bodyToken = req.body?.refresh_token as string | undefined;
      const token = cookieToken || bodyToken;
      if (!token) {
        res.status(401).json({
          error: { code: 'authentication_required', message: 'Missing refresh token', request_id: req.id },
        });
        return;
      }
      const result = await this.authService.refresh(token);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.cookies?.refresh_token as string | undefined;
      if (token) await this.authService.logout(token);
      res.clearCookie('refresh_token', { path: '/api/v1/core/auth' });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ data: { user: req.user, workspace_id: req.workspaceId } });
  };
}
