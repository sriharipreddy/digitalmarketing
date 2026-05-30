import type { Models } from '../models/index.js';
import type { InfluencerService } from './influencer.service.js';
import {
  NotFoundError,
  ValidationError,
  BadRequestError,
} from '@marketing/shared-middleware';

export class OutreachService {
  constructor(
    private models: Models,
    private influencerService: InfluencerService,
  ) {}

  async list(workspaceId: string, opts: { limit?: number; offset?: number; influencer_id?: string }) {
    const where: any = { workspace_id: workspaceId };
    if (opts.influencer_id) where.influencer_id = opts.influencer_id;
    const { rows, count } = await this.models.Outreach.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Math.min(opts.limit ?? 50, 200),
      offset: opts.offset ?? 0,
      include: [{ model: this.models.Influencer, as: 'influencer' }],
    });
    return {
      rows: rows.map((r) => this.publicOutreach(r as any)),
      total: count,
    };
  }

  /**
   * Draft a personalised outreach message for an influencer. Stub uses a
   * template; production would route to content-ai with the influencer's
   * topics + bio for full personalisation.
   */
  async draft(
    workspaceId: string,
    userId: string,
    input: { influencer_id: string; channel?: 'email' | 'dm' | 'phone'; campaign_brief: string },
  ) {
    if (!input.campaign_brief || input.campaign_brief.trim().length < 10) {
      throw new ValidationError('Campaign brief too short', { campaign_brief: ['Min 10 chars'] });
    }
    const inf = await this.influencerService.get(workspaceId, input.influencer_id);
    const channel = input.channel ?? 'email';

    const subject = `Collab idea for ${inf.handle}`;
    const greeting = inf.display_name ?? inf.handle;
    const topics = (inf.topics as any) ? (Array.isArray(inf.topics) ? inf.topics.slice(0, 2).join(' and ') : 'your niche') : 'your niche';

    const body =
      `Hi ${greeting},\n\n` +
      `I've been following your work on ${inf.platform} and love how you cover ${topics}. We're putting together a campaign that aligns with what you do, and I'd love to talk.\n\n` +
      `Brief in a sentence: ${input.campaign_brief.trim()}\n\n` +
      `We're flexible on format (single post, story series, or a short reel) and would love your input on what would land best with your audience. Compensation we have budgeted: ~$${inf.estimated_cost_usd ?? 'TBD'}.\n\n` +
      `If this sounds interesting, just reply here and we'll set up a quick call.\n\n` +
      `Cheers!\n`;

    const row = await this.models.Outreach.create({
      workspace_id: workspaceId,
      influencer_id: inf.id,
      channel,
      subject,
      body,
      status: 'draft',
      created_by: userId,
    } as any);
    return this.publicOutreach(row);
  }

  async send(workspaceId: string, id: string) {
    const row = await this.models.Outreach.findOne({ where: { id, workspace_id: workspaceId } });
    if (!row) throw new NotFoundError('Outreach not found');
    if (row.status !== 'draft') throw new BadRequestError(`Cannot send a ${row.status} message`);
    await row.update({ status: 'sent', sent_at: new Date() });
    // Bump the influencer status if still in early stages.
    const inf = await this.models.Influencer.findByPk(row.influencer_id);
    if (inf && (inf.status === 'discovered' || inf.status === 'shortlisted')) {
      await inf.update({ status: 'contacted', last_contacted_at: new Date() });
    }
    return this.publicOutreach(row);
  }

  async markReply(workspaceId: string, id: string, summary: string, outcome: 'replied' | 'accepted' | 'declined') {
    const row = await this.models.Outreach.findOne({ where: { id, workspace_id: workspaceId } });
    if (!row) throw new NotFoundError('Outreach not found');
    await row.update({ status: outcome, replied_at: new Date(), reply_summary: summary });
    const inf = await this.models.Influencer.findByPk(row.influencer_id);
    if (inf) {
      if (outcome === 'accepted') await inf.update({ status: 'negotiating' });
      else if (outcome === 'declined') await inf.update({ status: 'declined' });
    }
    return this.publicOutreach(row);
  }

  async remove(workspaceId: string, id: string) {
    const row = await this.models.Outreach.findOne({ where: { id, workspace_id: workspaceId } });
    if (!row) throw new NotFoundError('Outreach not found');
    await row.destroy();
    return { id, removed: true };
  }

  private publicOutreach(r: any) {
    return {
      id: r.id,
      workspace_id: r.workspace_id,
      influencer_id: r.influencer_id,
      channel: r.channel,
      subject: r.subject,
      body: r.body,
      status: r.status,
      sent_at: r.sent_at,
      replied_at: r.replied_at,
      reply_summary: r.reply_summary,
      created_at: r.created_at,
      influencer: r.influencer
        ? { id: r.influencer.id, platform: r.influencer.platform, handle: r.influencer.handle, display_name: r.influencer.display_name }
        : null,
    };
  }
}
