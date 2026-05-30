import type { Models } from '../models/index.js';
import type { RfmSegmentLabel } from '../models/rfm.model.js';

interface ContactOrderSummary {
  contact_id: string;
  last_order_at: Date | null;
  order_count: number;
  lifetime_value_usd: number;
}

export interface RfmAnalysisResult {
  scored: number;
  segments: Record<RfmSegmentLabel, number>;
}

export class RfmService {
  constructor(private models: Models) {}

  /**
   * Run the RFM analysis for a workspace. Caller passes the order summary
   * (typically aggregated from the analytics-engine or commerce import); we
   * compute R/F/M scores on a 1-5 scale via quintiles, label segments via the
   * standard 11-segment matrix, and upsert rows in crm_rfm_scores.
   *
   * The split between "fetch the orders" and "score the orders" lives intentionally
   * at the caller because order data lives in many places (Shopify import,
   * analytics events, manual CSV) and we don't want this service coupled to any one.
   */
  async analyze(workspaceId: string, orders: ContactOrderSummary[]): Promise<RfmAnalysisResult> {
    if (orders.length === 0) {
      return { scored: 0, segments: emptySegments() };
    }

    const now = Date.now();
    const recencyDays = orders.map((o) => o.last_order_at
      ? Math.floor((now - new Date(o.last_order_at).getTime()) / 86_400_000)
      : Number.MAX_SAFE_INTEGER);
    const frequencies = orders.map((o) => o.order_count);
    const monetaries = orders.map((o) => Number(o.lifetime_value_usd));

    // For recency, LOWER is better → reverse scoring (newest gets 5).
    const recencyThresholds = quintiles(recencyDays);
    const frequencyThresholds = quintiles(frequencies);
    const monetaryThresholds = quintiles(monetaries);

    const segments: Record<RfmSegmentLabel, number> = emptySegments();
    const transaction = await this.models.RfmScore.sequelize!.transaction();
    try {
      for (let i = 0; i < orders.length; i++) {
        const o = orders[i]!;
        const r = scoreQuintileReverse(recencyDays[i]!, recencyThresholds);
        const f = scoreQuintile(frequencies[i]!, frequencyThresholds);
        const m = scoreQuintile(monetaries[i]!, monetaryThresholds);
        const label = labelFromScores(r, f, m);
        segments[label]++;

        await this.models.RfmScore.upsert({
          workspace_id: workspaceId,
          contact_id: o.contact_id,
          recency_score: r,
          frequency_score: f,
          monetary_score: m,
          segment_label: label,
          last_order_at: o.last_order_at,
          order_count: o.order_count,
          lifetime_value_usd: o.lifetime_value_usd,
          analyzed_at: new Date(),
        } as any, { transaction });
      }
      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }

    return { scored: orders.length, segments };
  }

  async summary(workspaceId: string) {
    const rows = await this.models.RfmScore.findAll({
      where: { workspace_id: workspaceId },
      attributes: ['segment_label', 'recency_score', 'frequency_score', 'monetary_score', 'lifetime_value_usd'],
    });
    const segments: Record<string, { count: number; ltv_total: number }> = {};
    let total = 0;
    let ltv = 0;
    for (const r of rows) {
      const label = (r as any).segment_label as string;
      const v = Number((r as any).lifetime_value_usd) || 0;
      segments[label] = segments[label] ?? { count: 0, ltv_total: 0 };
      segments[label]!.count++;
      segments[label]!.ltv_total = Math.round((segments[label]!.ltv_total + v) * 100) / 100;
      total++;
      ltv += v;
    }
    return { total, ltv_total_usd: Math.round(ltv * 100) / 100, segments };
  }

  async listBySegment(workspaceId: string, label: RfmSegmentLabel) {
    return this.models.RfmScore.findAll({
      where: { workspace_id: workspaceId, segment_label: label },
      order: [['lifetime_value_usd', 'DESC']],
    });
  }
}

function quintiles(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (let q = 1; q < 5; q++) {
    const idx = Math.floor((q / 5) * sorted.length);
    out.push(sorted[Math.min(idx, sorted.length - 1)]!);
  }
  return out;
}

function scoreQuintile(v: number, thresholds: number[]): number {
  // 1 = bottom 20%, 5 = top 20%
  for (let i = 0; i < thresholds.length; i++) {
    if (v <= thresholds[i]!) return i + 1;
  }
  return 5;
}

function scoreQuintileReverse(v: number, thresholds: number[]): number {
  return 6 - scoreQuintile(v, thresholds);
}

function labelFromScores(r: number, f: number, m: number): RfmSegmentLabel {
  // Canonical 11-segment matrix used in retail / e-commerce RFM.
  if (r >= 4 && f >= 4 && m >= 4) return 'champion';
  if (r >= 3 && f >= 4) return 'loyal_customer';
  if (r >= 4 && f <= 2) return 'new_customer';
  if (r >= 4 && f === 3) return 'potential_loyalist';
  if (r >= 3 && f === 2) return 'promising';
  if (r === 3 && f === 3) return 'needs_attention';
  if (r === 2 && f <= 3) return 'about_to_sleep';
  if (r === 2 && f >= 4) return 'at_risk';
  if (r === 1 && f >= 4 && m >= 4) return 'cant_lose';
  if (r === 1 && f >= 2) return 'hibernating';
  return 'lost';
}

function emptySegments(): Record<RfmSegmentLabel, number> {
  return {
    champion: 0,
    loyal_customer: 0,
    potential_loyalist: 0,
    new_customer: 0,
    promising: 0,
    needs_attention: 0,
    about_to_sleep: 0,
    at_risk: 0,
    cant_lose: 0,
    hibernating: 0,
    lost: 0,
  };
}
