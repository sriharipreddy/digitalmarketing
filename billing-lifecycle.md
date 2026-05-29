# 💳 Billing Lifecycle
## Stripe Integration · Plans · Dunning · Refunds · Tax

> Every state a subscription can be in, every transition, every customer-facing flow, and every edge case.

---

## 📋 Table of Contents

1. [Plans & Pricing](#plans--pricing)
2. [Free Trial Mechanics](#free-trial-mechanics)
3. [Subscription State Machine](#subscription-state-machine)
4. [Stripe Integration](#stripe-integration)
5. [Dunning (Failed Payments)](#dunning-failed-payments)
6. [Upgrades, Downgrades & Proration](#upgrades-downgrades--proration)
7. [Cancellation & Refunds](#cancellation--refunds)
8. [Tax (VAT, GST, Sales Tax)](#tax)
9. [Affiliate Payouts (Stripe Connect)](#affiliate-payouts-stripe-connect)
10. [Invoices, Receipts & Records](#invoices-receipts--records)
11. [SLA & Service Credits](#sla--service-credits)
12. [Edge Cases](#edge-cases)

---

## Plans & Pricing

### Tier Structure

| Plan | Monthly | Yearly (20% off) | Target Customer |
|---|---|---|---|
| **Free** | £0 | £0 | Solo creators, evaluating |
| **Starter** | £29/mo | £278/yr | Local business owner, 1-person shop |
| **Pro** | £79/mo | £758/yr | Growing business, small team |
| **Agency** | £249/mo | £2,390/yr | Marketing agency, 5+ clients |
| **Enterprise** | Custom (£1,500+/mo) | Custom | 100k+ contacts, SAML SSO, dedicated CSM |

### Free Plan Limits

```javascript
{
  workspaces: 1,
  keywords: 25,                  // SEO tracking
  campaigns: 1,
  team_members: 1,
  email_subscribers: 500,
  email_sends_per_month: 2000,
  ai_credits_per_month: 100,
  social_accounts_connected: 2,
  social_posts_per_month: 30,
  features: {
    one_click_capture: false,    // Pro+ only
    competitor_intel: false,
    advanced_analytics: false,
    affiliates: false,
    influencers: false,
    white_label: false,
    public_api: false,
    custom_domain: false,
  }
}
```

### Starter (£29/mo)
```javascript
{
  keywords: 100,
  campaigns: 5,
  team_members: 2,
  email_subscribers: 2500,
  email_sends_per_month: 25000,
  ai_credits_per_month: 500,
  social_accounts_connected: 5,
  social_posts_per_month: 200,
  sms_sends_per_month: 100,
  features: {
    seo: true,
    content: true,
    social: true,
    email: true,
    crm: true,
    basic_analytics: true,
    // Premium features locked
  }
}
```

### Pro (£79/mo) — Most popular
```javascript
{
  keywords: 1000,
  campaigns: 25,
  team_members: 5,
  email_subscribers: 25000,
  email_sends_per_month: 250000,
  ai_credits_per_month: 5000,
  social_accounts_connected: 15,
  social_posts_per_month: 1000,
  sms_sends_per_month: 1000,
  features: {
    everything_in_starter: true,
    one_click_capture: true,      // FLAGSHIP unlocked
    competitor_intel: true,
    influencers: true,
    affiliates: true,
    advanced_analytics: true,
    multi_touch_attribution: true,
    a_b_testing: true,
    public_api: true,
  }
}
```

### Agency (£249/mo)
```javascript
{
  max_client_workspaces: 25,     // sub-workspaces
  team_members_total: 25,
  // Per-client limits aggregated
  features: {
    everything_in_pro: true,
    white_label: true,            // custom domain, logo, colours
    client_portal_branded: true,
    bulk_reports: true,
    client_billing: true,         // bill clients through platform
    higher_api_rate_limit: true,
    priority_support: true,
  }
}

// Add-ons:
{
  additional_client: '£10/mo per extra client beyond 25',
  white_label_email_domain: '£20/mo',
}
```

### Enterprise (custom)
- Negotiated based on volume
- Includes:
  - SAML/OIDC SSO
  - Custom retention policies
  - Dedicated CSM (customer success manager)
  - Custom DPA terms
  - Phone support + 1-hour SLA
  - Optional on-premise data residency
  - SOC 2 Type 2 report + security questionnaire support

### Add-Ons (any plan)

| Add-on | Price | Note |
|---|---|---|
| **Extra AI credits** | £20 per 1,000 credits | Top-up, never expires |
| **Extra email sends** | £5 per 10,000 sends | Top-up |
| **Extra keywords tracked** | £5 per 100 keywords/month | Recurring |
| **Premium SEO data** | £50/mo | DataForSEO Premium API tier |
| **Phone support** | £100/mo | All plans |

---

## Free Trial Mechanics

### Standard Trial

| Plan | Trial Length | Card Required? |
|---|---|---|
| Starter | 14 days | No (credit card optional) |
| Pro | 14 days | No (credit card optional) |
| Agency | 14 days | **Yes** (verified card required) |
| Enterprise | Pilot | Custom (1-3 months) |

### Trial Flow

```
Day 0: Sign up → choose plan → 14-day trial begins
        Email: "Welcome to your trial"

Day 1-3: Onboarding wizard pushes activation
        Day 3 if not activated: "Need help getting started?"

Day 7: Mid-trial nudge
        "You're halfway through — here's what users like you achieved"
        + Show their analytics: visitors, keywords tracked, posts published

Day 11: 3-day warning
        Email: "Your trial ends in 3 days. Add a card to continue."
        In-app banner: countdown timer

Day 13: 1-day warning
        Email: "Trial ends tomorrow"
        In-app urgent notification

Day 14: Trial ends
        IF card on file: convert to paid (Stripe charges automatically)
        IF no card: workspace → 'past_due' state with 7-day grace
                    Days 14-20: read-only access, prominent "Add card" CTA
        Day 21: 'suspended' state (see state machine)
```

### Trial Extensions

- Customers can request a 7-day extension once (self-serve in Settings → Billing)
- Sales team can grant up to 30-day extensions (logged in audit log)

### Activation Definition

A workspace is "activated" when the user has:
- ✅ Connected at least one channel (Google, Meta, etc.)
- ✅ Created at least one campaign OR run an SEO audit
- ✅ Invited at least one team member (if plan supports)
- ✅ Logged in 3+ times

Activation rate is the #1 health metric. Onboarding flow is optimised to maximise this.

---

## Subscription State Machine

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                          ┌──────────┐                                  │
│                          │  trial   │ ◄──── new signup                 │
│                          └─────┬────┘                                  │
│                                │                                       │
│            ┌───────────────────┼──────────────────┐                    │
│            │                   │                  │                    │
│            ▼                   ▼                  ▼                    │
│  ┌─────────────────┐   ┌────────────────┐  ┌─────────────────┐         │
│  │  trial_expired  │   │     active     │  │ cancelled_trial │         │
│  │  (no card)      │   │ (card charged) │  │ (user clicked   │         │
│  └────────┬────────┘   └────────┬───────┘  │  cancel during  │         │
│           │                     │          │   trial)        │         │
│           │ +7d                 ▼          └─────────────────┘         │
│           ▼              ┌───────────┐                                 │
│      ┌────────────┐      │  past_due │ ◄── Stripe payment failed      │
│      │ suspended  │ ◄────┤  (3d grace)│                                │
│      └─────┬──────┘ +7d  └─────┬─────┘                                 │
│            │                   │                                       │
│            │                   │ payment succeeds                     │
│            │                   └───────────► back to active          │
│            │                                                           │
│            │ +23d total                                                │
│            ▼                                                           │
│      ┌────────────┐        user cancels        ┌─────────────────┐    │
│      │ cancelled  │ ◄───────────────────────── │ active/past_due │    │
│      └─────┬──────┘                            └─────────────────┘    │
│            │                                                           │
│            │ +30d (export window)                                      │
│            ▼                                                           │
│  ┌──────────────────┐                                                  │
│  │ pending_deletion │                                                  │
│  └─────────┬────────┘                                                  │
│            │ +30d (legal grace)                                        │
│            ▼                                                           │
│      ┌──────────┐                                                      │
│      │ deleted  │ ── hard delete from DBs, S3, ES                      │
│      └──────────┘ ── only anonymised audit log remains                 │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### State Transitions

| From | To | Trigger | Effects |
|---|---|---|---|
| `trial` | `active` | First successful charge | Full plan features unlock |
| `trial` | `trial_expired` | Day 14 + no card | Workspace becomes read-only; prominent upgrade CTA |
| `trial` | `cancelled_trial` | User cancels during trial | Workspace marked for deletion in 30 days |
| `active` | `past_due` | Stripe webhook: `invoice.payment_failed` | 3-day soft grace; full access continues |
| `past_due` | `active` | Successful retry | Resume normal billing |
| `past_due` | `suspended` | 7 days past_due | Read-only mode; queues paused except billing |
| `trial_expired` | `suspended` | +7 days | Read-only; queues paused |
| `active`/`suspended` | `cancelled` | User clicks Cancel | Subscription set to end at period_end (Stripe) |
| `cancelled` | `pending_deletion` | +30 days export window | No login allowed; queued for hard delete |
| `pending_deletion` | `deleted` | +30 days legal grace | Hard delete via `mkt-workspace-deletion` |

### What Happens to Operations in Each State

| State | Login | Campaigns | Scheduled Posts | Drips | Crons | OAuth Tokens |
|---|---|---|---|---|---|---|
| `trial` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `active` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `past_due` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `trial_expired` | ✅ (read-only) | ❌ paused | ❌ held | ❌ paused | ❌ paused | ✅ |
| `suspended` | ✅ (read-only) | ❌ paused | ❌ held | ❌ paused | ❌ paused | ✅ |
| `cancelled` | ✅ (read-only, 30d) | ❌ paused | ❌ held | ❌ paused | ❌ paused | ✅ |
| `pending_deletion` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ revoked |
| `deleted` | ❌ | — | — | — | — | — (data gone) |

### Re-activation Flow

Customer who returned within the 30-day export window:
1. Pays outstanding invoice via Stripe Customer Portal
2. State → `active`
3. Show notification: "Welcome back! These items were paused — resume now?"
   - Scheduled posts (with old timestamps — offer to reschedule)
   - Drip sequences (offer to resume from current step)
   - Ad campaigns (require manual restart at the ad platform)

---

## Stripe Integration

### Architecture

```
Frontend (React + Vite SPA)
    ↓ Stripe.js (Elements for card capture)
    ↓ POST /api/v1/core/billing/subscribe
marketing-core
    ↓ Stripe API (server-side)
Stripe
    ↓ Webhook: invoice.paid / payment_intent.succeeded / etc.
marketing-core /webhook/stripe
    ↓ verify signature → enqueue mkt-stripe-event → 200 OK
mkt-stripe-event Bull job
    ↓ Process event idempotently → update core_subscriptions
```

### Stripe Objects

| Marketing Platform | Stripe Object |
|---|---|
| `core_workspaces.stripe_customer_id` | `Customer` |
| `core_subscriptions.stripe_subscription_id` | `Subscription` |
| `core_plans.stripe_price_id_monthly/yearly` | `Price` (one per billing cadence) |
| `core_subscriptions.stripe_payment_method_id` | `PaymentMethod` |
| Add-on top-ups | `InvoiceItem` (charge immediately on next invoice) |
| Affiliate payouts | `Transfer` (via Connect Express account) |

### Key Webhook Events Handled

| Event | Handler | Effect |
|---|---|---|
| `customer.subscription.created` | `onSubscriptionCreated` | Create `core_subscriptions` row, set workspace to `active` |
| `customer.subscription.updated` | `onSubscriptionUpdated` | Sync plan_id, period_end |
| `customer.subscription.deleted` | `onSubscriptionDeleted` | Workspace → `cancelled` state |
| `invoice.paid` | `onInvoicePaid` | Reset past_due flag, send receipt |
| `invoice.payment_failed` | `onInvoicePaymentFailed` | Workspace → `past_due`, start dunning |
| `invoice.payment_action_required` | `onPaymentActionRequired` | Email customer to authenticate 3DS |
| `payment_method.attached` | `onPaymentMethodAttached` | Update default payment method, send confirmation |
| `customer.subscription.trial_will_end` | `onTrialWillEnd` | Sent 3 days before trial ends; trigger upgrade reminder |
| `charge.dispute.created` | `onDisputeCreated` | Suspend workspace, alert team |

### Idempotency

Every webhook handler uses `core_idempotency_keys` (see `security.md`) to ensure replays don't double-process.

### Test Mode vs Live Mode

- All development uses Stripe test mode (`sk_test_...`)
- Staging uses Stripe test mode with realistic-looking test data
- Only production uses live mode (`sk_live_...`)
- Stripe webhook endpoints separate per environment

---

## Dunning (Failed Payments)

When `invoice.payment_failed` fires, start the dunning sequence.

### Dunning Schedule

| Day | Action |
|---|---|
| **Day 0** | Stripe Smart Retries: automatic retry within 24-48h |
| **Day 1** | Email: "Your payment didn't go through" + link to update card |
| **Day 3** | Email reminder + in-app banner |
| **Day 5** | Email: "Update your payment to keep your account" + 24h warning |
| **Day 7** | Workspace → `suspended`. Email: "Your account is suspended" |
| **Day 14** | Email: "Last chance — 7 days until cancellation" |
| **Day 21** | Final email |
| **Day 23** | Workspace → `cancelled`, queue exports for the customer |

### Stripe Smart Retries

Configure in Stripe Dashboard → Billing → Subscription settings:
- Retry attempts: 4
- Schedule: 3 days, 5 days, 7 days, 10 days after failure
- Final action: Mark subscription unpaid (we treat as `cancelled` after our 23-day window)

### Communication Tone

Dunning emails are **friendly, not threatening**. Goal: recover payment, not chase debt.

Subject line examples:
- ❌ "PAYMENT OVERDUE - ACTION REQUIRED"
- ✅ "We couldn't process your payment for {workspace}"
- ✅ "Your card needs updating, {first_name}"

### Save Flow

Inside the "Cancel Subscription" UI:
1. **Pause** — pause for 30/60/90 days, no charges, full restore on return (Stripe `pause_collection`)
2. **Discount** — 30% off next 3 months
3. **Downgrade** — suggest a cheaper plan that fits their usage
4. **Talk to us** — book a call with success team

Test shows 35-50% of cancellation intent recovered with a good save flow.

---

## Upgrades, Downgrades & Proration

### Upgrades (immediate effect, prorated charge)

Customer on Starter (£29/mo, 10 days into cycle) upgrades to Pro (£79/mo):
1. Stripe creates proration: charge **immediately** for 20 remaining days at the price difference
   - Pro daily rate: £79/30 = £2.63
   - Starter daily rate: £29/30 = £0.97
   - Proration: 20 × (£2.63 - £0.97) = **£33.20** charged today
2. Next regular invoice: full Pro price (£79)
3. Workspace plan_id updates immediately
4. Feature flags refresh from Redis within 5 minutes

### Downgrades (effect at next billing cycle, no refund)

Customer on Pro (£79/mo) downgrades to Starter (£29/mo):
1. Subscription set to change at next period_end (Stripe API)
2. Workspace plan_id unchanged for current cycle
3. UI shows: "Downgrade scheduled for [date]. Until then, you have full Pro features."
4. **Limit warning**: if customer has 1,500 keywords but Starter allows 100:
   - Warn before confirming downgrade
   - Force user to delete excess data OR keep current plan
5. At period_end: plan_id updates, excess data hidden (not deleted)

### Cancel Downgrade

Before period_end, customer can cancel the scheduled downgrade — no charges adjusted.

### Yearly Upgrade Discount Path

If on monthly and upgrading to yearly:
- Annual price applied immediately
- Prorate the remaining monthly period as a credit
- Customer pays balance now, then yearly going forward

---

## Cancellation & Refunds

### Cancellation Flow

```
1. Settings → Billing → "Cancel Subscription" button
2. Modal: "Are you sure?"
3. Required: select reason
   - Too expensive
   - Not enough features
   - Switching to competitor (which one?)
   - Business closing
   - Other (free text)
4. Save flow (Pause / Discount / Downgrade / Talk to us)
5. If still cancelling: enter password (security)
6. Subscription cancel_at_period_end = true
7. Confirmation email with end date
8. Banner in UI: "Subscription ends [date]. Resume anytime before then."
```

### After Period Ends

- Workspace state → `cancelled`
- Read-only access for 30 days (data export window)
- Customer can still log in to download data
- All scheduled actions paused
- All Bull queues except `mkt-data-export` and `mkt-workspace-deletion` skip this workspace

### Refund Policy

**Eligible for self-serve refund:**
- First charge of subscription within 14 days
- Customer hasn't sent > 100 emails or used > 100 AI credits

**Process:** Customer clicks "Refund my first payment" → confirms → Stripe API refund → workspace cancelled immediately (no period end wait).

**Requires support ticket:**
- Beyond 14 days
- Yearly subscription mid-year refund (pro-rated)
- Service issue (we charge anyway then credit if appropriate)

Refunds appear in 5-10 business days on the customer's card.

### Stripe API Calls

```javascript
// Self-serve refund (within 14 days, first charge)
const refund = await stripe.refunds.create({
  charge: chargeId,
  reason: 'requested_by_customer',
});

// Cancel subscription
await stripe.subscriptions.update(subscriptionId, {
  cancel_at_period_end: true,
  metadata: { cancellation_reason: reason, cancelled_by: userId }
});

// Immediate cancellation (refund + cancel)
await stripe.subscriptions.cancel(subscriptionId, { prorate: false });
```

---

## Tax

### Stripe Tax (recommended — automated)

Enable Stripe Tax for £10/successful tax calculation. Stripe automatically:
- Determines tax jurisdiction from customer's address / IP / payment method country
- Calculates VAT (EU), GST (UK, Australia, NZ, India, Singapore), sales tax (US states)
- Adds tax line on invoice
- Files returns in supported jurisdictions (Phase 4 add-on)

### What Stripe Tax Handles

| Jurisdiction | Status |
|---|---|
| EU VAT (B2C and B2B reverse charge) | ✅ |
| UK VAT (20%) | ✅ |
| US sales tax (state-by-state) | ✅ |
| Canada GST/HST/PST | ✅ |
| Australia GST (10%) | ✅ |
| Singapore GST | ✅ |
| India GST | ✅ |

### VAT MOSS / IOSS

For EU B2C: charge VAT at customer's country rate. Stripe Tax handles this.
For EU B2B: customer provides VAT number → "reverse charge" applies, no VAT charged.

### VAT Number Capture

During signup:
```
Are you purchasing for a business?
  [No] — personal/consumer
  [Yes] — Company name [____]
          VAT number [____] (optional but recommended)
```

Stripe validates EU VAT numbers via VIES.

### Tax-Inclusive Pricing

Display prices on the pricing page differently per country:
- EU/UK visitors: see `£29/mo + VAT` or `£34.80/mo inc. VAT`
- US visitors: see `$35/mo + tax`
- API responses always return ex-tax amounts; UI handles display

### Invoice Requirements

Stripe-generated invoices include all legal requirements:
- Our company name + address + VAT number
- Customer company name + address + VAT number
- Invoice number (sequential, per country)
- Line items with descriptions
- Tax breakdown
- Total in customer's currency
- Date issued + due date

---

## Affiliate Payouts (Stripe Connect)

The platform has its own affiliate program (`affiliate-hub` service). Stripe Connect Express handles payouts to affiliates.

### Affiliate Onboarding

```
1. Affiliate signs up at /affiliates → fills basic info
2. Affiliate clicks "Setup payouts" → Stripe Connect Express OAuth
3. Stripe collects: name, address, DOB, bank account, tax ID
4. KYC verification via Stripe (1-3 days typically)
5. Once verified: affiliate can receive transfers
```

### Commission Calculation

When a referral converts:
```
1. Track click via short link
2. Cookie attribution (30/60/90 days configurable)
3. Conversion fires → check cookie → identify affiliate
4. Commission % applied to MRR (or one-time fee)
5. Record in affiliate_commissions (status='pending')
6. After 30-day refund window: status='approved'
```

### Payout Schedule

- Monthly on the 15th
- Minimum threshold £50 (below this, balance rolls to next month)
- Stripe Transfer API:
  ```javascript
  await stripe.transfers.create({
    amount: amountInPence,
    currency: 'gbp',
    destination: affiliate.stripe_connect_account_id,
    description: `Affiliate commission for ${period}`,
    metadata: { affiliate_id, period }
  });
  ```

### 1099-K / Tax Forms

- Stripe Connect issues 1099-K to US affiliates earning > $600/year
- For non-US: affiliate is responsible for their own tax reporting; we provide annual earnings statements

### Fraud Detection

Before approving commissions:
- Check `affiliate_links.clicks` vs `conversions` ratio (>20% conversion = suspicious)
- Same IP across multiple "different" conversions
- Conversions from disposable email domains
- Velocity: >10 conversions in 1 hour for the same affiliate

Flagged commissions → `status='under_review'` → manual review by support.

---

## Invoices, Receipts & Records

### Customer Self-Serve

Settings → Billing → "Invoices":
- Download any past invoice as PDF
- Resend invoice via email
- Change billing address (applies to future invoices)
- Update VAT number

### Stripe Customer Portal

Embedded link in Settings → Billing → "Manage Billing":
- Update payment method
- View billing history
- Download invoices
- Cancel subscription (alternative to in-app flow)
- Update billing address

```javascript
const session = await stripe.billingPortal.sessions.create({
  customer: workspace.stripe_customer_id,
  return_url: `${BASE_URL}/settings/billing`,
});
res.json({ url: session.url });
```

### Internal Records

- All invoices stored in Stripe (we don't duplicate)
- `core_subscriptions` table: id, workspace_id, stripe_subscription_id, status, period_start, period_end
- `core_invoice_log` table: stripe_invoice_id, workspace_id, amount_total, amount_tax, currency, status, paid_at, hosted_url
- Audit log captures every billing-related action

### Tax Records

- 7-year retention for tax records (legal requirement in most jurisdictions)
- Even after workspace deletion, `core_invoice_log` retains anonymised records for tax filing
- Annual: aggregate report exported for accountants

---

## SLA & Service Credits

### Uptime SLA

| Plan | Monthly Uptime SLA | Credit per 0.1% below SLA |
|---|---|---|
| Free | None (best effort) | N/A |
| Starter | 99.5% | N/A |
| Pro | 99.9% | 5% account credit |
| Agency | 99.9% | 10% account credit |
| Enterprise | 99.95% | Custom terms |

### How Credits Work

- Auto-calculated based on `status.yourplatform.com` incident history
- Applied to next invoice automatically
- Max 100% credit per month (full refund equivalent)
- Issued as Stripe credit balance, not cash refund

### Maintenance Windows

- Scheduled maintenance announced 7 days in advance via status page + email
- Window: Sunday 2-4am GMT (lowest customer activity)
- Maintenance time does **not** count against uptime SLA

### Support SLAs

| Plan | Email | Chat | Phone |
|---|---|---|---|
| Free | 72h | None | None |
| Starter | 48h | Business hours | None |
| Pro | 24h | Business hours | None |
| Agency | 8h | 24/5 | Add-on |
| Enterprise | 4h | 24/7 | 24/7 |

---

## Edge Cases

### Customer Dies / Business Closes
- Family member or executor contacts support
- After identity verification → admin marks workspace `pending_deletion` immediately
- Data export sent to designated contact
- Outstanding balance written off (or charged to estate, per local law)

### Stolen Card / Chargeback
- Stripe webhook `charge.dispute.created`
- Workspace → `suspended` immediately
- Investigation: legitimate chargeback or stolen card?
- If legitimate: provide evidence to Stripe (account login records, usage logs)
- If stolen: re-issue invoice via different payment method

### Currency Mismatch
- Customer in USD wants to pay in EUR
- Stripe handles currency conversion at sign-up
- Subscription is locked to currency at creation
- To switch currencies: cancel + re-subscribe (no automatic migration)

### Bank Account / SEPA / Invoice Payment
- Enterprise customers can pay by bank transfer (SEPA, ACH, wire)
- Stripe `Invoice` payment method: `invoice` instead of `card`
- 7-day payment terms
- Auto-suspend if invoice unpaid 14 days past due

### Plan Sunset
- We deprecate the "Plus" plan (hypothetical)
- Existing "Plus" customers grandfathered indefinitely OR migrated to closest plan
- 90-day advance notice + opt-in to migrate
- New signups don't see deprecated plans

### Free Plan Abuse
- Detection: user creates 50 free accounts for free credits
- Signals: same IP, same payment method (declined), similar email patterns, repeated free-credit consumption
- Action: suspend related accounts, deny new signups from same fingerprint
- Friction: require phone verification for free plan if abuse detected

### Refund Disputes
- Customer demands refund outside policy → escalate to senior support
- Always document the conversation in `core_support_tickets`
- Consider goodwill refund if customer has been on platform > 6 months and complaint is reasonable
- Hard-line policy only for chargeback fraud

### Family / Friend Discount
- Manual coupon code via Stripe → applied at signup
- 30-day coupons for trial extension via Stripe `Coupon` API
- Audit-logged with `granted_by` user_id
