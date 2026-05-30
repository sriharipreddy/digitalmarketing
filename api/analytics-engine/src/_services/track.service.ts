import type { Models } from '../models/index.js';
import { ValidationError } from '@marketing/shared-middleware';

export interface TrackInput {
  workspace_id: string;
  anonymous_id: string;
  user_id?: string;
  contact_email?: string;
  event_name: string;
  properties?: Record<string, unknown>;
  page_url?: string;
  referrer?: string;
  timestamp?: string | Date;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

export interface TrackContext {
  ip?: string;
  user_agent?: string;
}

const MAX_PROPERTY_BYTES = 16 * 1024;

export class TrackService {
  constructor(private models: Models) {}

  async ingest(input: TrackInput, ctx: TrackContext): Promise<{ id: string }> {
    if (!input.workspace_id) {
      throw new ValidationError('Validation failed', { workspace_id: ['Required'] });
    }
    if (!input.anonymous_id) {
      throw new ValidationError('Validation failed', { anonymous_id: ['Required'] });
    }
    if (!input.event_name || input.event_name.trim().length === 0) {
      throw new ValidationError('Validation failed', { event_name: ['Required'] });
    }
    if (input.properties && JSON.stringify(input.properties).length > MAX_PROPERTY_BYTES) {
      throw new ValidationError('Validation failed', {
        properties: [`Exceeds ${MAX_PROPERTY_BYTES} byte limit`],
      });
    }

    // UTMs can come from the explicit fields or from page_url query params.
    const utm = extractUtm(input);

    const row = await this.models.AnalyticsEvent.create({
      workspace_id: input.workspace_id,
      anonymous_id: input.anonymous_id,
      user_id: input.user_id ?? null,
      contact_email: input.contact_email?.toLowerCase() ?? null,
      event_name: input.event_name.trim(),
      properties: input.properties ?? null,
      page_url: input.page_url ?? null,
      referrer: input.referrer ?? null,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      utm_term: utm.utm_term,
      utm_content: utm.utm_content,
      ip_address: ctx.ip ?? null,
      user_agent: ctx.user_agent?.slice(0, 500) ?? null,
      timestamp: input.timestamp ? new Date(input.timestamp) : new Date(),
    } as any);
    return { id: row.id };
  }

  /** Batch ingestion — useful for SDK flush. Same shape per item. */
  async ingestBatch(items: TrackInput[], ctx: TrackContext): Promise<{ accepted: number; rejected: number }> {
    let accepted = 0;
    let rejected = 0;
    for (const item of items) {
      try {
        await this.ingest(item, ctx);
        accepted++;
      } catch {
        rejected++;
      }
    }
    return { accepted, rejected };
  }
}

function extractUtm(input: TrackInput): {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
} {
  // Explicit fields take precedence; fall back to URL query.
  const out = {
    utm_source: input.utm_source ?? null,
    utm_medium: input.utm_medium ?? null,
    utm_campaign: input.utm_campaign ?? null,
    utm_term: input.utm_term ?? null,
    utm_content: input.utm_content ?? null,
  };
  if (input.page_url && (!out.utm_source || !out.utm_campaign)) {
    try {
      const url = new URL(input.page_url);
      out.utm_source ??= url.searchParams.get('utm_source');
      out.utm_medium ??= url.searchParams.get('utm_medium');
      out.utm_campaign ??= url.searchParams.get('utm_campaign');
      out.utm_term ??= url.searchParams.get('utm_term');
      out.utm_content ??= url.searchParams.get('utm_content');
    } catch {
      /* invalid URL — skip */
    }
  }
  return out;
}
