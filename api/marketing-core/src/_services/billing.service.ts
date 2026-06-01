import type { Models } from '../models/index.js';
import type { StripeDriver, SubscriptionData } from './stripe.driver.js';
import {
  ForbiddenError,
  NotFoundError,
  BadRequestError,
} from '@marketing/shared-middleware';

export interface BillingServiceDeps {
  models: Models;
  stripeDriver: StripeDriver;
  appBaseUrl: string;
  priceMap: { starter?: string; pro?: string; agency?: string };
  logger?: { info: (obj: unknown, msg?: string) => void; warn?: (obj: unknown, msg?: string) => void };
}

export class BillingService {
  constructor(private deps: BillingServiceDeps) {}

  async getSubscription(workspaceId: string, requesterUserId: string) {
    await this.requireOwner(workspaceId, requesterUserId);
    const sub = await this.deps.models.Subscription.findOne({
      where: { workspace_id: workspaceId },
    });
    return sub;
  }

  async createCheckout(input: {
    workspace_id: string;
    requester_user_id: string;
    plan_slug: 'starter' | 'pro' | 'agency';
  }): Promise<{ session_id: string; url: string }> {
    await this.requireOwner(input.workspace_id, input.requester_user_id);
    const priceId = this.deps.priceMap[input.plan_slug];
    if (!priceId) {
      throw new BadRequestError(
        `No Stripe price configured for plan "${input.plan_slug}". Set STRIPE_PRICE_${input.plan_slug.toUpperCase()}.`,
      );
    }
    const workspace = await this.deps.models.Workspace.findByPk(input.workspace_id);
    if (!workspace) throw new NotFoundError('Workspace not found');
    const user = await this.deps.models.User.findByPk(input.requester_user_id);
    if (!user) throw new NotFoundError('User not found');

    const successUrl = `${this.deps.appBaseUrl}/app/workspace/billing/return`;
    const cancelUrl = `${this.deps.appBaseUrl}/app/workspace/billing`;

    const session = await this.deps.stripeDriver.createCheckoutSession({
      workspace_id: workspace.id,
      customer_id: workspace.stripe_customer_id ?? null,
      customer_email: user.user_email,
      price_id: priceId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      workspace_name: workspace.name,
    });
    this.deps.logger?.info(
      { workspace_id: workspace.id, plan: input.plan_slug, session_id: session.session_id },
      'checkout_session_created',
    );
    return session;
  }

  /**
   * Apply a parsed Stripe subscription event (called by the webhook handler).
   * Idempotent — repeated events for the same subscription just update the row.
   */
  async applySubscriptionEvent(workspaceId: string, sub: SubscriptionData): Promise<void> {
    const { Subscription, Workspace } = this.deps.models;
    const existing = await Subscription.findOne({ where: { workspace_id: workspaceId } });

    const payload = {
      workspace_id: workspaceId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: sub.customer_id,
      status: sub.status as any,
      current_period_end: sub.current_period_end,
      cancel_at_period_end: sub.cancel_at_period_end,
      canceled_at: sub.canceled_at,
    };

    if (existing) {
      await existing.update(payload);
    } else {
      await Subscription.create(payload as any);
    }

    const ws = await Workspace.findByPk(workspaceId);
    if (ws && sub.customer_id && !ws.stripe_customer_id) {
      await ws.update({ stripe_customer_id: sub.customer_id });
    }
    if (ws) {
      const newWsStatus = mapSubToWorkspaceStatus(sub.status);
      if (newWsStatus && ws.status !== newWsStatus) {
        await ws.update({ status: newWsStatus });
      }
    }
  }

  /** A workspace_id appears in the Stripe subscription metadata. */
  resolveWorkspaceIdFromEvent(event: any): string | null {
    const sub = event?.data?.object;
    if (!sub) return null;
    return sub.metadata?.workspace_id ?? null;
  }

  private async requireOwner(workspaceId: string, userId: string) {
    const membership = await this.deps.models.WorkspaceMember.findOne({
      where: { workspace_id: workspaceId, user_id: userId, status: 'active' },
    });
    if (!membership) throw new ForbiddenError('You are not a member of this workspace');
    if (membership.role !== 'owner') {
      throw new ForbiddenError('Only the workspace owner may manage billing');
    }
  }
}

function mapSubToWorkspaceStatus(
  stripeStatus: string,
): 'active' | 'past_due' | 'cancelled' | 'suspended' | null {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelled';
    case 'paused':
      return 'suspended';
    default:
      return null;
  }
}
