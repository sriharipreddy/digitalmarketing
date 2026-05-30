import type { Models } from '../models/index.js';
import type { NpsBucket } from '../models/nps.model.js';
import { ValidationError } from '@marketing/shared-middleware';

export function bucketFromScore(score: number): NpsBucket {
  if (score <= 6) return 'detractor';
  if (score <= 8) return 'passive';
  return 'promoter';
}

export class NpsService {
  constructor(private models: Models) {}

  async submit(workspaceId: string, input: { score: number; email?: string; contact_id?: string; comment?: string; survey_id?: string }) {
    if (input.score < 0 || input.score > 10) {
      throw new ValidationError('Score must be 0-10', { score: ['Out of range'] });
    }
    return this.models.NpsResponse.create({
      workspace_id: workspaceId,
      contact_id: input.contact_id ?? null,
      email: input.email?.toLowerCase() ?? null,
      score: input.score,
      bucket: bucketFromScore(input.score),
      comment: input.comment ?? null,
      survey_id: input.survey_id ?? null,
      submitted_at: new Date(),
    } as any);
  }

  async list(workspaceId: string, opts: { since?: Date; limit?: number } = {}) {
    const rows = await this.models.NpsResponse.findAll({
      where: { workspace_id: workspaceId },
      order: [['submitted_at', 'DESC']],
      limit: opts.limit ?? 200,
    });
    return rows;
  }

  /**
   * NPS = % promoters − % detractors. Range [-100, +100].
   * Returns null when there are no responses (can't divide by zero).
   */
  async summary(workspaceId: string) {
    const rows = await this.models.NpsResponse.findAll({
      where: { workspace_id: workspaceId },
      attributes: ['score', 'bucket'],
    });
    const total = rows.length;
    if (total === 0) {
      return { total: 0, score: null, breakdown: { promoter: 0, passive: 0, detractor: 0 } };
    }
    const buckets = { promoter: 0, passive: 0, detractor: 0 };
    for (const r of rows) buckets[(r as any).bucket as NpsBucket]++;
    const score = Math.round(((buckets.promoter - buckets.detractor) / total) * 100);
    return { total, score, breakdown: buckets };
  }
}
