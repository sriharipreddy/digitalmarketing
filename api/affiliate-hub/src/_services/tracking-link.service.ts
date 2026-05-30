import crypto from 'node:crypto';
import type { Models } from '../models/index.js';
import {
  NotFoundError,
  ValidationError,
  BadRequestError,
} from '@marketing/shared-middleware';

export class TrackingLinkService {
  constructor(private models: Models) {}

  async list(workspaceId: string, opts: { affiliate_id?: string }) {
    const where: any = { workspace_id: workspaceId };
    if (opts.affiliate_id) where.affiliate_id = opts.affiliate_id;
    return this.models.TrackingLink.findAll({
      where,
      order: [['created_at', 'DESC']],
      include: [{ model: this.models.Affiliate, as: 'affiliate' }],
    });
  }

  async create(workspaceId: string, input: {
    affiliate_id: string;
    destination_url: string;
    label?: string;
  }) {
    if (!/^https?:\/\//i.test(input.destination_url)) {
      throw new ValidationError('Invalid destination URL', {
        destination_url: ['Must start with http(s)'],
      });
    }
    const affiliate = await this.models.Affiliate.findOne({
      where: { id: input.affiliate_id, workspace_id: workspaceId },
    });
    if (!affiliate) throw new NotFoundError('Affiliate not found');
    if (affiliate.status !== 'approved') {
      throw new BadRequestError(`Affiliate is ${affiliate.status} — approve them before creating links`);
    }
    const short_code = await this.uniqueCode();
    return this.models.TrackingLink.create({
      workspace_id: workspaceId,
      affiliate_id: affiliate.id,
      short_code,
      destination_url: input.destination_url,
      label: input.label ?? null,
    } as any);
  }

  /** PUBLIC click handler — returns destination URL + sets attribution cookie. */
  async resolveClick(short_code: string): Promise<{
    destination_url: string;
    affiliate_id: string;
    workspace_id: string;
    tracking_link_id: string;
  } | null> {
    const link = await this.models.TrackingLink.findOne({ where: { short_code } });
    if (!link) return null;
    await link.increment('click_count', { by: 1 });
    return {
      destination_url: link.destination_url,
      affiliate_id: link.affiliate_id,
      workspace_id: link.workspace_id,
      tracking_link_id: link.id,
    };
  }

  async remove(workspaceId: string, id: string) {
    const l = await this.models.TrackingLink.findOne({
      where: { id, workspace_id: workspaceId },
    });
    if (!l) throw new NotFoundError('Tracking link not found');
    await l.destroy();
    return { id, removed: true };
  }

  private async uniqueCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const candidate = crypto.randomBytes(5).toString('base64url').slice(0, 8);
      const exists = await this.models.TrackingLink.findOne({ where: { short_code: candidate } });
      if (!exists) return candidate;
    }
    throw new Error('Could not generate unique tracking short_code');
  }
}
