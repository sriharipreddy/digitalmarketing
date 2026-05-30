import type { Models } from '../models/index.js';
import type { EmailDriver } from './email.driver.js';
import type { AudienceService, AudienceFilter } from './audience.service.js';
import type { ListService } from './list.service.js';
import {
  ValidationError,
  BadRequestError,
} from '@marketing/shared-middleware';

export interface SendCampaignInput {
  workspace_id: string;
  list_id?: string;
  inline_filter?: AudienceFilter;
  subject: string;
  html: string;
  text?: string;
  utm?: { source: string; medium: string; campaign: string };
  campaign_external_id?: string;
}

export interface SendCampaignResult {
  send_id: string;
  audience_size: number;
  status: 'queued' | 'sending' | 'completed' | 'failed' | 'partial';
}

export class SendService {
  constructor(
    private models: Models,
    private driver: EmailDriver,
    private audienceService: AudienceService,
    private listService: ListService,
    private fromEmail: string,
    private fromName: string,
    private sandbox: boolean,
    private logger: { info: (obj: unknown, msg?: string) => void; error: (obj: unknown, msg?: string) => void },
  ) {}

  async sendCampaign(input: SendCampaignInput): Promise<SendCampaignResult> {
    if (!input.subject || input.subject.trim().length === 0) {
      throw new ValidationError('Subject required', { subject: ['Required'] });
    }
    if (!input.html || input.html.trim().length === 0) {
      throw new ValidationError('HTML body required', { html: ['Required'] });
    }
    if (!input.list_id && !input.inline_filter) {
      throw new ValidationError('list_id or inline_filter required', {
        list_id: ['Provide list_id or inline_filter'],
      });
    }

    // Resolve audience
    let filter: AudienceFilter;
    let list_id: string | null = null;
    if (input.list_id) {
      const list = await this.listService.get(input.workspace_id, input.list_id);
      filter = list.filter;
      list_id = list.id;
    } else {
      filter = input.inline_filter!;
    }
    const recipients = await this.audienceService.resolve(input.workspace_id, filter);

    if (recipients.length === 0) {
      throw new BadRequestError('Audience is empty — no contacts match this filter');
    }

    const html = input.utm ? appendUtm(input.html, input.utm) : input.html;
    const text = (input.text ?? stripHtml(html));

    // Create the send row
    const send = await this.models.EmailSend.create({
      workspace_id: input.workspace_id,
      list_id,
      campaign_external_id: input.campaign_external_id ?? null,
      subject: input.subject,
      from_email: this.fromEmail,
      from_name: this.fromName,
      status: 'sending',
      audience_size: recipients.length,
    } as any);

    this.logger.info(
      { send_id: send.id, recipients: recipients.length, sandbox: this.sandbox },
      'send_started',
    );

    try {
      const result = await this.driver.sendBulk({
        from: { email: this.fromEmail, name: this.fromName },
        subject: input.subject,
        html,
        text,
        recipients,
        sandbox: this.sandbox,
      });

      const status: SendCampaignResult['status'] =
        result.failed === 0 ? 'completed' : result.sent === 0 ? 'failed' : 'partial';
      await send.update({
        status,
        sent_count: result.sent,
        failed_count: result.failed,
        error: result.errors?.[0]?.error ?? null,
      });

      this.logger.info(
        { send_id: send.id, sent: result.sent, failed: result.failed, status },
        'send_completed',
      );
      return { send_id: send.id, audience_size: recipients.length, status };
    } catch (e: any) {
      await send.update({ status: 'failed', error: e.message?.slice(0, 1900) ?? 'unknown' });
      this.logger.error({ send_id: send.id, err: e.message }, 'send_failed');
      throw e;
    }
  }

  async listSends(workspaceId: string, opts: { limit?: number; offset?: number }) {
    const { rows, count } = await this.models.EmailSend.findAndCountAll({
      where: { workspace_id: workspaceId },
      order: [['created_at', 'DESC']],
      limit: Math.min(opts.limit ?? 25, 100),
      offset: opts.offset ?? 0,
    });
    return { rows, total: count };
  }

  async getSend(workspaceId: string, id: string) {
    return this.models.EmailSend.findOne({ where: { id, workspace_id: workspaceId } });
  }
}

function appendUtm(html: string, utm: { source: string; medium: string; campaign: string }): string {
  // Append UTM params to every absolute http(s) href in the HTML.
  return html.replace(/href="(https?:\/\/[^"]+)"/gi, (_m, url: string) => {
    try {
      const u = new URL(url);
      u.searchParams.set('utm_source', utm.source);
      u.searchParams.set('utm_medium', utm.medium);
      u.searchParams.set('utm_campaign', utm.campaign);
      return `href="${u.toString()}"`;
    } catch {
      return `href="${url}"`;
    }
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
