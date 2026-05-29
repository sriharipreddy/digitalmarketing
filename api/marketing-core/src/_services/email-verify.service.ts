import crypto from 'node:crypto';
import type { Models } from '../models/index.js';
import type { EmailDriver } from './email.driver.js';
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from '@marketing/shared-middleware';

const TOKEN_TTL_HOURS = 24;
const RESEND_COOLDOWN_SECONDS = 60;

export interface EmailVerifyServiceDeps {
  models: Models;
  emailDriver: EmailDriver;
  appBaseUrl: string;
  logger?: { info: (obj: unknown, msg?: string) => void };
}

export class EmailVerifyService {
  constructor(private deps: EmailVerifyServiceDeps) {}

  /** Generate a token, store on user, return token for sending. */
  async issueToken(userId: string): Promise<string> {
    const user = await this.deps.models.User.findByPk(userId);
    if (!user) throw new NotFoundError('User not found');
    if (user.email_verified) {
      throw new BadRequestError('Email is already verified');
    }
    if (user.verify_token_exp) {
      const last = new Date(user.verify_token_exp).getTime() - TOKEN_TTL_HOURS * 60 * 60 * 1000;
      const ageSec = (Date.now() - last) / 1000;
      if (ageSec < RESEND_COOLDOWN_SECONDS) {
        throw new BadRequestError(
          `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - ageSec)}s before requesting another link`,
        );
      }
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);
    await user.update({ verify_token: token, verify_token_exp: expires });
    return token;
  }

  async sendVerificationEmail(userId: string): Promise<{ sent: boolean; preview_link?: string }> {
    const user = await this.deps.models.User.findByPk(userId);
    if (!user) throw new NotFoundError('User not found');
    if (user.email_verified) {
      return { sent: false };
    }
    const token = await this.issueToken(userId);
    const link = `${this.deps.appBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;
    await this.deps.emailDriver.send({
      to: user.user_email,
      subject: 'Verify your email',
      text: `Hi ${user.full_name},\n\nClick the link to verify your email address:\n${link}\n\nThis link expires in ${TOKEN_TTL_HOURS} hours.\n\n— Marketing Platform`,
      html: `<p>Hi ${escapeHtml(user.full_name)},</p>
<p>Click the link to verify your email address:</p>
<p><a href="${link}">Verify my email</a></p>
<p>This link expires in ${TOKEN_TTL_HOURS} hours.</p>
<p>— Marketing Platform</p>`,
    });
    this.deps.logger?.info({ user_id: userId, email: user.user_email }, 'verification_email_sent');
    return { sent: true, preview_link: link };
  }

  async verify(token: string): Promise<{ user_id: string; email: string }> {
    if (!token || typeof token !== 'string' || token.length < 16) {
      throw new ValidationError('Invalid verification token', { token: ['Required'] });
    }
    const user = await this.deps.models.User.findOne({ where: { verify_token: token } });
    if (!user) throw new BadRequestError('Verification link is invalid or has already been used');
    if (!user.verify_token_exp || user.verify_token_exp < new Date()) {
      throw new BadRequestError('Verification link has expired');
    }
    await user.update({
      email_verified: true,
      verify_token: null,
      verify_token_exp: null,
      status: user.status === 'pending_verify' || user.status === 'invited' ? 'active' : user.status,
    });
    return { user_id: user.id, email: user.user_email };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[c]!;
  });
}
