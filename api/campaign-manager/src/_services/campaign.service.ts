import type { Sequelize } from 'sequelize';
import type { Models } from '../models/index.js';
import type { EmailHubClient } from './email-hub.client.js';
import {
  NotFoundError,
  ValidationError,
  BadRequestError,
} from '@marketing/shared-middleware';

export interface CampaignCreateInput {
  name: string;
  description?: string;
  kind: 'email' | 'social' | 'multi_channel' | 'one_click';
  goal?: string;
  channels?: Array<{
    kind: string;
    config: Record<string, unknown>;
  }>;
}

export class CampaignService {
  constructor(
    private sequelize: Sequelize,
    private models: Models,
    private emailHubClient: EmailHubClient,
  ) {}

  async list(workspaceId: string, opts: { limit?: number; offset?: number; status?: string }) {
    const where: any = { workspace_id: workspaceId };
    if (opts.status) where.status = opts.status;
    const { rows, count } = await this.models.Campaign.findAndCountAll({
      where,
      include: [{ model: this.models.CampaignChannel, as: 'channels' }],
      order: [['created_at', 'DESC']],
      limit: Math.min(opts.limit ?? 50, 200),
      offset: opts.offset ?? 0,
    });
    for (const r of rows) this.normaliseChannelConfigs(r as any);
    return { rows, total: count };
  }

  async get(workspaceId: string, id: string) {
    const c = await this.models.Campaign.findOne({
      where: { id, workspace_id: workspaceId },
      include: [{ model: this.models.CampaignChannel, as: 'channels' }],
    });
    if (!c) throw new NotFoundError('Campaign not found');
    this.normaliseChannelConfigs(c as any);
    return c;
  }

  /** MySQL JSON columns can come back as strings; defensively parse. */
  private normaliseChannelConfigs(c: any): void {
    const channels = c?.channels as any[] | undefined;
    if (!channels) return;
    for (const ch of channels) {
      if (typeof ch.config === 'string') {
        try {
          ch.config = JSON.parse(ch.config);
        } catch {
          /* leave as-is */
        }
      }
    }
  }

  async create(workspaceId: string, userId: string, input: CampaignCreateInput) {
    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError('Invalid name', { name: ['Required'] });
    }
    const campaignId = await this.sequelize.transaction(async (t) => {
      const campaign = await this.models.Campaign.create(
        {
          workspace_id: workspaceId,
          name: input.name.trim(),
          description: input.description ?? null,
          kind: input.kind,
          status: 'draft',
          goal: input.goal ?? null,
          created_by: userId,
        } as any,
        { transaction: t },
      );
      if (input.channels?.length) {
        for (const ch of input.channels) {
          await this.models.CampaignChannel.create(
            {
              campaign_id: campaign.id,
              kind: ch.kind,
              status: 'pending',
              config: ch.config,
            } as any,
            { transaction: t },
          );
        }
      }
      return campaign.id;
    });
    return this.get(workspaceId, campaignId);
  }

  async update(
    workspaceId: string,
    id: string,
    patch: {
      name?: string;
      description?: string;
      goal?: string;
      status?: 'draft' | 'paused' | 'cancelled';
      scheduled_at?: Date | null;
    },
  ) {
    const c = await this.get(workspaceId, id);
    if (patch.status && !['draft', 'paused', 'cancelled'].includes(patch.status)) {
      throw new BadRequestError(`Cannot transition to ${patch.status} directly`);
    }
    await c.update(patch);
    return this.get(workspaceId, id);
  }

  async remove(workspaceId: string, id: string) {
    const c = await this.get(workspaceId, id);
    if (c.status === 'sending') {
      throw new BadRequestError('Cannot delete a campaign that is currently sending');
    }
    await this.sequelize.transaction(async (t) => {
      await this.models.CampaignChannel.destroy({ where: { campaign_id: id }, transaction: t });
      await c.destroy({ transaction: t });
    });
    return { id, removed: true };
  }

  /**
   * Mark campaign as sending and dispatch each channel. For Increment 1, only the
   * `email` channel is implemented — it calls email-hub. Other channels are
   * marked `skipped` so the workflow remains observable.
   */
  async dispatch(workspaceId: string, campaignId: string) {
    const c = await this.get(workspaceId, campaignId);
    if (c.status === 'sending' || c.status === 'completed') {
      throw new BadRequestError(`Campaign is already ${c.status}`);
    }
    const channels = (c as any).channels as any[];
    if (!channels || channels.length === 0) {
      throw new BadRequestError('Campaign has no channels to send');
    }

    await c.update({ status: 'sending', started_at: new Date() });

    const results: Array<{ channel_id: string; kind: string; status: string; external_id?: string; error?: string }> = [];

    for (const ch of channels) {
      try {
        if (ch.kind === 'email') {
          const cfg = (typeof ch.config === 'string' ? JSON.parse(ch.config) : ch.config) as any;
          if (!cfg?.subject || !cfg?.html) {
            throw new Error('Email channel config requires { subject, html, text? }');
          }
          const result = await this.emailHubClient.send(workspaceId, {
            workspace_id: workspaceId,
            subject: cfg.subject,
            html: cfg.html,
            text: cfg.text ?? stripHtml(cfg.html),
            list_id: cfg.list_id,
            inline_filter: cfg.inline_filter,
            utm: cfg.utm,
          });
          await ch.update({
            status: 'queued',
            external_id: result.send_id,
            sent_at: new Date(),
          });
          results.push({ channel_id: ch.id, kind: 'email', status: 'queued', external_id: result.send_id });
        } else {
          await ch.update({ status: 'skipped', error: 'Channel kind not yet implemented in Phase 2 Increment 1' });
          results.push({ channel_id: ch.id, kind: ch.kind, status: 'skipped' });
        }
      } catch (e: any) {
        await ch.update({ status: 'failed', error: e.message?.slice(0, 1900) ?? 'unknown' });
        results.push({ channel_id: ch.id, kind: ch.kind, status: 'failed', error: e.message });
      }
    }

    // Determine overall campaign status
    const sentOrQueued = channels.filter((ch: any) => ['queued', 'sent'].includes(ch.status)).length;
    const newStatus = sentOrQueued > 0 ? 'completed' : 'paused';
    await c.update({ status: newStatus, completed_at: newStatus === 'completed' ? new Date() : null });

    return { campaign_id: c.id, status: newStatus, results };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
