import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { BillingService } from '../_services/billing.service.js';
import type { StripeDriver } from '../_services/stripe.driver.js';
import type { AuditService } from '../_services/audit.service.js';
import { ValidationError, BadRequestError } from '@marketing/shared-middleware';

const checkoutSchema = Joi.object({
  plan_slug: Joi.string().valid('starter', 'pro', 'agency').required(),
});

export class BillingController {
  constructor(
    private billingService: BillingService,
    private stripeDriver: StripeDriver,
    private auditService: AuditService,
    private isStub: boolean,
  ) {}

  /** GET /workspaces/:workspace_id/billing */
  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const workspace_id = req.params.workspace_id as string;
      const sub = await this.billingService.getSubscription(workspace_id, req.user!.id);
      res.json({
        data: {
          subscription: sub
            ? {
                id: sub.id,
                status: sub.status,
                plan_id: sub.plan_id,
                stripe_subscription_id: sub.stripe_subscription_id,
                current_period_end: sub.current_period_end,
                cancel_at_period_end: sub.cancel_at_period_end,
              }
            : null,
          driver: this.isStub ? 'stub' : 'stripe',
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /** POST /workspaces/:workspace_id/billing/checkout */
  checkout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = checkoutSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(
          new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }),
        );
      }
      const workspace_id = req.params.workspace_id as string;
      const result = await this.billingService.createCheckout({
        workspace_id,
        requester_user_id: req.user!.id,
        plan_slug: value.plan_slug,
      });
      this.auditService
        .record({
          workspace_id,
          actor_user_id: req.user!.id,
          action: 'billing.checkout_started',
          target_type: 'workspace',
          target_id: workspace_id,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'] as string,
          request_id: req.id,
          metadata: { plan_slug: value.plan_slug, session_id: result.session_id },
        })
        .catch(() => undefined);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  /** POST /billing/webhook (Stripe → our service) — raw body, signature-verified. */
  webhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (this.isStub) {
        return next(new BadRequestError('Stripe driver is in stub mode'));
      }
      const sig = req.headers['stripe-signature'] as string | undefined;
      if (!sig) {
        return next(new BadRequestError('Missing stripe-signature header'));
      }
      let event: any;
      try {
        event = this.stripeDriver.constructWebhookEvent(req.body as Buffer, sig);
      } catch (e: any) {
        return next(new BadRequestError(`Webhook signature failed: ${e.message}`));
      }
      const parsed = this.stripeDriver.parseSubscriptionEvent(event);
      const workspace_id = this.billingService.resolveWorkspaceIdFromEvent(event);
      if (parsed && workspace_id) {
        await this.billingService.applySubscriptionEvent(workspace_id, parsed);
        this.auditService
          .record({
            workspace_id,
            actor_type: 'system',
            action: `billing.${event.type.replace(/\./g, '_')}`,
            target_type: 'subscription',
            target_id: parsed.id,
            metadata: { status: parsed.status },
          })
          .catch(() => undefined);
      }
      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  };
}
