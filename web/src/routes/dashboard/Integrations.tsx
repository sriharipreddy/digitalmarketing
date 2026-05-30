import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  TextField,
  Chip,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Alert,
  Tabs,
  Tab,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import {
  integrationApi,
  type ApiKey,
  type Webhook,
  type WebhookDelivery,
  type WebhookStatus,
} from '@/lib/integration-api';

const ALL_EVENT_KINDS = [
  '*',
  'campaign.completed',
  'campaign.failed',
  'commission.recorded',
  'commission.paid',
  'email.bounced',
  'email.unsubscribed',
  'social.post_published',
  'autopilot.recommendation',
];

const DELIVERY_STATUS_COLORS: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'default',
  in_flight: 'info',
  succeeded: 'success',
  failed: 'warning',
  dead_letter: 'error',
};

export default function Integrations() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const { enqueueSnackbar } = useSnackbar();

  const [tab, setTab] = useState<'keys' | 'webhooks' | 'deliveries'>('keys');
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);

  // Create API key dialog
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  // Create webhook dialog
  const [whOpen, setWhOpen] = useState(false);
  const [whForm, setWhForm] = useState({ name: '', target_url: '', event_kinds: ['*'] as string[] });
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState<string | null>(null);

  const refresh = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const [k, w, d] = await Promise.all([
        integrationApi.listKeys(active.id),
        integrationApi.listWebhooks(active.id),
        integrationApi.listDeliveries(active.id, { limit: 100 }),
      ]);
      setKeys(k.data.data.keys);
      setWebhooks(w.data.data.webhooks);
      setDeliveries(d.data.data.deliveries);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const createKey = async () => {
    if (!active) return;
    try {
      const r = await integrationApi.createKey(active.id, { name: keyName });
      setCreatedSecret(r.data.data.key.secret);
      setKeyName('');
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const revokeKey = async (k: ApiKey) => {
    if (!active) return;
    if (!confirm(`Revoke "${k.name}"? Any apps using this key will stop working.`)) return;
    try {
      await integrationApi.revokeKey(active.id, k.id);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const createWebhook = async () => {
    if (!active) return;
    try {
      const r = await integrationApi.createWebhook(active.id, whForm);
      setCreatedWebhookSecret(r.data.data.signing_secret);
      setWhForm({ name: '', target_url: '', event_kinds: ['*'] });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const updateWebhookStatus = async (w: Webhook, status: WebhookStatus) => {
    if (!active) return;
    try {
      await integrationApi.updateWebhook(active.id, w.id, { status });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const removeWebhook = async (w: Webhook) => {
    if (!active) return;
    if (!confirm(`Delete webhook "${w.name}"?`)) return;
    try {
      await integrationApi.removeWebhook(active.id, w.id);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    enqueueSnackbar('Copied', { variant: 'info' });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Integrations</Typography>
        <Stack direction="row" spacing={1}>
          <IconButton size="small" onClick={refresh}>
            <RefreshIcon />
          </IconButton>
          <Button
            size="small"
            variant="outlined"
            onClick={() => window.open('/api/v1/integration/v2/openapi.json', '_blank')}
          >
            OpenAPI spec
          </Button>
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Customer-facing public v2 API. Create an API key + subscribe webhooks to start receiving events at
        your endpoint.
      </Alert>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab value="keys" label={`API keys (${keys.length})`} />
          <Tab value="webhooks" label={`Webhooks (${webhooks.length})`} />
          <Tab value="deliveries" label={`Deliveries (${deliveries.length})`} />
        </Tabs>
      </Paper>

      {tab === 'keys' && (
        <>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
            <Button variant="contained" onClick={() => setKeyOpen(true)}>
              New API key
            </Button>
          </Stack>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Prefix</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last used</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id} hover>
                    <TableCell>{k.name}</TableCell>
                    <TableCell><code>{k.prefix}_…</code></TableCell>
                    <TableCell>
                      <Chip
                        label={k.status}
                        size="small"
                        color={k.status === 'active' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : '—'}</TableCell>
                    <TableCell>{new Date(k.created_at).toLocaleString()}</TableCell>
                    <TableCell align="right">
                      {k.status === 'active' && (
                        <Button size="small" color="error" onClick={() => revokeKey(k)}>
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {keys.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        No API keys yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {tab === 'webhooks' && (
        <>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
            <Button variant="contained" onClick={() => setWhOpen(true)}>
              New webhook
            </Button>
          </Stack>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Target</TableCell>
                  <TableCell>Events</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Failures</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {webhooks.map((w) => (
                  <TableRow key={w.id} hover>
                    <TableCell>{w.name}</TableCell>
                    <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <code style={{ fontSize: 12 }}>{w.target_url}</code>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        {(w.event_kinds ?? []).map((k) => (
                          <Chip key={k} label={k} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={w.status}
                        onChange={(e) => updateWebhookStatus(w, e.target.value as WebhookStatus)}
                      >
                        <MenuItem value="active">active</MenuItem>
                        <MenuItem value="paused">paused</MenuItem>
                        <MenuItem value="disabled">disabled</MenuItem>
                      </Select>
                    </TableCell>
                    <TableCell align="right">{w.consecutive_failures}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => removeWebhook(w)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {webhooks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        No webhooks subscribed.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {tab === 'deliveries' && (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Webhook</TableCell>
                <TableCell>Event</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Attempts</TableCell>
                <TableCell>Next</TableCell>
                <TableCell>Error</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {deliveries.map((d) => (
                <TableRow key={d.id} hover>
                  <TableCell>{new Date(d.created_at).toLocaleString()}</TableCell>
                  <TableCell>{d.webhook?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Chip label={d.event_kind} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={d.status}
                      size="small"
                      color={DELIVERY_STATUS_COLORS[d.status] ?? 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">{d.attempts}</TableCell>
                  <TableCell>
                    {d.next_attempt_at ? new Date(d.next_attempt_at).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.error ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
              {deliveries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No deliveries yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={keyOpen} onClose={() => { setKeyOpen(false); setCreatedSecret(null); }} fullWidth maxWidth="sm">
        <DialogTitle>{createdSecret ? 'API key created' : 'New API key'}</DialogTitle>
        <DialogContent>
          {createdSecret ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="warning">
                Save this token now — we won't show it again. Treat it like a password.
              </Alert>
              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {createdSecret}
              </Box>
              <Button startIcon={<ContentCopyIcon />} onClick={() => copy(createdSecret)}>
                Copy
              </Button>
            </Stack>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Name" value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="Server-side worker, Zapier app, etc." fullWidth autoFocus />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setKeyOpen(false); setCreatedSecret(null); }}>
            {createdSecret ? 'Done' : 'Cancel'}
          </Button>
          {!createdSecret && (
            <Button variant="contained" onClick={createKey} disabled={!keyName}>
              Create
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={whOpen} onClose={() => { setWhOpen(false); setCreatedWebhookSecret(null); }} fullWidth maxWidth="sm">
        <DialogTitle>{createdWebhookSecret ? 'Webhook created' : 'New webhook'}</DialogTitle>
        <DialogContent>
          {createdWebhookSecret ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="warning">
                Signing secret — save this now. Use it to verify the HMAC signature on every webhook delivery.
              </Alert>
              <Box component="pre" sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, fontFamily: 'monospace', fontSize: 13, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {createdWebhookSecret}
              </Box>
              <Button startIcon={<ContentCopyIcon />} onClick={() => copy(createdWebhookSecret)}>Copy</Button>
            </Stack>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Name" value={whForm.name} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} fullWidth />
              <TextField label="Target URL" value={whForm.target_url} onChange={(e) => setWhForm({ ...whForm, target_url: e.target.value })} placeholder="https://yourapp.com/webhooks/marketing" fullWidth />
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Subscribe to events
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                  {ALL_EVENT_KINDS.map((k) => (
                    <Chip
                      key={k}
                      label={k}
                      size="small"
                      color={whForm.event_kinds.includes(k) ? 'primary' : 'default'}
                      onClick={() => {
                        if (k === '*') {
                          setWhForm({ ...whForm, event_kinds: whForm.event_kinds.includes('*') ? [] : ['*'] });
                        } else {
                          const has = whForm.event_kinds.includes(k);
                          const next = has
                            ? whForm.event_kinds.filter((x) => x !== k)
                            : [...whForm.event_kinds.filter((x) => x !== '*'), k];
                          setWhForm({ ...whForm, event_kinds: next });
                        }
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setWhOpen(false); setCreatedWebhookSecret(null); }}>
            {createdWebhookSecret ? 'Done' : 'Cancel'}
          </Button>
          {!createdWebhookSecret && (
            <Button
              variant="contained"
              onClick={createWebhook}
              disabled={!whForm.name || !whForm.target_url || whForm.event_kinds.length === 0}
            >
              Create
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
