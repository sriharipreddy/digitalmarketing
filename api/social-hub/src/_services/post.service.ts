import type { Models } from '../models/index.js';
import type { AccountService } from './account.service.js';
import type { OAuthDriverRegistry } from './oauth.driver.js';
import {
  NotFoundError,
  BadRequestError,
  ValidationError,
} from '@marketing/shared-middleware';

// Platform-level character caps (rough — keep up to date).
const CONTENT_CAPS: Record<string, number> = {
  twitter: 280,
  linkedin: 3000,
  facebook: 63206,
  instagram: 2200,
  tiktok: 2200,
  youtube: 5000,
};

export interface PostCreateInput {
  account_id: string;
  content: string;
  media_urls?: string[];
  scheduled_at?: Date | null;
  campaign_external_id?: string;
}

export class PostService {
  constructor(
    private models: Models,
    private accountService: AccountService,
    private oauthRegistry: OAuthDriverRegistry,
  ) {}

  async list(workspaceId: string, opts: { limit?: number; offset?: number; status?: string }) {
    const where: any = { workspace_id: workspaceId };
    if (opts.status) where.status = opts.status;
    const { rows, count } = await this.models.SocialPost.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Math.min(opts.limit ?? 50, 200),
      offset: opts.offset ?? 0,
    });
    return { rows: rows.map((r) => this.publicPost(r)), total: count };
  }

  async get(workspaceId: string, id: string) {
    const post = await this.models.SocialPost.findOne({ where: { id, workspace_id: workspaceId } });
    if (!post) throw new NotFoundError('Post not found');
    return post;
  }

  async create(workspaceId: string, userId: string, input: PostCreateInput) {
    if (!input.content || input.content.trim().length === 0) {
      throw new ValidationError('Content required', { content: ['Required'] });
    }
    const account = await this.accountService.get(workspaceId, input.account_id);
    const cap = CONTENT_CAPS[account.platform];
    if (cap && input.content.length > cap) {
      throw new ValidationError(`Content exceeds ${account.platform} character limit`, {
        content: [`Max ${cap} chars (got ${input.content.length})`],
      });
    }

    const isScheduled = !!input.scheduled_at && new Date(input.scheduled_at) > new Date();
    const post = await this.models.SocialPost.create({
      workspace_id: workspaceId,
      account_id: account.id,
      platform: account.platform,
      content: input.content,
      media_urls: input.media_urls ?? null,
      scheduled_at: input.scheduled_at ?? null,
      status: isScheduled ? 'scheduled' : 'draft',
      campaign_external_id: input.campaign_external_id ?? null,
      created_by: userId,
    } as any);
    return this.publicPost(post);
  }

  async publishNow(workspaceId: string, id: string) {
    const post = await this.get(workspaceId, id);
    if (['publishing', 'published'].includes(post.status)) {
      throw new BadRequestError(`Post is already ${post.status}`);
    }
    const { platform, access_token } = await this.accountService.getAccessToken(workspaceId, post.account_id);
    const driver = this.oauthRegistry.get(platform);

    await post.update({ status: 'publishing' });
    try {
      const result = await driver.publish({
        access_token,
        content: post.content,
        media_urls: post.media_urls ?? undefined,
      });
      await post.update({
        status: 'published',
        published_at: new Date(),
        external_post_id: result.external_post_id,
        external_url: result.external_url,
        error: null,
      });
    } catch (e: any) {
      await post.update({ status: 'failed', error: e.message?.slice(0, 1900) ?? 'unknown' });
      throw e;
    }
    return this.publicPost(post);
  }

  async remove(workspaceId: string, id: string) {
    const post = await this.get(workspaceId, id);
    if (post.status === 'publishing') {
      throw new BadRequestError('Cannot delete a post that is currently publishing');
    }
    await post.destroy();
    return { id, removed: true };
  }

  private publicPost(p: any) {
    return {
      id: p.id,
      workspace_id: p.workspace_id,
      account_id: p.account_id,
      platform: p.platform,
      content: p.content,
      media_urls: parseJsonField(p.media_urls),
      scheduled_at: p.scheduled_at,
      published_at: p.published_at,
      external_post_id: p.external_post_id,
      external_url: p.external_url,
      status: p.status,
      error: p.error,
      created_at: p.created_at,
    };
  }
}

function parseJsonField<T>(value: T | string | null): T | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }
  return value;
}
