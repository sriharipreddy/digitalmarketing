import type { Sequelize } from 'sequelize';
import type { Models } from '../models/index.js';
import type { ContentAiClient } from './content-ai.client.js';
import type { SeoEngineClient } from './seo-engine.client.js';
import type { CrmAutomationClient } from './crm-automation.client.js';
import type { IntelligenceClient } from './intelligence.client.js';
import { UtmService } from './utm.service.js';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface StepUpdate {
  step: number;
  name: string;
  status: StepStatus;
  message?: string;
  data?: Record<string, unknown>;
  duration_ms?: number;
}

export interface FinalResult {
  campaign_id: string | null;
  summary: Record<string, unknown>;
}

export interface OneClickInput {
  workspace_id: string;
  user_id: string;
  user_jwt: string;
  source_url: string;
  product_pitch: string;
  audience_country?: string;
}

/**
 * The 11-step orchestration that fans out across every Phase 1-3 service.
 * Designed to be driven by the SSE controller — yields each step as it
 * runs so the UI can render real-time progress.
 */
export class OneClickService {
  private steps = [
    { n: 1, name: 'parse_source' },
    { n: 2, name: 'brand_voice_check' },
    { n: 3, name: 'generate_headlines' },
    { n: 4, name: 'generate_social' },
    { n: 5, name: 'generate_email' },
    { n: 6, name: 'save_content_pieces' },
    { n: 7, name: 'research_keywords' },
    { n: 8, name: 'resolve_audience' },
    { n: 9, name: 'create_campaign' },
    { n: 10, name: 'create_utm_links' },
    { n: 11, name: 'intelligence_scan' },
  ];

  constructor(
    private sequelize: Sequelize,
    private models: Models,
    private contentAi: ContentAiClient,
    private seoEngine: SeoEngineClient,
    private crmAutomation: CrmAutomationClient,
    private intelligence: IntelligenceClient,
    private utmService: UtmService,
    private logger: { info: (obj: unknown, msg?: string) => void; warn: (obj: unknown, msg?: string) => void; error?: (obj: unknown, msg?: string) => void },
  ) {}

  /**
   * Run the orchestration, yielding StepUpdate at each transition.
   * Caller is expected to forward these to an SSE stream.
   */
  async *run(input: OneClickInput): AsyncGenerator<StepUpdate, FinalResult, unknown> {
    const startedAt = Date.now();
    const summary: Record<string, unknown> = {};
    let campaignId: string | null = null;
    let headlinesGenId: string | null = null;
    let socialGenId: string | null = null;
    let emailGenId: string | null = null;
    let headlineOutput = '';
    let socialOutput = '';

    // Yield "pending" for every step first so UI knows the full plan.
    for (const s of this.steps) {
      yield { step: s.n, name: s.name, status: 'pending' };
    }

    // ── Step 1: parse the source URL/pitch ──────────────────────────
    {
      const t = Date.now();
      yield { step: 1, name: 'parse_source', status: 'running' };
      const parsed = parseSourceUrl(input.source_url);
      summary.source = { url: input.source_url, ...parsed, pitch: input.product_pitch };
      yield {
        step: 1,
        name: 'parse_source',
        status: 'completed',
        message: `Parsed ${parsed.host}`,
        data: parsed,
        duration_ms: Date.now() - t,
      };
    }

    // ── Step 2: brand voice check ───────────────────────────────────
    {
      const t = Date.now();
      yield { step: 2, name: 'brand_voice_check', status: 'running' };
      // Skipped detail: we don't yet pick which voice; we let content-ai use
      // the default. This step is observability — we just record that no voice
      // override was specified.
      yield {
        step: 2,
        name: 'brand_voice_check',
        status: 'completed',
        message: 'Using workspace default voice',
        duration_ms: Date.now() - t,
      };
    }

    // ── Step 3: generate headlines ──────────────────────────────────
    {
      const t = Date.now();
      yield { step: 3, name: 'generate_headlines', status: 'running' };
      try {
        const r = await this.contentAi.generate(input.workspace_id, input.user_jwt, {
          kind: 'headline',
          prompt: `Headlines for: ${input.product_pitch} (source ${input.source_url})`,
        });
        headlinesGenId = r.generation_id;
        headlineOutput = r.output;
        summary.headline_preview = r.output.slice(0, 200);
        yield {
          step: 3,
          name: 'generate_headlines',
          status: 'completed',
          message: `${r.total_tokens} tokens`,
          data: { generation_id: r.generation_id, tokens: r.total_tokens, cost_usd: r.cost_usd },
          duration_ms: Date.now() - t,
        };
      } catch (e: any) {
        this.logger.warn({ err: e.message }, 'one_click_step_failed');
        yield {
          step: 3,
          name: 'generate_headlines',
          status: 'failed',
          message: e.message,
          duration_ms: Date.now() - t,
        };
      }
    }

    // ── Step 4: generate social variants ─────────────────────────────
    {
      const t = Date.now();
      yield { step: 4, name: 'generate_social', status: 'running' };
      try {
        const r = await this.contentAi.generate(input.workspace_id, input.user_jwt, {
          kind: 'social',
          prompt: `3 social posts for: ${input.product_pitch}`,
        });
        socialGenId = r.generation_id;
        socialOutput = r.output;
        summary.social_preview = r.output.slice(0, 200);
        yield {
          step: 4,
          name: 'generate_social',
          status: 'completed',
          data: { generation_id: r.generation_id, tokens: r.total_tokens },
          duration_ms: Date.now() - t,
        };
      } catch (e: any) {
        yield { step: 4, name: 'generate_social', status: 'failed', message: e.message, duration_ms: Date.now() - t };
      }
    }

    // ── Step 5: generate email ───────────────────────────────────────
    {
      const t = Date.now();
      yield { step: 5, name: 'generate_email', status: 'running' };
      try {
        const r = await this.contentAi.generate(input.workspace_id, input.user_jwt, {
          kind: 'email',
          prompt: `Launch email for: ${input.product_pitch}`,
        });
        emailGenId = r.generation_id;
        summary.email_preview = r.output.slice(0, 200);
        yield {
          step: 5,
          name: 'generate_email',
          status: 'completed',
          data: { generation_id: r.generation_id, tokens: r.total_tokens },
          duration_ms: Date.now() - t,
        };
      } catch (e: any) {
        yield { step: 5, name: 'generate_email', status: 'failed', message: e.message, duration_ms: Date.now() - t };
      }
    }

    // ── Step 6: save content pieces ──────────────────────────────────
    {
      const t = Date.now();
      yield { step: 6, name: 'save_content_pieces', status: 'running' };
      const savedPieces: string[] = [];
      try {
        for (const [genId, label] of [
          [headlinesGenId, 'Headlines'],
          [socialGenId, 'Social posts'],
          [emailGenId, 'Email'],
        ] as Array<[string | null, string]>) {
          if (!genId) continue;
          const piece = await this.contentAi.savePiece(input.workspace_id, input.user_jwt, {
            generation_id: genId,
            title: `${label} — ${new Date().toISOString().slice(0, 10)}`,
          });
          savedPieces.push(piece.piece_id);
        }
        summary.saved_pieces = savedPieces;
        yield {
          step: 6,
          name: 'save_content_pieces',
          status: savedPieces.length === 0 ? 'skipped' : 'completed',
          message: `${savedPieces.length} piece(s) saved`,
          data: { piece_ids: savedPieces },
          duration_ms: Date.now() - t,
        };
      } catch (e: any) {
        yield { step: 6, name: 'save_content_pieces', status: 'failed', message: e.message, duration_ms: Date.now() - t };
      }
    }

    // ── Step 7: keyword research ─────────────────────────────────────
    {
      const t = Date.now();
      yield { step: 7, name: 'research_keywords', status: 'running' };
      try {
        const seed = pickSeed(input.product_pitch);
        const results = await this.seoEngine.research(input.workspace_id, input.user_jwt, {
          seed,
          country: input.audience_country ?? 'US',
          limit: 8,
        });
        const top = results.slice(0, 5);
        let saved = 0;
        if (top.length > 0) {
          saved = await this.seoEngine.save(input.workspace_id, input.user_jwt, top);
        }
        summary.keywords = top.map((k) => k.keyword);
        yield {
          step: 7,
          name: 'research_keywords',
          status: 'completed',
          message: `${results.length} researched, ${saved} saved`,
          data: { seed, results: top },
          duration_ms: Date.now() - t,
        };
      } catch (e: any) {
        yield { step: 7, name: 'research_keywords', status: 'failed', message: e.message, duration_ms: Date.now() - t };
      }
    }

    // ── Step 8: resolve audience ─────────────────────────────────────
    {
      const t = Date.now();
      yield { step: 8, name: 'resolve_audience', status: 'running' };
      try {
        const count = await this.crmAutomation.listContacts(input.workspace_id, input.user_jwt);
        summary.audience_size = count;
        yield {
          step: 8,
          name: 'resolve_audience',
          status: 'completed',
          message: `${count} contacts in CRM`,
          data: { audience_size: count },
          duration_ms: Date.now() - t,
        };
      } catch (e: any) {
        yield { step: 8, name: 'resolve_audience', status: 'failed', message: e.message, duration_ms: Date.now() - t };
      }
    }

    // ── Step 9: create campaign ──────────────────────────────────────
    {
      const t = Date.now();
      yield { step: 9, name: 'create_campaign', status: 'running' };
      try {
        const c = await this.sequelize.transaction(async (tx) => {
          const campaign = await this.models.Campaign.create(
            {
              workspace_id: input.workspace_id,
              name: `One-Click: ${input.product_pitch.slice(0, 80)}`,
              description: `Auto-generated from ${input.source_url}`,
              kind: 'one_click',
              status: 'draft',
              goal: 'multi-channel launch',
              created_by: input.user_id,
            } as any,
            { transaction: tx },
          );
          // Add an email channel with the headline + email body assembled inline
          await this.models.CampaignChannel.create(
            {
              campaign_id: campaign.id,
              kind: 'email',
              status: 'pending',
              config: {
                subject: headlineOutput.split('\n')[0]?.slice(0, 200) ?? 'Launch announcement',
                html: `<h1>${escapeHtml(input.product_pitch)}</h1><pre>${escapeHtml(socialOutput.slice(0, 600))}</pre>`,
                inline_filter: { tag_includes: [] },
              },
            } as any,
            { transaction: tx },
          );
          return campaign;
        });
        campaignId = c.id;
        summary.campaign_id = c.id;
        yield {
          step: 9,
          name: 'create_campaign',
          status: 'completed',
          message: `Campaign ${c.id.slice(0, 8)}… created`,
          data: { campaign_id: c.id, kind: 'one_click', status: 'draft' },
          duration_ms: Date.now() - t,
        };
      } catch (e: any) {
        yield { step: 9, name: 'create_campaign', status: 'failed', message: e.message, duration_ms: Date.now() - t };
      }
    }

    // ── Step 10: UTM links ───────────────────────────────────────────
    {
      const t = Date.now();
      yield { step: 10, name: 'create_utm_links', status: 'running' };
      try {
        if (!campaignId) throw new Error('No campaign to attach UTM links to');
        const safeUrl = ensureUrl(input.source_url);
        const slugCampaign = `one-click-${Date.now().toString(36)}`;
        const links: any[] = [];
        for (const medium of ['email', 'social', 'newsletter']) {
          const link = await this.utmService.create(input.workspace_id, input.user_id, {
            destination_url: safeUrl,
            source: 'one_click',
            medium,
            campaign: slugCampaign,
            campaign_id: campaignId,
          });
          links.push({ medium, short_code: (link as any).short_code });
        }
        summary.utm_links = links;
        yield {
          step: 10,
          name: 'create_utm_links',
          status: 'completed',
          message: `${links.length} UTM links`,
          data: { links },
          duration_ms: Date.now() - t,
        };
      } catch (e: any) {
        yield { step: 10, name: 'create_utm_links', status: 'failed', message: e.message, duration_ms: Date.now() - t };
      }
    }

    // ── Step 11: intelligence scan ───────────────────────────────────
    {
      const t = Date.now();
      yield { step: 11, name: 'intelligence_scan', status: 'running' };
      try {
        const recs = await this.intelligence.scan(input.workspace_id, input.user_jwt);
        summary.recommendations = recs.length;
        yield {
          step: 11,
          name: 'intelligence_scan',
          status: 'completed',
          message: `${recs.length} recommendation(s)`,
          data: { recommendations: recs.map((r) => ({ title: r.title, category: r.category, confidence: r.confidence })) },
          duration_ms: Date.now() - t,
        };
      } catch (e: any) {
        yield { step: 11, name: 'intelligence_scan', status: 'failed', message: e.message, duration_ms: Date.now() - t };
      }
    }

    this.logger.info(
      { workspace_id: input.workspace_id, duration_ms: Date.now() - startedAt, campaign_id: campaignId },
      'one_click_completed',
    );
    return { campaign_id: campaignId, summary };
  }
}

function parseSourceUrl(input: string): { host: string; path: string; valid: boolean } {
  try {
    const url = new URL(input.includes('://') ? input : `https://${input}`);
    return { host: url.host, path: url.pathname, valid: true };
  } catch {
    return { host: 'unknown', path: '', valid: false };
  }
}

function ensureUrl(input: string): string {
  if (/^https?:\/\//i.test(input)) return input;
  return `https://${input}`;
}

function pickSeed(pitch: string): string {
  const words = pitch.toLowerCase().split(/\W+/).filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
  if (words.length === 0) return 'marketing';
  return words.slice(0, 3).join(' ');
}

const STOP_WORDS = new Set(['that', 'this', 'with', 'have', 'from', 'will', 'your', 'their', 'about', 'into']);

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[c]!;
  });
}
