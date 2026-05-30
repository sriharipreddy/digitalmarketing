import crypto from 'node:crypto';
import type { Models } from '../models/index.js';
import { NotFoundError, ValidationError } from '@marketing/shared-middleware';

export interface UtmInput {
  destination_url: string;
  source: string;
  medium: string;
  campaign: string;
  term?: string;
  content?: string;
  campaign_id?: string;
}

export class UtmService {
  constructor(private models: Models) {}

  async list(workspaceId: string, opts: { limit?: number; offset?: number; campaign_id?: string }) {
    const where: any = { workspace_id: workspaceId };
    if (opts.campaign_id) where.campaign_id = opts.campaign_id;
    const { rows, count } = await this.models.UtmLink.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Math.min(opts.limit ?? 50, 200),
      offset: opts.offset ?? 0,
    });
    return { rows, total: count };
  }

  async create(workspaceId: string, userId: string, input: UtmInput) {
    this.validate(input);
    const short_code = await this.uniqueCode();
    const built = this.buildUrl(input);
    return this.models.UtmLink.create({
      workspace_id: workspaceId,
      campaign_id: input.campaign_id ?? null,
      short_code,
      destination_url: built,
      source: input.source,
      medium: input.medium,
      campaign: input.campaign,
      term: input.term ?? null,
      content: input.content ?? null,
      created_by: userId,
    } as any);
  }

  async remove(workspaceId: string, id: string) {
    const link = await this.models.UtmLink.findOne({ where: { id, workspace_id: workspaceId } });
    if (!link) throw new NotFoundError('UTM link not found');
    await link.destroy();
    return { id, removed: true };
  }

  /** Resolve a short_code to the full UTM-tagged URL, atomically increment click_count. */
  async resolveClick(short_code: string): Promise<string | null> {
    const link = await this.models.UtmLink.findOne({ where: { short_code } });
    if (!link) return null;
    await link.increment('click_count', { by: 1 });
    return link.destination_url;
  }

  private validate(input: UtmInput) {
    if (!/^https?:\/\//i.test(input.destination_url)) {
      throw new ValidationError('Invalid destination URL', {
        destination_url: ['Must start with http:// or https://'],
      });
    }
    for (const k of ['source', 'medium', 'campaign'] as const) {
      if (!input[k] || input[k].trim().length === 0) {
        throw new ValidationError(`Missing ${k}`, { [k]: ['Required'] });
      }
    }
  }

  private buildUrl(input: UtmInput): string {
    const url = new URL(input.destination_url);
    url.searchParams.set('utm_source', input.source);
    url.searchParams.set('utm_medium', input.medium);
    url.searchParams.set('utm_campaign', input.campaign);
    if (input.term) url.searchParams.set('utm_term', input.term);
    if (input.content) url.searchParams.set('utm_content', input.content);
    return url.toString();
  }

  private async uniqueCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const candidate = crypto.randomBytes(5).toString('base64url').slice(0, 8);
      const exists = await this.models.UtmLink.findOne({ where: { short_code: candidate } });
      if (!exists) return candidate;
    }
    throw new Error('Could not generate a unique UTM short_code');
  }
}
