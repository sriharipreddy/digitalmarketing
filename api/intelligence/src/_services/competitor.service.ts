import type { Models } from '../models/index.js';
import type { IntelligenceDriver } from './intelligence.driver.js';
import type { AdPlatform } from '../models/competitor-ad.model.js';
import {
  NotFoundError,
  ValidationError,
} from '@marketing/shared-middleware';

export class CompetitorService {
  constructor(
    private models: Models,
    private driver: IntelligenceDriver,
  ) {}

  async list(workspaceId: string) {
    const rows = await this.models.Competitor.findAll({
      where: { workspace_id: workspaceId },
      order: [['est_monthly_traffic', 'DESC']],
    });
    return rows.map((r) => this.publicCompetitor(r));
  }

  async get(workspaceId: string, id: string) {
    const c = await this.models.Competitor.findOne({ where: { id, workspace_id: workspaceId } });
    if (!c) throw new NotFoundError('Competitor not found');
    return c;
  }

  async create(workspaceId: string, userId: string, input: { name: string; domain: string }) {
    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError('Invalid name', { name: ['Required'] });
    }
    if (!input.domain || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input.domain.trim())) {
      throw new ValidationError('Invalid domain', { domain: ['Must be a domain like example.com'] });
    }
    const domain = input.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const existing = await this.models.Competitor.findOne({
      where: { workspace_id: workspaceId, domain },
    });
    if (existing) return this.publicCompetitor(existing);
    const row = await this.models.Competitor.create({
      workspace_id: workspaceId,
      name: input.name.trim(),
      domain,
      created_by: userId,
    } as any);
    return this.publicCompetitor(row);
  }

  async analyze(workspaceId: string, id: string) {
    const c = await this.get(workspaceId, id);
    const result = await this.driver.analyzeCompetitor(c.domain, c.name);
    await c.update({
      description: result.description,
      industry: result.industry,
      est_monthly_traffic: result.est_monthly_traffic,
      est_employee_count: result.est_employee_count,
      social_handles: result.social_handles,
      strengths: result.strengths,
      weaknesses: result.weaknesses,
      last_analyzed_at: new Date(),
    });
    return this.publicCompetitor(c);
  }

  async spyAds(workspaceId: string, id: string, platform: AdPlatform, limit: number) {
    const c = await this.get(workspaceId, id);
    const ads = await this.driver.spyAds(c.domain, platform, limit);
    const saved: any[] = [];
    for (const ad of ads) {
      const [row] = await this.models.CompetitorAd.upsert({
        workspace_id: workspaceId,
        competitor_id: c.id,
        platform: ad.platform,
        external_id: ad.external_id,
        creative_url: ad.creative_url,
        headline: ad.headline,
        body: ad.body,
        landing_url: ad.landing_url,
        first_seen_at: ad.first_seen_at,
        last_seen_at: ad.last_seen_at,
        est_spend_usd: ad.est_spend_usd,
        est_impressions: ad.est_impressions,
      } as any);
      saved.push(row);
    }
    return { saved: saved.length, ads: saved.map((r) => this.publicAd(r)) };
  }

  async listAds(workspaceId: string, opts: { competitor_id?: string; platform?: AdPlatform; limit?: number }) {
    const where: any = { workspace_id: workspaceId };
    if (opts.competitor_id) where.competitor_id = opts.competitor_id;
    if (opts.platform) where.platform = opts.platform;
    const rows = await this.models.CompetitorAd.findAll({
      where,
      order: [['last_seen_at', 'DESC']],
      limit: Math.min(opts.limit ?? 50, 200),
      include: [{ model: this.models.Competitor, as: 'competitor' }],
    });
    return rows.map((r) => this.publicAd(r));
  }

  async remove(workspaceId: string, id: string) {
    const c = await this.get(workspaceId, id);
    await this.models.CompetitorAd.destroy({ where: { competitor_id: c.id } });
    await c.destroy();
    return { id, removed: true };
  }

  private publicCompetitor(c: any) {
    return {
      id: c.id,
      workspace_id: c.workspace_id,
      name: c.name,
      domain: c.domain,
      description: c.description,
      industry: c.industry,
      est_monthly_traffic: c.est_monthly_traffic ? Number(c.est_monthly_traffic) : null,
      est_employee_count: c.est_employee_count,
      social_handles: parseJsonField(c.social_handles),
      strengths: parseJsonField(c.strengths),
      weaknesses: parseJsonField(c.weaknesses),
      last_analyzed_at: c.last_analyzed_at,
      created_at: c.created_at,
    };
  }

  private publicAd(a: any) {
    return {
      id: a.id,
      workspace_id: a.workspace_id,
      competitor_id: a.competitor_id,
      platform: a.platform,
      external_id: a.external_id,
      creative_url: a.creative_url,
      headline: a.headline,
      body: a.body,
      landing_url: a.landing_url,
      first_seen_at: a.first_seen_at,
      last_seen_at: a.last_seen_at,
      est_spend_usd: a.est_spend_usd != null ? Number(a.est_spend_usd) : null,
      est_impressions: a.est_impressions != null ? Number(a.est_impressions) : null,
      competitor: a.competitor ? { id: a.competitor.id, name: a.competitor.name, domain: a.competitor.domain } : null,
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
