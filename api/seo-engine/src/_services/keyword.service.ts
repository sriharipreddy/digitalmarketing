import type { Models } from '../models/index.js';
import type { KeywordResearchDriver, KeywordResearchResult } from './keyword-research.driver.js';
import { NotFoundError, ValidationError } from '@marketing/shared-middleware';

const MAX_LIMIT = 50;

export class KeywordService {
  constructor(
    private models: Models,
    private researchDriver: KeywordResearchDriver,
  ) {}

  async list(workspaceId: string, opts: { limit?: number; offset?: number; q?: string }) {
    const where: any = { workspace_id: workspaceId };
    if (opts.q) {
      where.keyword = { ['$like' as any]: `%${opts.q}%` };
    }
    const { rows, count } = await this.models.Keyword.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Math.min(opts.limit ?? 50, MAX_LIMIT),
      offset: opts.offset ?? 0,
    });
    return { rows, total: count };
  }

  async research(_workspaceId: string, input: { seed: string; country?: string; language?: string; limit?: number }) {
    if (!input.seed || input.seed.trim().length < 2) {
      throw new ValidationError('Invalid seed keyword', { seed: ['Must be at least 2 characters'] });
    }
    const limit = Math.min(input.limit ?? 10, MAX_LIMIT);
    const country = (input.country ?? 'US').toUpperCase();
    const language = (input.language ?? 'en').toLowerCase();
    const results = await this.researchDriver.research({
      seed: input.seed.trim(),
      country,
      language,
      limit,
    });
    // Surface the driver mode so the UI can hide the "stub mode" banner once
    // a live provider is configured.
    const driver = this.researchDriver.constructor.name.includes('Stub') ? 'stub' : 'live';
    return { country, language, results, driver };
  }

  /** Save selected research results to the workspace's keyword bank. */
  async save(
    workspaceId: string,
    items: Array<KeywordResearchResult & { country?: string; language?: string; tags?: string[] }>,
  ) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('Nothing to save', { items: ['Must include at least one keyword'] });
    }
    const saved: any[] = [];
    for (const item of items) {
      const [row] = await this.models.Keyword.upsert(
        {
          workspace_id: workspaceId,
          keyword: item.keyword.toLowerCase().trim(),
          search_volume: item.search_volume,
          difficulty: item.difficulty,
          cpc: item.cpc,
          country: (item.country ?? 'US').toUpperCase(),
          language: (item.language ?? 'en').toLowerCase(),
          intent: item.intent,
          tags: item.tags ?? null,
        } as any,
      );
      saved.push(row);
    }
    return { saved: saved.length, rows: saved };
  }

  async remove(workspaceId: string, keywordId: string) {
    const kw = await this.models.Keyword.findOne({ where: { id: keywordId, workspace_id: workspaceId } });
    if (!kw) throw new NotFoundError('Keyword not found');
    await kw.destroy();
    return { id: keywordId, removed: true };
  }
}
