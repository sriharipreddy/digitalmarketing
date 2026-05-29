import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import { useSearchParams } from 'react-router-dom';
import type { RootState } from '@/store';
import { api } from '@/lib/api';

interface SubscriptionData {
  id: string;
  status: string;
  plan_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

const PLANS: Array<{
  slug: 'starter' | 'pro' | 'agency';
  name: string;
  price: string;
  description: string;
  features: string[];
}> = [
  {
    slug: 'starter',
    name: 'Starter',
    price: '$29 / mo',
    description: 'For solo marketers',
    features: ['Up to 1 workspace', '10K contacts', 'Basic AI'],
  },
  {
    slug: 'pro',
    name: 'Pro',
    price: '$99 / mo',
    description: 'For growing teams',
    features: ['5 workspaces', '100K contacts', 'Unlimited AI', 'Multi-channel campaigns'],
  },
  {
    slug: 'agency',
    name: 'Agency',
    price: '$299 / mo',
    description: 'For marketing agencies',
    features: ['Unlimited workspaces', 'Client portal', 'White-label', 'Priority support'],
  },
];

export default function Billing() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const { enqueueSnackbar } = useSnackbar();
  const [params] = useSearchParams();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [driver, setDriver] = useState<'stripe' | 'stub' | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);

  const refresh = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const res = await api.get(`/core/workspaces/${active.id}/billing`);
      setSubscription(res.data.data.subscription);
      setDriver(res.data.data.driver);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const startCheckout = async (slug: 'starter' | 'pro' | 'agency') => {
    if (!active) return;
    setCheckoutPlan(slug);
    try {
      const res = await api.post(`/core/workspaces/${active.id}/billing/checkout`, { plan_slug: slug });
      const url = res.data.data.url as string;
      // In stub mode, url points to /dashboard/workspace/billing/return — go there;
      // in real mode, url is a Stripe-hosted checkout page.
      window.location.href = url;
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Checkout failed', { variant: 'error' });
      setCheckoutPlan(null);
    }
  };

  const justReturned = params.get('session_id');

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Billing & subscription
      </Typography>

      {driver === 'stub' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Stripe is in <strong>stub mode</strong> — drop real test keys into <code>.env</code> to enable
          live checkout.
        </Alert>
      )}

      {justReturned && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Checkout session <code>{justReturned.slice(0, 28)}…</code> returned. In stub mode no subscription
          is created — wire real Stripe + a webhook tunnel to complete the loop.
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3, maxWidth: 720 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Current subscription
        </Typography>
        {subscription ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={subscription.status}
              color={subscription.status === 'active' || subscription.status === 'trialing' ? 'success' : 'warning'}
              size="small"
            />
            <Typography variant="body2">
              Stripe sub: <code>{subscription.stripe_subscription_id ?? '—'}</code>
            </Typography>
            {subscription.current_period_end && (
              <Typography variant="body2" color="text.secondary">
                renews {new Date(subscription.current_period_end).toLocaleDateString()}
              </Typography>
            )}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No subscription yet. Pick a plan below to start.
          </Typography>
        )}
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 2 }}>
        {PLANS.map((p) => (
          <Card key={p.slug} sx={{ display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1 }}>
              <Typography variant="h6">{p.name}</Typography>
              <Typography variant="h4" sx={{ my: 1 }}>
                {p.price}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {p.description}
              </Typography>
              <Stack component="ul" spacing={0.5} sx={{ pl: 2, m: 0 }}>
                {p.features.map((f) => (
                  <li key={f}>
                    <Typography variant="body2">{f}</Typography>
                  </li>
                ))}
              </Stack>
            </CardContent>
            <Box sx={{ p: 2, pt: 0 }}>
              <Button
                fullWidth
                variant={p.slug === 'pro' ? 'contained' : 'outlined'}
                disabled={checkoutPlan !== null}
                onClick={() => startCheckout(p.slug)}
              >
                {checkoutPlan === p.slug ? 'Starting…' : 'Choose plan'}
              </Button>
            </Box>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
