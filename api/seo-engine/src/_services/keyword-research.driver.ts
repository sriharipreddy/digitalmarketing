export interface KeywordResearchResult {
  keyword: string;
  search_volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  intent: 'informational' | 'navigational' | 'transactional' | 'commercial' | null;
}

export interface KeywordResearchDriver {
  research(input: { seed: string; country: string; language: string; limit: number }): Promise<KeywordResearchResult[]>;
}

/**
 * Stub driver — deterministic fake results so the UI flow works without a DataForSEO subscription.
 * Swap to RealDataForSEODriver when you have credentials.
 */
export class StubKeywordResearchDriver implements KeywordResearchDriver {
  async research(input: {
    seed: string;
    country: string;
    language: string;
    limit: number;
  }): Promise<KeywordResearchResult[]> {
    const seed = input.seed.toLowerCase().trim();
    const variants = [
      seed,
      `best ${seed}`,
      `${seed} for beginners`,
      `how to ${seed}`,
      `${seed} pricing`,
      `${seed} vs alternatives`,
      `${seed} review`,
      `cheap ${seed}`,
      `${seed} guide`,
      `${seed} examples`,
    ];
    const intents: KeywordResearchResult['intent'][] = [
      'informational',
      'commercial',
      'informational',
      'informational',
      'commercial',
      'commercial',
      'commercial',
      'transactional',
      'informational',
      'informational',
    ];
    return variants.slice(0, input.limit).map((k, i) => ({
      keyword: k,
      search_volume: 12_000 - i * 900 - hash(k) % 500,
      difficulty: 30 + (hash(k) % 50),
      cpc: 0.5 + (hash(k) % 400) / 100,
      intent: intents[i] ?? 'informational',
    }));
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
