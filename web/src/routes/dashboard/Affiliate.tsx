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
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import {
  affiliateApi,
  type AffiliateProgram,
  type Affiliate,
  type TrackingLink,
  type Commission,
  type CommissionTotals,
  type AffiliateStatus,
} from '@/lib/affiliate-api';

const AFFILIATE_STATUSES: AffiliateStatus[] = ['pending', 'approved', 'rejected', 'suspended'];

export default function AffiliatePage() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const { enqueueSnackbar } = useSnackbar();

  const [tab, setTab] = useState<'programs' | 'affiliates' | 'links' | 'commissions'>('programs');
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<AffiliateProgram[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [totals, setTotals] = useState<CommissionTotals | null>(null);

  // New program dialog
  const [progOpen, setProgOpen] = useState(false);
  const [progForm, setProgForm] = useState({ name: '', description: '', commission_kind: 'percent' as 'percent' | 'fixed_usd', commission_value: '10', cookie_days: '30' });

  // New link dialog
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ affiliate_id: '', destination_url: '', label: '' });

  // Record commission dialog
  const [commOpen, setCommOpen] = useState(false);
  const [commForm, setCommForm] = useState({ affiliate_id: '', order_external_id: '', order_amount_usd: '0' });

  const refresh = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const [p, a, l, c, t] = await Promise.all([
        affiliateApi.listPrograms(active.id),
        affiliateApi.listAffiliates(active.id),
        affiliateApi.listLinks(active.id),
        affiliateApi.listCommissions(active.id),
        affiliateApi.commissionSummary(active.id),
      ]);
      setPrograms(p.data.data.programs);
      setAffiliates(a.data.data.affiliates);
      setLinks(l.data.data.links);
      setCommissions(c.data.data.commissions);
      setTotals(t.data.data.totals);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const createProgram = async () => {
    if (!active) return;
    try {
      await affiliateApi.createProgram(active.id, {
        name: progForm.name,
        description: progForm.description || undefined,
        commission_kind: progForm.commission_kind,
        commission_value: Number(progForm.commission_value),
        cookie_days: Number(progForm.cookie_days),
      });
      setProgOpen(false);
      setProgForm({ name: '', description: '', commission_kind: 'percent', commission_value: '10', cookie_days: '30' });
      enqueueSnackbar('Program created', { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const updateProgramStatus = async (p: AffiliateProgram, status: AffiliateProgram['status']) => {
    if (!active) return;
    try {
      await affiliateApi.updateProgram(active.id, p.id, { status });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const removeProgram = async (p: AffiliateProgram) => {
    if (!active) return;
    if (!confirm(`Delete "${p.name}"?`)) return;
    try {
      await affiliateApi.removeProgram(active.id, p.id);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const updateAffiliateStatus = async (a: Affiliate, status: AffiliateStatus) => {
    if (!active) return;
    try {
      await affiliateApi.updateAffiliateStatus(active.id, a.id, status);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const createLink = async () => {
    if (!active) return;
    try {
      await affiliateApi.createLink(active.id, {
        affiliate_id: linkForm.affiliate_id,
        destination_url: linkForm.destination_url,
        label: linkForm.label || undefined,
      });
      setLinkOpen(false);
      setLinkForm({ affiliate_id: '', destination_url: '', label: '' });
      enqueueSnackbar('Tracking link created', { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const removeLink = async (l: TrackingLink) => {
    if (!active) return;
    if (!confirm('Delete this tracking link?')) return;
    try {
      await affiliateApi.removeLink(active.id, l.id);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const recordCommission = async () => {
    if (!active) return;
    try {
      await affiliateApi.recordCommission(active.id, {
        affiliate_id: commForm.affiliate_id,
        order_external_id: commForm.order_external_id,
        order_amount_usd: Number(commForm.order_amount_usd),
      });
      setCommOpen(false);
      setCommForm({ affiliate_id: '', order_external_id: '', order_amount_usd: '0' });
      enqueueSnackbar('Commission recorded', { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const transition = async (c: Commission, status: 'approved' | 'paid' | 'reversed' | 'rejected') => {
    if (!active) return;
    try {
      await affiliateApi.transitionCommission(active.id, c.id, status);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const copyLink = (short_code: string) => {
    void navigator.clipboard.writeText(affiliateApi.publicLinkUrl(short_code));
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
      <Typography variant="h5" sx={{ mb: 2 }}>
        Affiliate
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Stripe Connect payouts are in <strong>stub mode</strong>. Approve commissions here; flip{' '}
        <code>STRIPE_DRIVER=stripe</code> + drop a Connect-capable secret key into{' '}
        <code>api/affiliate-hub/.env</code> for live payouts.
      </Alert>

      {totals && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {(['pending', 'approved', 'paid', 'reversed'] as const).map((k) => (
            <Grid item xs={6} sm={3} key={k}>
              <Card>
                <CardContent>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                    {k}
                  </Typography>
                  <Typography variant="h6">${totals[k].usd.toFixed(2)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {totals[k].count} commission(s)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab value="programs" label={`Programs (${programs.length})`} />
          <Tab value="affiliates" label={`Affiliates (${affiliates.length})`} />
          <Tab value="links" label={`Links (${links.length})`} />
          <Tab value="commissions" label={`Commissions (${commissions.length})`} />
        </Tabs>
      </Paper>

      {tab === 'programs' && (
        <>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
            <Button variant="contained" onClick={() => setProgOpen(true)}>New program</Button>
          </Stack>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Commission</TableCell>
                  <TableCell>Attribution</TableCell>
                  <TableCell>Cookie</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {programs.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>
                      {p.commission_kind === 'percent'
                        ? `${p.commission_value}%`
                        : `$${p.commission_value}`}
                    </TableCell>
                    <TableCell>{p.attribution}</TableCell>
                    <TableCell>{p.cookie_days}d</TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={p.status}
                        onChange={(e) => updateProgramStatus(p, e.target.value as AffiliateProgram['status'])}
                      >
                        <MenuItem value="draft">draft</MenuItem>
                        <MenuItem value="active">active</MenuItem>
                        <MenuItem value="paused">paused</MenuItem>
                        <MenuItem value="archived">archived</MenuItem>
                      </Select>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => removeProgram(p)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {programs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        No programs yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {tab === 'affiliates' && (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Program</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Joined</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {affiliates.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.email}</TableCell>
                  <TableCell>{a.program?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={a.status}
                      onChange={(e) => updateAffiliateStatus(a, e.target.value as AffiliateStatus)}
                    >
                      {AFFILIATE_STATUSES.map((s) => (
                        <MenuItem key={s} value={s}>{s}</MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>{new Date(a.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {affiliates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No affiliates yet. Share the public apply URL: <code>/api/v1/affiliate/public/workspaces/{active?.id}/apply</code>
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {tab === 'links' && (
        <>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
            <Button variant="contained" onClick={() => setLinkOpen(true)} disabled={affiliates.length === 0}>
              New tracking link
            </Button>
          </Stack>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Short URL</TableCell>
                  <TableCell>Affiliate</TableCell>
                  <TableCell>Destination</TableCell>
                  <TableCell align="right">Clicks</TableCell>
                  <TableCell align="right">Conversions</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {links.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <code style={{ fontSize: 12 }}>{affiliateApi.publicLinkUrl(l.short_code)}</code>
                    </TableCell>
                    <TableCell>{l.affiliate?.email ?? '—'}</TableCell>
                    <TableCell sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.destination_url}
                    </TableCell>
                    <TableCell align="right">{l.click_count}</TableCell>
                    <TableCell align="right">{l.conversion_count}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => copyLink(l.short_code)}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => removeLink(l)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {links.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        No tracking links yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {tab === 'commissions' && (
        <>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
            <Button variant="contained" onClick={() => setCommOpen(true)} disabled={affiliates.filter((a) => a.status === 'approved').length === 0}>
              Record commission
            </Button>
          </Stack>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Order</TableCell>
                  <TableCell>Affiliate</TableCell>
                  <TableCell align="right">Order $</TableCell>
                  <TableCell align="right">Commission $</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {commissions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.order_external_id}</TableCell>
                    <TableCell>{c.affiliate?.email ?? '—'}</TableCell>
                    <TableCell align="right">${Number(c.order_amount_usd).toFixed(2)}</TableCell>
                    <TableCell align="right">${Number(c.commission_usd).toFixed(2)}</TableCell>
                    <TableCell>
                      <Chip
                        label={c.status}
                        size="small"
                        color={
                          c.status === 'paid' ? 'success' :
                          c.status === 'approved' ? 'info' :
                          c.status === 'pending' ? 'warning' :
                          c.status === 'reversed' || c.status === 'rejected' ? 'error' : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell align="right">
                      {c.status === 'pending' && (
                        <>
                          <Button size="small" onClick={() => transition(c, 'approved')}>Approve</Button>
                          <Button size="small" color="error" onClick={() => transition(c, 'rejected')}>Reject</Button>
                        </>
                      )}
                      {c.status === 'approved' && (
                        <>
                          <Button size="small" variant="contained" onClick={() => transition(c, 'paid')}>Pay</Button>
                          <Button size="small" color="error" onClick={() => transition(c, 'reversed')}>Reverse</Button>
                        </>
                      )}
                      {c.status === 'paid' && (
                        <Button size="small" color="error" onClick={() => transition(c, 'reversed')}>Reverse</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {commissions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        No commissions recorded.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      <Dialog open={progOpen} onClose={() => setProgOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New affiliate program</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={progForm.name} onChange={(e) => setProgForm({ ...progForm, name: e.target.value })} fullWidth />
            <TextField label="Description" value={progForm.description} onChange={(e) => setProgForm({ ...progForm, description: e.target.value })} fullWidth multiline minRows={2} />
            <Stack direction="row" spacing={1}>
              <Select
                value={progForm.commission_kind}
                onChange={(e) => setProgForm({ ...progForm, commission_kind: e.target.value as any })}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="percent">Percent</MenuItem>
                <MenuItem value="fixed_usd">Fixed USD</MenuItem>
              </Select>
              <TextField label="Value" type="number" value={progForm.commission_value} onChange={(e) => setProgForm({ ...progForm, commission_value: e.target.value })} />
              <TextField label="Cookie days" type="number" value={progForm.cookie_days} onChange={(e) => setProgForm({ ...progForm, cookie_days: e.target.value })} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProgOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createProgram} disabled={!progForm.name}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={linkOpen} onClose={() => setLinkOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New tracking link</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Select
              value={linkForm.affiliate_id}
              onChange={(e) => setLinkForm({ ...linkForm, affiliate_id: e.target.value as string })}
              displayEmpty
            >
              <MenuItem value="" disabled>Select an approved affiliate</MenuItem>
              {affiliates.filter((a) => a.status === 'approved').map((a) => (
                <MenuItem key={a.id} value={a.id}>{a.email}</MenuItem>
              ))}
            </Select>
            <TextField label="Destination URL" value={linkForm.destination_url} onChange={(e) => setLinkForm({ ...linkForm, destination_url: e.target.value })} placeholder="https://yourbrand.com/landing" fullWidth />
            <TextField label="Label (optional)" value={linkForm.label} onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createLink} disabled={!linkForm.affiliate_id || !linkForm.destination_url}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={commOpen} onClose={() => setCommOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Record commission</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Select
              value={commForm.affiliate_id}
              onChange={(e) => setCommForm({ ...commForm, affiliate_id: e.target.value as string })}
              displayEmpty
            >
              <MenuItem value="" disabled>Select affiliate</MenuItem>
              {affiliates.filter((a) => a.status === 'approved').map((a) => (
                <MenuItem key={a.id} value={a.id}>{a.email}</MenuItem>
              ))}
            </Select>
            <TextField label="Order ID (external)" value={commForm.order_external_id} onChange={(e) => setCommForm({ ...commForm, order_external_id: e.target.value })} placeholder="order_123 or stripe ch_..." fullWidth />
            <TextField label="Order amount USD" type="number" value={commForm.order_amount_usd} onChange={(e) => setCommForm({ ...commForm, order_amount_usd: e.target.value })} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={recordCommission} disabled={!commForm.affiliate_id || !commForm.order_external_id}>Record</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
