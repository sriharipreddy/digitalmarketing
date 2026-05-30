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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  IconButton,
  Alert,
  Divider,
  Grid,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import {
  analyticsApi,
  type OverviewMetrics,
  type UtmAttribution,
  type ConversionGoal,
  type FunnelResult,
} from '@/lib/analytics-api';

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ mt: 0.5 }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      )}
    </Paper>
  );
}

export default function Analytics() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const { enqueueSnackbar } = useSnackbar();

  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [utm, setUtm] = useState<UtmAttribution | null>(null);
  const [goals, setGoals] = useState<ConversionGoal[]>([]);

  const [funnelEvents, setFunnelEvents] = useState('pageview, signup_started, signup_completed');
  const [funnel, setFunnel] = useState<FunnelResult | null>(null);

  const [goalOpen, setGoalOpen] = useState(false);
  const [goalForm, setGoalForm] = useState({ name: '', event_name: '', value_usd: '0' });

  const refresh = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const [o, u, g] = await Promise.all([
        analyticsApi.overview(active.id, days),
        analyticsApi.utm(active.id, days),
        analyticsApi.listGoals(active.id),
      ]);
      setOverview(o.data.data);
      setUtm(u.data.data);
      setGoals(g.data.data.goals);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, days]);

  const runFunnel = async () => {
    if (!active) return;
    const events = funnelEvents
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (events.length === 0) return;
    try {
      const r = await analyticsApi.funnel(active.id, events, days);
      setFunnel(r.data.data);
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Funnel failed', { variant: 'error' });
    }
  };

  const createGoal = async () => {
    if (!active) return;
    try {
      await analyticsApi.createGoal(active.id, {
        name: goalForm.name,
        event_name: goalForm.event_name,
        value_usd: Number(goalForm.value_usd) || 0,
      });
      setGoalOpen(false);
      setGoalForm({ name: '', event_name: '', value_usd: '0' });
      enqueueSnackbar('Goal created', { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const removeGoal = async (g: ConversionGoal) => {
    if (!active) return;
    if (!confirm(`Delete goal "${g.name}"?`)) return;
    try {
      await analyticsApi.removeGoal(active.id, g.id);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const sendTestEvent = async () => {
    if (!active) return;
    try {
      const r = await analyticsApi.track({
        workspace_id: active.id,
        anonymous_id: `test_${Date.now()}`,
        event_name: 'test_event',
        page_url: window.location.href,
        utm_source: 'analytics_test',
        utm_medium: 'dashboard',
        utm_campaign: 'manual_test',
      });
      enqueueSnackbar(`Tracked: ${r.data.data.id.slice(0, 8)}…`, { variant: 'success' });
      setTimeout(() => void refresh(), 800);
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Track failed', { variant: 'error' });
    }
  };

  if (loading || !overview) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Analytics</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Select size="small" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <MenuItem value={1}>Last 24h</MenuItem>
            <MenuItem value={7}>Last 7 days</MenuItem>
            <MenuItem value={30}>Last 30 days</MenuItem>
            <MenuItem value={90}>Last 90 days</MenuItem>
          </Select>
          <Button variant="outlined" size="small" onClick={sendTestEvent}>
            Send test event
          </Button>
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Drop the public <code>/api/v1/analytics/track</code> endpoint into your site/SDK to start collecting
        events. Include <code>workspace_id</code>, <code>anonymous_id</code>, and <code>event_name</code>.
      </Alert>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard label="Events" value={overview.totals.events.toLocaleString()} sub={`last ${days}d`} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard label="Unique visitors" value={overview.totals.unique_visitors.toLocaleString()} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard label="Pageviews" value={overview.totals.pageviews.toLocaleString()} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard label="Sessions" value={overview.totals.sessions.toLocaleString()} />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Top events
            </Typography>
            {overview.top_events.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No events yet.
              </Typography>
            ) : (
              <Table size="small">
                <TableBody>
                  {overview.top_events.map((e) => (
                    <TableRow key={e.event_name}>
                      <TableCell>{e.event_name}</TableCell>
                      <TableCell align="right">{e.count.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Top pages
            </Typography>
            {overview.top_pages.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No pageviews yet.
              </Typography>
            ) : (
              <Table size="small">
                <TableBody>
                  {overview.top_pages.map((p) => (
                    <TableRow key={p.page_url}>
                      <TableCell sx={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.page_url}
                      </TableCell>
                      <TableCell align="right">{p.views.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ mb: 1 }}>
        UTM attribution
      </Typography>
      <Paper sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Campaign</TableCell>
              <TableCell align="right">Visitors</TableCell>
              <TableCell align="right">Events</TableCell>
              <TableCell align="right">Conversions</TableCell>
              <TableCell align="right">Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {utm?.by_campaign.map((c) => (
              <TableRow key={c.utm_campaign}>
                <TableCell>{c.utm_campaign}</TableCell>
                <TableCell align="right">{c.visitors.toLocaleString()}</TableCell>
                <TableCell align="right">{c.events.toLocaleString()}</TableCell>
                <TableCell align="right">{c.conversions.toLocaleString()}</TableCell>
                <TableCell align="right">${c.value_usd.toFixed(2)}</TableCell>
              </TableRow>
            ))}
            {(!utm || utm.by_campaign.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    No UTM-tagged events yet. Track an event with utm_campaign set, or click a UTM link.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Conversion goals
      </Typography>
      <Paper sx={{ mb: 3, p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Active goals are counted as conversions in the UTM attribution table above.
          </Typography>
          <Button size="small" variant="outlined" onClick={() => setGoalOpen(true)}>
            New goal
          </Button>
        </Stack>
        {goals.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No goals yet.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Event</TableCell>
                <TableCell align="right">Value</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {goals.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>{g.name}</TableCell>
                  <TableCell>
                    <Chip label={g.event_name} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell align="right">${Number(g.value_usd).toFixed(2)}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => removeGoal(g)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Funnel
      </Typography>
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField
            size="small"
            label="Event names (comma-separated, in order)"
            value={funnelEvents}
            onChange={(e) => setFunnelEvents(e.target.value)}
            fullWidth
          />
          <Button variant="contained" onClick={runFunnel}>
            Run
          </Button>
        </Stack>
        {funnel && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Step</TableCell>
                <TableCell>Event</TableCell>
                <TableCell align="right">Visitors</TableCell>
                <TableCell align="right">Drop-off</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {funnel.steps.map((s) => (
                <TableRow key={s.step}>
                  <TableCell>{s.step}</TableCell>
                  <TableCell>{s.event_name}</TableCell>
                  <TableCell align="right">{s.visitors.toLocaleString()}</TableCell>
                  <TableCell align="right">
                    {s.step === 1 ? '—' : (-s.drop_off).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Dialog open={goalOpen} onClose={() => setGoalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New conversion goal</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={goalForm.name} onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })} fullWidth />
            <TextField
              label="Event name"
              value={goalForm.event_name}
              onChange={(e) => setGoalForm({ ...goalForm, event_name: e.target.value })}
              placeholder="e.g. signup_completed"
              fullWidth
            />
            <TextField
              label="Value (USD)"
              type="number"
              value={goalForm.value_usd}
              onChange={(e) => setGoalForm({ ...goalForm, value_usd: e.target.value })}
              fullWidth
            />
            <Divider />
            <Typography variant="caption" color="text.secondary">
              When an event with this exact name fires, it counts as one conversion worth the value above.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGoalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createGoal} disabled={!goalForm.name || !goalForm.event_name}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
