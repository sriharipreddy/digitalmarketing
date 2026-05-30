import crypto from 'node:crypto';
import type { SocialPlatform } from '../models/account.model.js';

export interface OAuthUrlResult {
  authorize_url: string;
  state: string;
}

export interface OAuthExchangeResult {
  external_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: Date | null;
  scopes: string[];
}

export interface OAuthDriver {
  platform: SocialPlatform;
  /** Build the platform's authorize URL the user will be redirected to. */
  authorizeUrl(opts: { workspace_id: string; redirect_uri: string }): OAuthUrlResult;
  /** Exchange the code returned in the callback for an account + tokens. */
  exchangeCode(code: string, state: string): Promise<OAuthExchangeResult>;
  /** Publish a post on this platform. Returns external_post_id + URL. */
  publish(opts: {
    access_token: string;
    content: string;
    media_urls?: string[];
  }): Promise<{ external_post_id: string; external_url: string }>;
}

/**
 * Stub driver — generates deterministic fake authorize URLs + accounts.
 * The "OAuth callback" route accepts any code and returns a fake account.
 * The "publish" returns a fake external_post_id without calling any platform.
 *
 * Replace with real per-platform drivers (RealMetaDriver, RealTwitterDriver, ...)
 * once OAuth apps are approved.
 */
export class StubOAuthDriver implements OAuthDriver {
  constructor(public platform: SocialPlatform) {}

  authorizeUrl(opts: { workspace_id: string; redirect_uri: string }): OAuthUrlResult {
    const state = crypto.randomBytes(16).toString('hex');
    // In stub mode we send the user back to the redirect URI with a fake "code"
    // so they don't actually leave the app. Real OAuth would go to the platform.
    const url = new URL(opts.redirect_uri);
    url.searchParams.set('code', `stub_code_${state}`);
    url.searchParams.set('state', state);
    url.searchParams.set('platform', this.platform);
    return { authorize_url: url.toString(), state };
  }

  async exchangeCode(code: string, _state: string): Promise<OAuthExchangeResult> {
    if (!code || !code.startsWith('stub_code_')) {
      throw new Error('Stub driver requires a stub_code_* code');
    }
    const suffix = code.slice(10, 18);
    return {
      external_id: `${this.platform}_${suffix}`,
      handle: `@stub_${this.platform}_${suffix}`,
      display_name: `Stub ${this.platform[0]?.toUpperCase()}${this.platform.slice(1)} ${suffix}`,
      avatar_url: null,
      access_token: `stub_token_${this.platform}_${suffix}`,
      refresh_token: `stub_refresh_${this.platform}_${suffix}`,
      expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      scopes: defaultScopes(this.platform),
    };
  }

  async publish(opts: { access_token: string; content: string; media_urls?: string[] }): Promise<{ external_post_id: string; external_url: string }> {
    if (!opts.access_token?.startsWith('stub_token_')) {
      throw new Error('Stub driver requires a stub_token_* access token');
    }
    const id = crypto.randomBytes(6).toString('hex');
    return {
      external_post_id: `${this.platform}_post_${id}`,
      external_url: `https://${this.platform}.example/posts/${id}`,
    };
  }
}

function defaultScopes(platform: SocialPlatform): string[] {
  switch (platform) {
    case 'facebook':
      return ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'];
    case 'instagram':
      return ['instagram_basic', 'instagram_content_publish', 'pages_show_list'];
    case 'twitter':
      return ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];
    case 'linkedin':
      return ['r_liteprofile', 'r_emailaddress', 'w_member_social'];
    case 'tiktok':
      return ['user.info.basic', 'video.publish'];
    case 'youtube':
      return ['youtube.readonly', 'youtube.upload'];
  }
}

export class OAuthDriverRegistry {
  private drivers = new Map<SocialPlatform, OAuthDriver>();

  register(driver: OAuthDriver): void {
    this.drivers.set(driver.platform, driver);
  }

  get(platform: SocialPlatform): OAuthDriver {
    const d = this.drivers.get(platform);
    if (!d) throw new Error(`No OAuth driver registered for platform: ${platform}`);
    return d;
  }

  registered(): SocialPlatform[] {
    return Array.from(this.drivers.keys());
  }
}
