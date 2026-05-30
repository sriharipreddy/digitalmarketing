import type { Models } from '../models/index.js';
import type { TokenCrypto } from '../_helpers/encryption.js';
import type { OAuthDriverRegistry } from './oauth.driver.js';
import type { SocialPlatform } from '../models/account.model.js';
import { NotFoundError, BadRequestError } from '@marketing/shared-middleware';

export class AccountService {
  constructor(
    private models: Models,
    private crypto: TokenCrypto,
    private oauthRegistry: OAuthDriverRegistry,
  ) {}

  async list(workspaceId: string) {
    const rows = await this.models.SocialAccount.findAll({
      where: { workspace_id: workspaceId },
      order: [['created_at', 'DESC']],
    });
    return rows.map((r) => this.publicAccount(r));
  }

  async get(workspaceId: string, id: string) {
    const account = await this.models.SocialAccount.findOne({
      where: { id, workspace_id: workspaceId },
    });
    if (!account) throw new NotFoundError('Account not found');
    return account;
  }

  async startConnect(workspaceId: string, platform: SocialPlatform, redirectUri: string) {
    const driver = this.oauthRegistry.get(platform);
    const result = driver.authorizeUrl({ workspace_id: workspaceId, redirect_uri: redirectUri });
    return result;
  }

  async finishConnect(
    workspaceId: string,
    userId: string,
    platform: SocialPlatform,
    code: string,
    state: string,
  ) {
    const driver = this.oauthRegistry.get(platform);
    const exchange = await driver.exchangeCode(code, state);

    const existing = await this.models.SocialAccount.findOne({
      where: { workspace_id: workspaceId, platform, external_id: exchange.external_id },
    });

    const payload = {
      workspace_id: workspaceId,
      platform,
      external_id: exchange.external_id,
      handle: exchange.handle,
      display_name: exchange.display_name,
      avatar_url: exchange.avatar_url,
      access_token_encrypted: this.crypto.encrypt(exchange.access_token),
      refresh_token_encrypted: exchange.refresh_token ? this.crypto.encrypt(exchange.refresh_token) : null,
      token_expires_at: exchange.expires_at,
      scopes: exchange.scopes,
      status: 'connected' as const,
      last_error: null,
      connected_by: userId,
    };

    let account;
    if (existing) {
      await existing.update(payload);
      account = existing;
    } else {
      account = await this.models.SocialAccount.create(payload as any);
    }
    return this.publicAccount(account);
  }

  async disconnect(workspaceId: string, id: string) {
    const account = await this.get(workspaceId, id);
    await account.destroy();
    return { id, removed: true };
  }

  /** Decrypts and returns access token + platform for the publish path. */
  async getAccessToken(workspaceId: string, accountId: string): Promise<{ platform: SocialPlatform; access_token: string; account: any }> {
    const account = await this.get(workspaceId, accountId);
    if (account.status !== 'connected') {
      throw new BadRequestError(`Account is ${account.status} — reconnect to publish`);
    }
    const token = this.crypto.decrypt(account.access_token_encrypted);
    return { platform: account.platform, access_token: token, account };
  }

  private publicAccount(a: any) {
    return {
      id: a.id,
      workspace_id: a.workspace_id,
      platform: a.platform,
      external_id: a.external_id,
      handle: a.handle,
      display_name: a.display_name,
      avatar_url: a.avatar_url,
      status: a.status,
      scopes: parseJsonField(a.scopes),
      last_error: a.last_error,
      created_at: a.created_at,
    };
  }
}

function parseJsonField<T>(value: T | string): T {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }
  return value;
}
