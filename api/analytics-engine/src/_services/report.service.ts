import type { Sequelize } from 'sequelize';

export interface OverviewMetrics {
  range: { since: string; until: string };
  totals: {
    events: number;
    unique_visitors: number;
    sessions: number;
    pageviews: number;
  };
  top_events: Array<{ event_name: string; count: number }>;
  top_pages: Array<{ page_url: string; views: number }>;
  by_day: Array<{ day: string; events: number; visitors: number }>;
}

export interface UtmAttribution {
  range: { since: string; until: string };
  by_campaign: Array<{ utm_campaign: string; visitors: number; events: number; conversions: number; value_usd: number }>;
  by_source: Array<{ utm_source: string; visitors: number; events: number }>;
  by_medium: Array<{ utm_medium: string; visitors: number; events: number }>;
}

export interface FunnelStep {
  step: number;
  event_name: string;
  visitors: number;
  drop_off: number;
}

export class ReportService {
  constructor(private sequelize: Sequelize) {}

  /** Overall workspace activity for the given range. */
  async overview(workspaceId: string, since: Date, until: Date): Promise<OverviewMetrics> {
    const repl = { ws: workspaceId, since, until };

    const totals = await this.queryOne<{ events: number; unique_visitors: number; sessions: number; pageviews: number }>(
      `SELECT
         COUNT(*) AS events,
         COUNT(DISTINCT anonymous_id) AS unique_visitors,
         COUNT(DISTINCT anonymous_id) AS sessions,
         SUM(CASE WHEN event_name = 'pageview' THEN 1 ELSE 0 END) AS pageviews
       FROM analytics_events
       WHERE workspace_id = :ws AND timestamp >= :since AND timestamp < :until`,
      repl,
    );

    const top_events = await this.queryAll<{ event_name: string; count: number }>(
      `SELECT event_name, COUNT(*) AS count
       FROM analytics_events
       WHERE workspace_id = :ws AND timestamp >= :since AND timestamp < :until
       GROUP BY event_name
       ORDER BY count DESC
       LIMIT 8`,
      repl,
    );

    const top_pages = await this.queryAll<{ page_url: string; views: number }>(
      `SELECT page_url, COUNT(*) AS views
       FROM analytics_events
       WHERE workspace_id = :ws
         AND timestamp >= :since AND timestamp < :until
         AND event_name = 'pageview'
         AND page_url IS NOT NULL
       GROUP BY page_url
       ORDER BY views DESC
       LIMIT 8`,
      repl,
    );

    const by_day = await this.queryAll<{ day: string; events: number; visitors: number }>(
      `SELECT DATE(timestamp) AS day, COUNT(*) AS events, COUNT(DISTINCT anonymous_id) AS visitors
       FROM analytics_events
       WHERE workspace_id = :ws AND timestamp >= :since AND timestamp < :until
       GROUP BY DATE(timestamp)
       ORDER BY day ASC`,
      repl,
    );

    return {
      range: { since: since.toISOString(), until: until.toISOString() },
      totals: {
        events: Number(totals?.events ?? 0),
        unique_visitors: Number(totals?.unique_visitors ?? 0),
        sessions: Number(totals?.sessions ?? 0),
        pageviews: Number(totals?.pageviews ?? 0),
      },
      top_events: top_events.map((r) => ({ event_name: r.event_name, count: Number(r.count) })),
      top_pages: top_pages.map((r) => ({ page_url: r.page_url, views: Number(r.views) })),
      by_day: by_day.map((r) => ({
        day: String(r.day).slice(0, 10),
        events: Number(r.events),
        visitors: Number(r.visitors),
      })),
    };
  }

  /**
   * UTM attribution — visitors, events, and goal-conversion counts grouped
   * by utm_campaign / utm_source / utm_medium.
   */
  async utmAttribution(workspaceId: string, since: Date, until: Date): Promise<UtmAttribution> {
    const repl = { ws: workspaceId, since, until };

    const goals = await this.queryAll<{ id: string; event_name: string; value_usd: number }>(
      `SELECT id, event_name, value_usd
       FROM analytics_conversion_goals
       WHERE workspace_id = :ws AND is_active = true`,
      { ws: workspaceId },
    );

    // For each campaign, count visitors + events + conversions.
    // Conversions = events whose event_name matches an active goal.
    const goalEventNames = goals.map((g) => g.event_name);
    const valueByEvent = new Map<string, number>();
    for (const g of goals) {
      valueByEvent.set(g.event_name, (valueByEvent.get(g.event_name) ?? 0) + Number(g.value_usd));
    }

    const by_campaign_raw = await this.queryAll<{
      utm_campaign: string;
      visitors: number;
      events: number;
      conversions: number;
      goal_events: string;
    }>(
      goalEventNames.length > 0
        ? `SELECT utm_campaign,
                  COUNT(DISTINCT anonymous_id) AS visitors,
                  COUNT(*) AS events,
                  SUM(CASE WHEN event_name IN (:goalEvents) THEN 1 ELSE 0 END) AS conversions,
                  GROUP_CONCAT(CASE WHEN event_name IN (:goalEvents) THEN event_name END) AS goal_events
           FROM analytics_events
           WHERE workspace_id = :ws AND timestamp >= :since AND timestamp < :until AND utm_campaign IS NOT NULL
           GROUP BY utm_campaign
           ORDER BY visitors DESC
           LIMIT 20`
        : `SELECT utm_campaign,
                  COUNT(DISTINCT anonymous_id) AS visitors,
                  COUNT(*) AS events,
                  0 AS conversions,
                  NULL AS goal_events
           FROM analytics_events
           WHERE workspace_id = :ws AND timestamp >= :since AND timestamp < :until AND utm_campaign IS NOT NULL
           GROUP BY utm_campaign
           ORDER BY visitors DESC
           LIMIT 20`,
      { ...repl, goalEvents: goalEventNames },
    );

    const by_campaign = by_campaign_raw.map((r) => {
      let value_usd = 0;
      if (r.goal_events) {
        for (const evt of String(r.goal_events).split(',')) {
          value_usd += valueByEvent.get(evt) ?? 0;
        }
      }
      return {
        utm_campaign: r.utm_campaign,
        visitors: Number(r.visitors),
        events: Number(r.events),
        conversions: Number(r.conversions),
        value_usd,
      };
    });

    const by_source = (await this.queryAll<{ utm_source: string; visitors: number; events: number }>(
      `SELECT utm_source, COUNT(DISTINCT anonymous_id) AS visitors, COUNT(*) AS events
       FROM analytics_events
       WHERE workspace_id = :ws AND timestamp >= :since AND timestamp < :until AND utm_source IS NOT NULL
       GROUP BY utm_source
       ORDER BY visitors DESC
       LIMIT 20`,
      repl,
    )).map((r) => ({ utm_source: r.utm_source, visitors: Number(r.visitors), events: Number(r.events) }));

    const by_medium = (await this.queryAll<{ utm_medium: string; visitors: number; events: number }>(
      `SELECT utm_medium, COUNT(DISTINCT anonymous_id) AS visitors, COUNT(*) AS events
       FROM analytics_events
       WHERE workspace_id = :ws AND timestamp >= :since AND timestamp < :until AND utm_medium IS NOT NULL
       GROUP BY utm_medium
       ORDER BY visitors DESC
       LIMIT 20`,
      repl,
    )).map((r) => ({ utm_medium: r.utm_medium, visitors: Number(r.visitors), events: Number(r.events) }));

    return { range: { since: since.toISOString(), until: until.toISOString() }, by_campaign, by_source, by_medium };
  }

  /**
   * Funnel: ordered event names. For each step, count anonymous_ids who
   * triggered that event AFTER triggering the previous one (any time, not
   * within session — simple version).
   */
  async funnel(
    workspaceId: string,
    since: Date,
    until: Date,
    events: string[],
  ): Promise<{ range: { since: string; until: string }; steps: FunnelStep[] }> {
    if (events.length === 0) {
      return { range: { since: since.toISOString(), until: until.toISOString() }, steps: [] };
    }

    const steps: FunnelStep[] = [];
    let prevVisitors = 0;
    for (let i = 0; i < events.length; i++) {
      const cohortEvents = events.slice(0, i + 1);
      const row = await this.queryOne<{ visitors: number }>(
        `SELECT COUNT(DISTINCT anonymous_id) AS visitors
         FROM analytics_events
         WHERE workspace_id = :ws AND timestamp >= :since AND timestamp < :until
           AND anonymous_id IN (
             SELECT anonymous_id
             FROM analytics_events
             WHERE workspace_id = :ws AND timestamp >= :since AND timestamp < :until
               AND event_name IN (:events)
             GROUP BY anonymous_id
             HAVING COUNT(DISTINCT event_name) = :need
           )`,
        { ws: workspaceId, since, until, events: cohortEvents, need: cohortEvents.length },
      );
      const visitors = Number(row?.visitors ?? 0);
      const drop_off = i === 0 ? 0 : Math.max(0, prevVisitors - visitors);
      steps.push({ step: i + 1, event_name: events[i]!, visitors, drop_off });
      prevVisitors = visitors;
    }
    return { range: { since: since.toISOString(), until: until.toISOString() }, steps };
  }

  private async queryOne<T>(sql: string, repl: Record<string, unknown>): Promise<T | undefined> {
    const rows: any[] = await this.sequelize.query(sql, { replacements: repl, type: 'SELECT' as any });
    return rows[0] as T | undefined;
  }

  private async queryAll<T>(sql: string, repl: Record<string, unknown>): Promise<T[]> {
    const rows: any[] = await this.sequelize.query(sql, { replacements: repl, type: 'SELECT' as any });
    return rows as T[];
  }
}
