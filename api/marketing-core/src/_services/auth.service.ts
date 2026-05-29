import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import type { Sequelize } from 'sequelize';
import { ulid } from 'ulid';
import type { Models } from '../models/index.js';
import {
  ValidationError,
  UnauthorizedError,
  BadRequestError,
} from '@marketing/shared-middleware';
import type { JwtPayload, UserType } from '@marketing/shared-types';

export interface AuthServiceDeps {
  sequelize: Sequelize;
  models: Models;
  jwtSecret: string;
  accessTokenLifetime: string;
  refreshTokenTtlDays: number;
  bcryptRounds: number;
  /** Whether new registrations require email verification before login. */
  requireEmailVerification: boolean;
}

export class AuthService {
  constructor(private deps: AuthServiceDeps) {}

  async register(input: {
    full_name: string;
    email: string;
    password: string;
    workspace_name?: string;
  }): Promise<{ user: any; workspace?: any }> {
    const { User, Workspace, WorkspaceMember, Plan } = this.deps.models;

    const existing = await User.findOne({ where: { user_email: input.email } });
    if (existing) {
      throw new ValidationError('Email already registered', { email: ['Already in use'] });
    }

    const password_hash = await bcrypt.hash(input.password, this.deps.bcryptRounds);

    return this.deps.sequelize.transaction(async (t) => {
      const user = await User.create(
        {
          full_name: input.full_name,
          user_email: input.email,
          password_hash,
          type: 'client_owner' as UserType,
          status: this.deps.requireEmailVerification ? 'pending_verify' : 'active',
          email_verified: !this.deps.requireEmailVerification,
        } as any,
        { transaction: t },
      );

      let workspace: any = undefined;
      if (input.workspace_name) {
        const freePlan = await Plan.findOne({ where: { slug: 'free' }, transaction: t });
        workspace = await Workspace.create(
          {
            name: input.workspace_name,
            slug: await this.uniqueSlug(this.toSlug(input.workspace_name), t),
            owner_id: user.id,
            plan_id: freePlan?.id ?? null,
            status: 'trial',
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          } as any,
          { transaction: t },
        );
        await WorkspaceMember.create(
          {
            workspace_id: workspace.id,
            user_id: user.id,
            role: 'owner',
            status: 'active',
            joined_at: new Date(),
          } as any,
          { transaction: t },
        );
      }

      return { user, workspace };
    });
  }

  /**
   * Step 1 of login. If 2FA is enabled, returns { requires_2fa: true, challenge_token }
   * instead of issuing JWTs. Caller must then POST /auth/2fa/verify with the code + challenge.
   */
  async login(input: { email: string; password: string; ip?: string; userAgent?: string }): Promise<
    | {
        requires_2fa: true;
        challenge_token: string;
        user: { email: string; full_name: string };
      }
    | {
        requires_2fa?: false;
        access_token: string;
        refresh_token: string;
        expires_in: number;
        user: any;
        workspace: any;
      }
  > {
    const { User } = this.deps.models;

    const user = await User.findOne({ where: { user_email: input.email } });
    if (!user || !user.password_hash) throw new UnauthorizedError('Invalid email or password');

    const valid = await bcrypt.compare(input.password, user.password_hash);
    if (!valid) throw new UnauthorizedError('Invalid email or password');

    if (user.status === 'pending_verify' || !user.email_verified) {
      throw new BadRequestError('Please verify your email before signing in', 'email_not_verified');
    }
    if (user.status !== 'active') {
      throw new UnauthorizedError(`Account is ${user.status}`);
    }

    if (user.totp_required) {
      const challenge_token = this.signChallenge(user.id);
      return {
        requires_2fa: true,
        challenge_token,
        user: { email: user.user_email, full_name: user.full_name },
      };
    }

    return this.issueSessionTokens(user, { ip: input.ip, userAgent: input.userAgent });
  }

  /** Used after a successful 2FA challenge verification. */
  async completeLoginAfter2FA(
    userId: string,
    ctx: { ip?: string; userAgent?: string },
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: any;
    workspace: any;
  }> {
    const user = await this.deps.models.User.findByPk(userId);
    if (!user || user.status !== 'active') throw new UnauthorizedError('Account is not active');
    return this.issueSessionTokens(user, ctx);
  }

  signChallenge(userId: string): string {
    // Short-lived JWT marking the user passed password but still needs 2FA
    return jwt.sign({ sub: userId, kind: '2fa_challenge' }, this.deps.jwtSecret, {
      expiresIn: '5m',
    });
  }

  verifyChallenge(token: string): string {
    try {
      const decoded = jwt.verify(token, this.deps.jwtSecret) as any;
      if (decoded.kind !== '2fa_challenge' || !decoded.sub) {
        throw new UnauthorizedError('Invalid 2FA challenge');
      }
      return decoded.sub as string;
    } catch {
      throw new UnauthorizedError('Invalid or expired 2FA challenge');
    }
  }

  private async issueSessionTokens(
    user: any,
    ctx: { ip?: string; userAgent?: string },
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: any;
    workspace: any;
  }> {
    const { WorkspaceMember, Workspace, AuthSession } = this.deps.models;
    const member = await WorkspaceMember.findOne({
      where: { user_id: user.id, status: 'active' },
      include: [{ model: Workspace, as: 'workspace' }],
    });
    const workspace = (member as any)?.workspace ?? null;

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + this.deps.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

    await AuthSession.create({
      id: ulid(),
      user_id: user.id,
      workspace_id: workspace?.id ?? null,
      refresh_token: refreshToken,
      ip_address: ctx.ip,
      device_info: ctx.userAgent ? { user_agent: ctx.userAgent } : null,
      expires_at: expiresAt,
      last_used_at: new Date(),
    } as any);

    await user.update({ last_login_at: new Date() });

    const payload: JwtPayload = {
      id: user.id,
      type: user.type,
      workspace_id: workspace?.id,
      workspace_name: workspace?.name,
      agency_id: workspace?.agency_id,
      name: user.full_name,
      email: user.user_email,
      role: member?.role,
      permissions: [],
    };
    const accessToken = jwt.sign(payload, this.deps.jwtSecret, {
      expiresIn: this.deps.accessTokenLifetime as any,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900,
      user: this.publicUser(user),
      workspace: workspace ? this.publicWorkspace(workspace) : null,
    };
  }

  async refresh(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
    const { AuthSession, User, WorkspaceMember, Workspace } = this.deps.models;

    const session = await AuthSession.findOne({ where: { refresh_token: refreshToken } });
    if (!session || session.revoked_at || session.expires_at < new Date()) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const user = await User.findByPk(session.user_id);
    if (!user || user.status !== 'active') throw new UnauthorizedError('User is no longer active');

    const member = await WorkspaceMember.findOne({
      where: { user_id: user.id, status: 'active' },
      include: [{ model: Workspace, as: 'workspace' }],
    });
    const workspace = (member as any)?.workspace ?? null;

    const payload: JwtPayload = {
      id: user.id,
      type: user.type,
      workspace_id: workspace?.id,
      workspace_name: workspace?.name,
      name: user.full_name,
      email: user.user_email,
      role: member?.role,
      permissions: [],
    };
    const accessToken = jwt.sign(payload, this.deps.jwtSecret, {
      expiresIn: this.deps.accessTokenLifetime as any,
    });

    await session.update({ last_used_at: new Date() });

    return { access_token: accessToken, expires_in: 900 };
  }

  async logout(refreshToken: string): Promise<void> {
    const { AuthSession } = this.deps.models;
    const session = await AuthSession.findOne({ where: { refresh_token: refreshToken } });
    if (session && !session.revoked_at) {
      await session.update({ revoked_at: new Date() });
    }
  }

  private publicUser(u: any) {
    return {
      id: u.id,
      full_name: u.full_name,
      email: u.user_email,
      avatar_url: u.avatar_url,
      type: u.type,
    };
  }

  private publicWorkspace(w: any) {
    return {
      id: w.id,
      name: w.name,
      slug: w.slug,
      plan_id: w.plan_id,
      status: w.status,
      region: w.region,
    };
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100);
  }

  private async uniqueSlug(base: string, t: any): Promise<string> {
    const { Workspace } = this.deps.models;
    if (!base) base = 'workspace';
    let candidate = base;
    for (let i = 1; i < 100; i++) {
      const existing = await Workspace.findOne({ where: { slug: candidate }, transaction: t });
      if (!existing) return candidate;
      candidate = `${base}-${i}`;
    }
    return `${base}-${crypto.randomBytes(3).toString('hex')}`;
  }
}
