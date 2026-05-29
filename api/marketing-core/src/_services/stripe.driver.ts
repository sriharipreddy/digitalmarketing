import Stripe from 'stripe';

export interface CheckoutInput {
  workspace_id: string;
  customer_id?: string | null;
  customer_email: string;
  price_id: string;
  success_url: string;
  cancel_url: string;
  workspace_name?: string;
}

export interface CheckoutResult {
  session_id: string;
  url: string;
}

export interface SubscriptionData {
  id: string;
  status: string;
  customer_id: string;
  price_id: string | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  canceled_at: Date | null;
}

export interface StripeDriver {
  createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult>;
  fetchSubscription(subscriptionId: string): Promise<SubscriptionData>;
  constructWebhookEvent(payload: Buffer, signature: string): unknown;
  parseSubscriptionEvent(event: any): SubscriptionData | null;
}

export class RealStripeDriver implements StripeDriver {
  private stripe: Stripe;
  constructor(
    secretKey: string,
    private webhookSecret: string,
  ) {
    this.stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });
  }

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult> {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: input.customer_id ?? undefined,
      customer_email: input.customer_id ? undefined : input.customer_email,
      line_items: [{ price: input.price_id, quantity: 1 }],
      success_url: `${input.success_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: input.cancel_url,
      subscription_data: {
        metadata: { workspace_id: input.workspace_id, workspace_name: input.workspace_name ?? '' },
      },
      metadata: { workspace_id: input.workspace_id },
    });
    return { session_id: session.id, url: session.url! };
  }

  async fetchSubscription(subscriptionId: string): Promise<SubscriptionData> {
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId);
    return this.toSubscriptionData(sub);
  }

  constructWebhookEvent(payload: Buffer, signature: string): unknown {
    return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }

  parseSubscriptionEvent(event: any): SubscriptionData | null {
    const kind = event.type as string;
    if (!kind.startsWith('customer.subscription.') && kind !== 'checkout.session.completed') {
      return null;
    }
    if (kind === 'checkout.session.completed') {
      const session = event.data.object;
      if (!session.subscription) return null;
      return {
        id: session.subscription as string,
        status: 'active',
        customer_id: session.customer as string,
        price_id: null,
        current_period_end: null,
        cancel_at_period_end: false,
        canceled_at: null,
      };
    }
    return this.toSubscriptionData(event.data.object as Stripe.Subscription);
  }

  private toSubscriptionData(sub: Stripe.Subscription): SubscriptionData {
    return {
      id: sub.id,
      status: sub.status,
      customer_id: sub.customer as string,
      price_id: sub.items.data[0]?.price?.id ?? null,
      current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    };
  }
}

/**
 * Stub driver — returns deterministic fake checkout URLs so the UI flow
 * can be exercised end-to-end without real Stripe keys.
 */
export class StubStripeDriver implements StripeDriver {
  constructor(private logger: { info: (obj: unknown, msg?: string) => void }) {}

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult> {
    const session_id = `cs_test_stub_${Date.now()}`;
    this.logger.info({ session_id, workspace_id: input.workspace_id, price_id: input.price_id }, 'stripe_checkout_stub');
    return {
      session_id,
      // We return the success_url directly so the UI flow lands on the post-checkout page.
      url: `${input.success_url}?session_id=${session_id}&stub=1`,
    };
  }

  async fetchSubscription(subscriptionId: string): Promise<SubscriptionData> {
    return {
      id: subscriptionId,
      status: 'active',
      customer_id: `cus_test_stub`,
      price_id: null,
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancel_at_period_end: false,
      canceled_at: null,
    };
  }

  constructWebhookEvent(): unknown {
    throw new Error('Stub driver does not accept webhooks');
  }

  parseSubscriptionEvent(): SubscriptionData | null {
    return null;
  }
}
