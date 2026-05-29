import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import type { Models } from '../models/index.js';
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from '@marketing/shared-middleware';

const ISSUER = 'Marketing Platform';

export interface TotpServiceDeps {
  models: Models;
  /** Hex string for AES-256-GCM secret encryption at rest (32 bytes hex from env). */
  encryptionKeyHex: string;
}

export class TotpService {
  private aesKey: Buffer;

  constructor(private deps: TotpServiceDeps) {
    if (!deps.encryptionKeyHex || deps.encryptionKeyHex.length !== 64) {
      throw new Error('TotpService requires a 32-byte (64-hex) encryption key');
    }
    this.aesKey = Buffer.from(deps.encryptionKeyHex, 'hex');
    authenticator.options = { window: 1 };
  }

  /**
   * Step 1 of enrolment: generate a secret, encrypt it, store on user as PROVISIONAL.
   * Returns the QR-code data URL + the raw secret for manual entry.
   * The secret is NOT activated yet — user must POST /2fa/confirm with a valid code.
   */
  async beginEnrollment(userId: string): Promise<{ qr_data_url: string; secret: string; otpauth_url: string }> {
    const user = await this.deps.models.User.findByPk(userId);
    if (!user) throw new NotFoundError('User not found');
    if (user.totp_required) {
      throw new BadRequestError('2FA is already enabled for this account');
    }
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.user_email, ISSUER, secret);
    const qr_data_url = await QRCode.toDataURL(otpauth);

    // Store encrypted but NOT yet active.
    await user.update({ totp_secret: this.encrypt(secret), totp_required: false });

    return { qr_data_url, secret, otpauth_url: otpauth };
  }

  /** Step 2: user enters a code from their app. If valid, activate 2FA. */
  async confirmEnrollment(userId: string, code: string): Promise<void> {
    const user = await this.deps.models.User.findByPk(userId);
    if (!user) throw new NotFoundError('User not found');
    if (!user.totp_secret) {
      throw new BadRequestError('No pending 2FA enrolment — start with /2fa/begin');
    }
    if (user.totp_required) {
      throw new BadRequestError('2FA is already enabled');
    }
    if (!this.validateCode(user.totp_secret, code)) {
      throw new ValidationError('Invalid 2FA code', { code: ['Code did not match'] });
    }
    await user.update({ totp_required: true });
  }

  /** Disable 2FA after the user re-enters their password + a valid TOTP. */
  async disable(userId: string, code: string): Promise<void> {
    const user = await this.deps.models.User.findByPk(userId);
    if (!user) throw new NotFoundError('User not found');
    if (!user.totp_required || !user.totp_secret) {
      throw new BadRequestError('2FA is not enabled');
    }
    if (!this.validateCode(user.totp_secret, code)) {
      throw new ValidationError('Invalid 2FA code', { code: ['Code did not match'] });
    }
    await user.update({ totp_required: false, totp_secret: null });
  }

  /** Used at login: verify a code against a user's stored secret. */
  async verifyLoginCode(userId: string, code: string): Promise<boolean> {
    const user = await this.deps.models.User.findByPk(userId);
    if (!user || !user.totp_required || !user.totp_secret) return false;
    return this.validateCode(user.totp_secret, code);
  }

  private validateCode(encryptedSecret: string, code: string): boolean {
    if (!/^\d{6}$/.test(code)) return false;
    const secret = this.decrypt(encryptedSecret);
    return authenticator.check(code, secret);
  }

  private encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.aesKey, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`;
  }

  private decrypt(payload: string): string {
    const [version, ivHex, tagHex, ctHex] = payload.split(':');
    if (version !== 'v1' || !ivHex || !tagHex || !ctHex) {
      throw new Error('Unrecognised TOTP secret format');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.aesKey, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]).toString('utf8');
  }
}
