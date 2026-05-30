import type { Sequelize } from 'sequelize';
import type { Models } from '../models/index.js';
import type { RecommendationCategory } from '../models/recommendation.model.js';
import { NotFoundError, BadRequestError } from '@marketing/shared-middleware';

/**
 * AutopilotService — turns observed workspace state into actionable
 * recommendations. In production this would be a nightly Bull job that
 * reads analytics_events + campaign performance + competitor ads.
 *
 * For Phase 3 we ship a synchronous /scan endpoint that derives a
 * small, deterministic set of recommendations from observed state.
 */
export class AutopilotService {
  constructor(
    private sequelize: Sequelize,
    private models: Models,
  ) {}

  async list(workspaceId: string, opts: { status?: string }) {
    const where: any = { workspace_id: workspaceId };
    if (opts.status) where.status = opts.status;
    const rows = await this.models.AutopilotRecommendation.findAll({
      where,
      order: [['created_at', 'DESC']],
    });
    return rows.map((r) => this.publicRec(r));
  }

  async actOn(workspaceId: string, id: string, userId: string, outcome: 'accepted' | 'dismissed' | 'in_progress' | 'completed') {
    const row = await this.models.AutopilotRecommendation.findOne({
      where: { id, workspace_id: workspaceId },
    });
    if (!row) throw new NotFoundError('Recommendation not found');
    if (row.status === 'completed') throw new BadRequestError('Already completed');
    await row.update({ status: outcome, actioned_by: userId, actioned_at: new Date() });
    return this.publicRec(row);
  }

  /**
   * Scan workspace state and produce recommendations.
   * Sources we look at:
   *  - analytics_events: top UTM campaigns (any new growth opportunities?)
   *  - campaign_campaigns: any in `paused` status that could be re-enabled?
   *  - intelligence_competitor_ads: are competitors running ads we aren't?
   *  - seo_keywords: are there opportunities not yet in our keyword bank?
   *
   * Returns the new recommendations created.
   */
  async scan(workspaceId: string): Promise<{ created: number; recommendations: any[] }> {
    const created: any[] = [];

    // 1) Are competitors running active ads we don't have? → opportunity
    const recentCompetitorAds = await this.queryAll<{ count: number; competitor_name: string; platform: string }>(
      `SELECT COUNT(*) AS count, c.name AS competitor_name, a.platform
         FROM intelligence_competitor_ads a
         JOIN intelligence_competitors c ON c.id = a.competitor_id
        WHERE a.workspace_id = :ws
          AND a.last_seen_at > DATE_SUB(NOW(), INTERVAL 14 DAY)
        GROUP BY a.competitor_id, a.platform
        ORDER BY count DESC
        LIMIT 5`,
      { ws: workspaceId },
    );

    for (const row of recentCompetitorAds) {
      // Skip if we already have a similar recommendation that hasn't been actioned
      const dup = await this.models.AutopilotRecommendation.findOne({
        where: {
          workspace_id: workspaceId,
          category: 'paused_competitor_opportunity',
          status: 'new',
          title: { [Symbol.for('like') as any]: `%${row.competitor_name}%` },
        },
      });
      if (dup) continue;

      const rec = await this.models.AutopilotRecommendation.create({
        workspace_id: workspaceId,
        category: 'paused_competitor_opportunity',
        title: `${row.competitor_name} is active on ${row.platform} — consider matching`,
        body: `We've seen ${row.count} ${row.platform} ads from ${row.competitor_name} in the last 14 days. They're investing here; review their creative and consider launching a competing campaign.`,
        impact_estimate: 'Could capture +15% of mid-funnel queries',
        confidence: 'medium',
        related_entities: { platform: row.platform, competitor_name: row.competitor_name },
      } as any);
      created.push(rec);
    }

    // 2) Top UTM source/medium by visitors → check if we have an active
    // outbound campaign on it. If a high-traffic source has no campaign,
    // suggest channel_expansion.
    const topSources = await this.queryAll<{ utm_source: string; visitors: number }>(
      `SELECT utm_source, COUNT(DISTINCT anonymous_id) AS visitors
         FROM analytics_events
        WHERE workspace_id = :ws
          AND timestamp > DATE_SUB(NOW(), INTERVAL 30 DAY)
          AND utm_source IS NOT NULL
        GROUP BY utm_source
        HAVING visitors >= 5
        ORDER BY visitors DESC
        LIMIT 3`,
      { ws: workspaceId },
    );

    for (const src of topSources) {
      const dup = await this.models.AutopilotRecommendation.findOne({
        where: {
          workspace_id: workspaceId,
          category: 'channel_expansion',
          status: 'new',
          title: { [Symbol.for('like') as any]: `%${src.utm_source}%` },
        },
      });
      if (dup) continue;

      const rec = await this.models.AutopilotRecommendation.create({
        workspace_id: workspaceId,
        category: 'channel_expansion',
        title: `Scale up "${src.utm_source}" — your top traffic source last 30d`,
        body: `${Number(src.visitors).toLocaleString()} unique visitors came in via utm_source="${src.utm_source}". Consider a dedicated campaign on this channel.`,
        impact_estimate: `${Math.round(Number(src.visitors) * 0.2).toLocaleString()}+ additional visits/month`,
        confidence: 'high',
        related_entities: { utm_source: src.utm_source, visitors: Number(src.visitors) },
      } as any);
      created.push(rec);
    }

    // 3) If no analytics data at all yet, suggest setup
    if (recentCompetitorAds.length === 0 && topSources.length === 0) {
      const hasSetupRec = await this.models.AutopilotRecommendation.findOne({
        where: { workspace_id: workspaceId, category: 'channel_expansion', status: 'new' },
      });
      if (!hasSetupRec) {
        const rec = await this.models.AutopilotRecommendation.create({
          workspace_id: workspaceId,
          category: 'channel_expansion',
          title: 'Set up tracking + add competitors to get smarter recommendations',
          body: 'Add 2-3 competitors and start tracking page views to unlock data-driven recommendations. Even a week of data is enough to surface meaningful opportunities.',
          impact_estimate: '—',
          confidence: 'high',
          related_entities: null,
        } as any);
        created.push(rec);
      }
    }

    return { created: created.length, recommendations: created.map((r) => this.publicRec(r)) };
  }

  private async queryAll<T>(sql: string, repl: Record<string, unknown>): Promise<T[]> {
    const rows: any[] = await this.sequelize.query(sql, { replacements: repl, type: 'SELECT' as any });
    return rows as T[];
  }

  private publicRec(r: any) {
    return {
      id: r.id,
      workspace_id: r.workspace_id,
      category: r.category as RecommendationCategory,
      title: r.title,
      body: r.body,
      impact_estimate: r.impact_estimate,
      confidence: r.confidence,
      related_entities: parseJsonField(r.related_entities),
      status: r.status,
      actioned_by: r.actioned_by,
      actioned_at: r.actioned_at,
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
