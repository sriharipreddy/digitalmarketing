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

/**
 * Live driver using the DataForSEO Labs API
 * (`/v3/dataforseo_labs/google/keywords_for_keywords/live`).
 *
 * Auth: HTTP Basic with login + password from the dashboard.
 * Pricing: ~$0.0001 per request task at the time of writing — see dataforseo.com/pricing.
 *
 * Country/language are mapped to DataForSEO's `location_name` + `language_name`.
 * We pass the seed as a single item — the API expands related keywords on its side.
 */
export class DataForSeoKeywordResearchDriver implements KeywordResearchDriver {
  constructor(
    private login: string,
    private password: string,
    private logger: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void; error?: (o: unknown, m?: string) => void },
    private baseUrl: string = 'https://api.dataforseo.com',
    private fallback?: KeywordResearchDriver,
  ) {}

  async research(input: { seed: string; country: string; language: string; limit: number }): Promise<KeywordResearchResult[]> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/v3/dataforseo_labs/google/keywords_for_keywords/live`;
    const body = [{
      keywords: [input.seed],
      location_name: countryToLocation(input.country),
      language_name: languageToName(input.language),
      limit: Math.min(input.limit, 100),
      // Include the metrics we surface to the user; everything else is filtered out.
      include_serp_info: false,
      include_clickstream_data: false,
    }];

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.login}:${this.password}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (e: any) {
      this.logger.warn({ err: e.message }, 'dataforseo_network_error');
      return this.fallbackOrEmpty(input);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn({ status: res.status, body: text.slice(0, 300) }, 'dataforseo_http_error');
      return this.fallbackOrEmpty(input);
    }

    type LabsRow = {
      keyword: string;
      keyword_info?: {
        search_volume?: number;
        cpc?: number;
        competition?: number;            // 0..1
        competition_level?: 'LOW' | 'MEDIUM' | 'HIGH';
      };
      keyword_properties?: {
        keyword_difficulty?: number;     // 0..100
      };
      search_intent_info?: {
        main_intent?: string;
      };
    };
    type LabsResponse = {
      status_code: number;
      status_message?: string;
      tasks?: Array<{
        status_code: number;
        status_message?: string;
        result?: Array<{ items?: LabsRow[] }>;
      }>;
    };

    let payload: LabsResponse;
    try {
      payload = (await res.json()) as LabsResponse;
    } catch (e: any) {
      this.logger.warn({ err: e.message }, 'dataforseo_parse_error');
      return this.fallbackOrEmpty(input);
    }

    const task = payload.tasks?.[0];
    if (!task || task.status_code >= 40000) {
      this.logger.warn({ status: task?.status_code, message: task?.status_message }, 'dataforseo_task_error');
      return this.fallbackOrEmpty(input);
    }

    const items: LabsRow[] = (task.result ?? []).flatMap((r) => r.items ?? []);
    if (items.length === 0) {
      this.logger.info({ seed: input.seed }, 'dataforseo_empty_result');
    }

    return items.slice(0, input.limit).map((row) => ({
      keyword: row.keyword,
      search_volume: row.keyword_info?.search_volume ?? null,
      difficulty: row.keyword_properties?.keyword_difficulty
        ?? competitionToDifficulty(row.keyword_info?.competition),
      cpc: typeof row.keyword_info?.cpc === 'number' ? Number(row.keyword_info.cpc.toFixed(2)) : null,
      intent: mapIntent(row.search_intent_info?.main_intent),
    }));
  }

  private async fallbackOrEmpty(input: { seed: string; country: string; language: string; limit: number }) {
    if (this.fallback) {
      this.logger.info('dataforseo_falling_back_to_stub');
      return this.fallback.research(input);
    }
    return [];
  }
}

function competitionToDifficulty(competition?: number): number | null {
  // DataForSEO returns competition on a 0..1 scale (ad-auction competition, not
  // organic difficulty — but it's the closest proxy when keyword_difficulty is
  // absent on the response). Scale to 0..100 to match our UI.
  if (typeof competition !== 'number') return null;
  return Math.round(Math.max(0, Math.min(1, competition)) * 100);
}

function mapIntent(intent: string | undefined): KeywordResearchResult['intent'] {
  switch ((intent ?? '').toLowerCase()) {
    case 'informational': return 'informational';
    case 'navigational': return 'navigational';
    case 'transactional': return 'transactional';
    case 'commercial': return 'commercial';
    default: return null;
  }
}

/**
 * Minimal country-code → DataForSEO location-name mapping. DataForSEO accepts
 * a `location_code` (numeric) or a `location_name` string; using the name is
 * simpler and covers the top markets without hard-coding hundreds of codes.
 * Defaults to "United States" for anything we don't recognise.
 */
function countryToLocation(country: string): string {
  const map: Record<string, string> = {
    US: 'United States', GB: 'United Kingdom', UK: 'United Kingdom',
    CA: 'Canada', AU: 'Australia', NZ: 'New Zealand', IE: 'Ireland',
    DE: 'Germany', FR: 'France', ES: 'Spain', IT: 'Italy', NL: 'Netherlands',
    SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland',
    BR: 'Brazil', MX: 'Mexico', AR: 'Argentina',
    IN: 'India', SG: 'Singapore', JP: 'Japan', KR: 'South Korea',
    ZA: 'South Africa', AE: 'United Arab Emirates',
  };
  return map[country.toUpperCase()] ?? 'United States';
}

function languageToName(language: string): string {
  const map: Record<string, string> = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
    pt: 'Portuguese', nl: 'Dutch', sv: 'Swedish', no: 'Norwegian', da: 'Danish',
    fi: 'Finnish', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', hi: 'Hindi',
    ar: 'Arabic',
  };
  return map[language.toLowerCase()] ?? 'English';
}
