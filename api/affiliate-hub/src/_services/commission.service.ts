import type { Models } from '../models/index.js';
import type { NotificationClient } from './notification.client.js';
import type { EventBusClient } from './event-bus.client.js';
import {
  NotFoundError,
  ValidationError,
  BadRequestError,
} from '@marketing/shared-middleware';
import type { CommissionStatus } from '../models/commission.model.js';

const VALID_TRANSITIONS: Record<CommissionStatus, CommissionStatus[]> = {
  pending: ['approved', 'rejected'],
  approved: ['paid', 'reversed'],
  paid: ['reversed'],
  reversed: [],
  rejected: [],
};

export class CommissionService {
  constructor(
    private models: Models,
    private notifications: NotificationClient | null = null,
    private eventBus: EventBusClient | null = null,
  ) {}

  /**
   * Record a sale → commission. Idempotent on (workspace_id, order_external_id).
   * Computes commission amount from the affiliate's program.
   */
  async record(workspaceId: string, input: {
    affiliate_id: string;
    tracking_link_id?: string;
    order_external_id: string;
    order_amount_usd: number;
    customer_email?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (!input.order_external_id) {
      throw new ValidationError('order_external_id required', { order_external_id: ['Required'] });
    }
    if (input.order_amount_usd < 0) {
      throw new ValidationError('Order amount must be positive', { order_amount_usd: ['Must be >= 0'] });
    }
    const affiliate = await this.models.Affiliate.findOne({
      where: { id: input.affiliate_id, workspace_id: workspaceId },
      include: [{ model: this.models.AffiliateProgram, as: 'program' }],
    });
    if (!affiliate) throw new NotFoundError('Affiliate not found');

    const existing = await this.models.Commission.findOne({
      where: { workspace_id: workspaceId, order_external_id: input.order_external_id },
    });
    if (existing) return existing;

    const program = (affiliate as any).program;
    const commission =
      program.commission_kind === 'fixed_usd'
        ? Number(program.commission_value)
        : Math.round((Number(input.order_amount_usd) * Number(program.commission_value) / 100) * 100) / 100;

    // Bump the tracking link's conversion counter if it was provided
    if (input.tracking_link_id) {
      const link = await this.models.TrackingLink.findOne({
        where: { id: input.tracking_link_id, workspace_id: workspaceId },
      });
      if (link) await link.increment('conversion_count', { by: 1 });
    }

    const created = await this.models.Commission.create({
      workspace_id: workspaceId,
      affiliate_id: affiliate.id,
      tracking_link_id: input.tracking_link_id ?? null,
      order_external_id: input.order_external_id,
      order_amount_usd: input.order_amount_usd,
      commission_usd: commission,
      currency: 'USD',
      customer_email: input.customer_email?.toLowerCase() ?? null,
      status: 'pending',
      metadata: input.metadata ?? null,
    } as any);

    // Fire-and-forget notification fan-out (internal bell)
    if (this.notifications) {
      void this.notifications.publish({
        workspace_id: workspaceId,
        kind: 'commission.recorded',
        severity: 'info',
        title: `New commission: $${commission.toFixed(2)}`,
        body: `Affiliate ${affiliate.email} earned $${commission.toFixed(2)} on order ${input.order_external_id}`,
        action_url: '/dashboard/affiliate',
        metadata: { commission_id: created.id, affiliate_id: affiliate.id, amount_usd: commission },
      });
    }

    // Fire-and-forget customer event fan-out (outbound webhooks)
    if (this.eventBus) {
      void this.eventBus.publish({
        workspace_id: workspaceId,
        kind: 'commission.recorded',
        payload: {
          commission_id: created.id,
          affiliate_id: affiliate.id,
          affiliate_email: affiliate.email,
          order_external_id: input.order_external_id,
          order_amount_usd: input.order_amount_usd,
          commission_usd: commission,
        },
      });
    }

    return created;
  }

  async list(workspaceId: string, opts: { affiliate_id?: string; status?: string }) {
    const where: any = { workspace_id: workspaceId };
    if (opts.affiliate_id) where.affiliate_id = opts.affiliate_id;
    if (opts.status) where.status = opts.status;
    return this.models.Commission.findAll({
      where,
      order: [['created_at', 'DESC']],
      include: [{ model: this.models.Affiliate, as: 'affiliate' }],
    });
  }

  async transition(workspaceId: string, id: string, to: CommissionStatus) {
    const c = await this.models.Commission.findOne({
      where: { id, workspace_id: workspaceId },
      include: [{ model: this.models.Affiliate, as: 'affiliate' }],
    });
    if (!c) throw new NotFoundError('Commission not found');
    const allowed = VALID_TRANSITIONS[c.status] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestError(`Cannot transition ${c.status} → ${to}`);
    }
    const update: Record<string, unknown> = { status: to };
    if (to === 'approved') update.approved_at = new Date();
    if (to === 'paid') update.paid_at = new Date();
    if (to === 'reversed') update.reversed_at = new Date();
    await c.update(update);

    // Notify workspace on `paid` — that's the milestone worth surfacing.
    if (to === 'paid') {
      const affiliate = (c as any).affiliate;
      const amount = Number(c.commission_usd);
      if (this.notifications) {
        void this.notifications.publish({
          workspace_id: workspaceId,
          kind: 'commission.paid',
          severity: 'success',
          title: `Commission paid: $${amount.toFixed(2)}`,
          body: `Paid out $${amount.toFixed(2)} to ${affiliate?.email ?? 'affiliate'} for order ${c.order_external_id}`,
          action_url: '/dashboard/affiliate',
          metadata: { commission_id: c.id, affiliate_id: c.affiliate_id, amount_usd: amount },
        });
      }
      if (this.eventBus) {
        void this.eventBus.publish({
          workspace_id: workspaceId,
          kind: 'commission.paid',
          payload: {
            commission_id: c.id,
            affiliate_id: c.affiliate_id,
            affiliate_email: affiliate?.email ?? null,
            order_external_id: c.order_external_id,
            commission_usd: amount,
          },
        });
      }
    }

    return c;
  }

  /** Roll-up for a workspace: pending/approved/paid totals + counts. */
  async summary(workspaceId: string) {
    const rows = await this.models.Commission.findAll({
      where: { workspace_id: workspaceId },
      attributes: ['status', 'commission_usd'],
    });
    const totals: Record<string, { count: number; usd: number }> = {
      pending: { count: 0, usd: 0 },
      approved: { count: 0, usd: 0 },
      paid: { count: 0, usd: 0 },
      reversed: { count: 0, usd: 0 },
      rejected: { count: 0, usd: 0 },
    };
    for (const r of rows) {
      const k = (r as any).status as string;
      const bucket = totals[k] ?? { count: 0, usd: 0 };
      bucket.count++;
      bucket.usd += Number((r as any).commission_usd ?? 0);
      totals[k] = bucket;
    }
    for (const k of Object.keys(totals)) totals[k]!.usd = Math.round(totals[k]!.usd * 100) / 100;
    return totals;
  }
}
