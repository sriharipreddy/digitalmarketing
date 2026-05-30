import type { Models } from '../models/index.js';
import type { DiscoveryDriver, DiscoverInput } from './discovery.driver.js';
import type { InfluencerPlatform, InfluencerStatus } from '../models/influencer.model.js';
import {
  NotFoundError,
  ValidationError,
} from '@marketing/shared-middleware';

const VALID_STATUS: InfluencerStatus[] = ['discovered', 'shortlisted', 'contacted', 'negotiating', 'contracted', 'declined', 'paused'];

export class InfluencerService {
  constructor(
    private models: Models,
    private discoveryDriver: DiscoveryDriver,
  ) {}

  async discover(workspaceId: string, userId: string, input: DiscoverInput) {
    const results = await this.discoveryDriver.discover(input);
    // Save them as 'discovered' in the CRM, idempotent on (workspace, platform, handle).
    const saved: any[] = [];
    for (const r of results) {
      const existing = await this.models.Influencer.findOne({
        where: { workspace_id: workspaceId, platform: r.platform, handle: r.handle },
      });
      if (existing) {
        await existing.update({
          display_name: r.display_name,
          avatar_url: r.avatar_url,
          bio: r.bio,
          followers: r.followers,
          engagement_rate: r.engagement_rate,
          audience_country: r.audience_country,
          topics: r.topics,
          estimated_cost_usd: r.estimated_cost_usd,
          external_id: r.external_id,
        });
        saved.push(existing);
      } else {
        const row = await this.models.Influencer.create({
          workspace_id: workspaceId,
          platform: r.platform,
          handle: r.handle,
          display_name: r.display_name,
          avatar_url: r.avatar_url,
          bio: r.bio,
          followers: r.followers,
          engagement_rate: r.engagement_rate,
          audience_country: r.audience_country,
          topics: r.topics,
          estimated_cost_usd: r.estimated_cost_usd,
          external_id: r.external_id,
          status: 'discovered',
          created_by: userId,
        } as any);
        saved.push(row);
      }
    }
    return { discovered: saved.length, influencers: saved.map((r) => this.publicInfluencer(r)) };
  }

  async list(workspaceId: string, opts: { limit?: number; offset?: number; status?: string; platform?: InfluencerPlatform }) {
    const where: any = { workspace_id: workspaceId };
    if (opts.status) where.status = opts.status;
    if (opts.platform) where.platform = opts.platform;
    const { rows, count } = await this.models.Influencer.findAndCountAll({
      where,
      order: [['followers', 'DESC']],
      limit: Math.min(opts.limit ?? 50, 200),
      offset: opts.offset ?? 0,
    });
    return { rows: rows.map((r) => this.publicInfluencer(r)), total: count };
  }

  async get(workspaceId: string, id: string) {
    const inf = await this.models.Influencer.findOne({ where: { id, workspace_id: workspaceId } });
    if (!inf) throw new NotFoundError('Influencer not found');
    return inf;
  }

  async updateStatus(workspaceId: string, id: string, status: InfluencerStatus, notes?: string) {
    if (!VALID_STATUS.includes(status)) {
      throw new ValidationError('Invalid status', { status: [`Must be one of: ${VALID_STATUS.join(', ')}`] });
    }
    const inf = await this.get(workspaceId, id);
    await inf.update({ status, notes: notes ?? inf.notes });
    return this.publicInfluencer(inf);
  }

  async remove(workspaceId: string, id: string) {
    const inf = await this.get(workspaceId, id);
    await inf.destroy();
    return { id, removed: true };
  }

  publicInfluencer(r: any) {
    return {
      id: r.id,
      workspace_id: r.workspace_id,
      platform: r.platform,
      handle: r.handle,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
      bio: r.bio,
      followers: r.followers,
      engagement_rate: Number(r.engagement_rate),
      audience_country: r.audience_country,
      topics: parseJsonField(r.topics),
      estimated_cost_usd: r.estimated_cost_usd != null ? Number(r.estimated_cost_usd) : null,
      status: r.status,
      notes: r.notes,
      last_contacted_at: r.last_contacted_at,
      created_at: r.created_at,
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
