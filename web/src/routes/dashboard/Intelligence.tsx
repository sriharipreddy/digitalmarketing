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
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import SearchIcon from '@mui/icons-material/Search';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import {
  intelligenceApi,
  type Competitor,
  type CompetitorAd,
  type Recommendation,
  type AdPlatform,
} from '@/lib/intelligence-api';

const PLATFORMS: AdPlatform[] = ['meta', 'google', 'linkedin', 'tiktok'];

export default function Intelligence() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const { enqueueSnackbar } = useSnackbar();

  const [tab, setTab] = useState<'competitors' | 'ads' | 'autopilot'>('competitors');
  const [loading, setLoading] = useState(true);

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [ads, setAds] = useState<CompetitorAd[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>([]);

  const [newCompetitor, setNewCompetitor] = useState({ name: '', domain: '' });
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [detailCompetitor, setDetailCompetitor] = useState<Competitor | null>(null);

  const refresh = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const [c, a, r] = await Promise.all([
        intelligenceApi.listCompetitors(active.id),
        intelligenceApi.listAds(active.id),
        intelligenceApi.listRecommendations(active.id),
      ]);
      setCompetitors(c.data.data.competitors);
      setAds(a.data.data.ads);
      setRecs(r.data.data.recommendations);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const addCompetitor = async () => {
    if (!active) return;
    setAdding(true);
    try {
      await intelligenceApi.createCompetitor(active.id, newCompetitor);
      enqueueSnackbar('Competitor added', { variant: 'success' });
      setNewCompetitor({ name: '', domain: '' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const analyze = async (c: Competitor) => {
    if (!active) return;
    try {
      await intelligenceApi.analyzeCompetitor(active.id, c.id);
      enqueueSnackbar(`Analyzed ${c.name}`, { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const spy = async (c: Competitor, platform: AdPlatform) => {
    if (!active) return;
    try {
      const r = await intelligenceApi.spyAds(active.id, c.id, { platform, limit: 8 });
      enqueueSnackbar(`Pulled ${r.data.data.saved} ${platform} ads from ${c.name}`, { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const remove = async (c: Competitor) => {
    if (!active) return;
    if (!confirm(`Remove ${c.name}?`)) return;
    try {
      await intelligenceApi.removeCompetitor(active.id, c.id);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const scan = async () => {
    if (!active) return;
    setScanning(true);
    try {
      const r = await intelligenceApi.scan(active.id);
      enqueueSnackbar(`Scanned: ${r.data.data.created} new recommendations`, { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Scan failed', { variant: 'error' });
    } finally {
      setScanning(false);
    }
  };

  const actOn = async (rec: Recommendation, outcome: 'accepted' | 'dismissed' | 'completed') => {
    if (!active) return;
    try {
      await intelligenceApi.actOn(active.id, rec.id, outcome);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
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
        Intelligence
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Competitor analysis + ad spy run against <strong>stub data</strong>. Drop SimilarWeb / SEMrush
        keys + wire Meta Ad Library scraping for real intel.
      </Alert>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab value="competitors" label={`Competitors (${competitors.length})`} />
          <Tab value="ads" label={`Ad spy (${ads.length})`} />
          <Tab
            value="autopilot"
            label={`Autopilot (${recs.filter((r) => r.status === 'new').length} new)`}
          />
        </Tabs>
      </Paper>

      {tab === 'competitors' && (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Add competitor
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                placeholder="Company name"
                value={newCompetitor.name}
                onChange={(e) => setNewCompetitor({ ...newCompetitor, name: e.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                placeholder="example.com"
                value={newCompetitor.domain}
                onChange={(e) => setNewCompetitor({ ...newCompetitor, domain: e.target.value })}
                fullWidth
              />
              <Button variant="contained" onClick={addCompetitor} disabled={adding || !newCompetitor.name || !newCompetitor.domain}>
                Add
              </Button>
            </Stack>
          </Paper>

          {competitors.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No competitors yet — add one above.
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {competitors.map((c) => (
                <Grid item xs={12} md={6} key={c.id}>
                  <Card>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                        <Box>
                          <Typography variant="h6">{c.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {c.domain}
                          </Typography>
                        </Box>
                        <IconButton size="small" onClick={() => remove(c)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                      {c.description ? (
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          {c.description}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          Not analyzed yet.
                        </Typography>
                      )}
                      {c.industry && (
                        <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap' }}>
                          <Chip label={c.industry} size="small" />
                          {c.est_employee_count && <Chip label={`${c.est_employee_count} emp.`} size="small" variant="outlined" />}
                          {c.est_monthly_traffic && (
                            <Chip
                              label={`${(c.est_monthly_traffic / 1000).toFixed(0)}k/mo traffic`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      )}
                      <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
                        <Button size="small" startIcon={<AnalyticsIcon />} onClick={() => analyze(c)} variant="outlined">
                          {c.last_analyzed_at ? 'Re-analyze' : 'Analyze'}
                        </Button>
                        {PLATFORMS.map((p) => (
                          <Button
                            key={p}
                            size="small"
                            startIcon={<SearchIcon />}
                            onClick={() => spy(c, p)}
                            variant="outlined"
                          >
                            Spy {p}
                          </Button>
                        ))}
                        <Button size="small" onClick={() => setDetailCompetitor(c)}>
                          Details
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {tab === 'ads' && (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Creative</TableCell>
                <TableCell>Competitor</TableCell>
                <TableCell>Platform</TableCell>
                <TableCell>Headline</TableCell>
                <TableCell align="right">Spend</TableCell>
                <TableCell align="right">Impr.</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {ads.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell>
                    {a.creative_url && (
                      <Box component="img" src={a.creative_url} sx={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 0.5 }} />
                    )}
                  </TableCell>
                  <TableCell>{a.competitor?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Chip label={a.platform} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.headline ?? '—'}
                  </TableCell>
                  <TableCell align="right">{a.est_spend_usd != null ? `$${a.est_spend_usd.toLocaleString()}` : '—'}</TableCell>
                  <TableCell align="right">{a.est_impressions != null ? a.est_impressions.toLocaleString() : '—'}</TableCell>
                  <TableCell align="right">
                    {a.landing_url && (
                      <IconButton size="small" onClick={() => window.open(a.landing_url!, '_blank')}>
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {ads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No ads pulled yet — spy a competitor's platform from the Competitors tab.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {tab === 'autopilot' && (
        <>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Recommendations derived from your workspace state (events, competitors, campaigns).
            </Typography>
            <Button variant="contained" onClick={scan} disabled={scanning}>
              {scanning ? <CircularProgress size={18} color="inherit" /> : 'Run scan'}
            </Button>
          </Stack>

          {recs.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No recommendations yet — click "Run scan" to surface insights.
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={2}>
              {recs.map((r) => (
                <Card key={r.id}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip label={r.category.replace(/_/g, ' ')} size="small" />
                        <Chip
                          label={`confidence: ${r.confidence}`}
                          size="small"
                          color={r.confidence === 'high' ? 'success' : r.confidence === 'medium' ? 'warning' : 'default'}
                          variant="outlined"
                        />
                        <Chip
                          label={r.status}
                          size="small"
                          color={r.status === 'new' ? 'info' : r.status === 'dismissed' ? 'error' : 'success'}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(r.created_at).toLocaleString()}
                      </Typography>
                    </Stack>
                    <Typography variant="h6" sx={{ mb: 0.5 }}>
                      {r.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {r.body}
                    </Typography>
                    {r.impact_estimate && (
                      <Typography variant="caption" color="primary.main">
                        Impact: {r.impact_estimate}
                      </Typography>
                    )}
                    {r.status === 'new' && (
                      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                        <Button size="small" variant="contained" onClick={() => actOn(r, 'accepted')}>
                          Accept
                        </Button>
                        <Button size="small" variant="outlined" onClick={() => actOn(r, 'completed')}>
                          Mark done
                        </Button>
                        <Button size="small" color="error" onClick={() => actOn(r, 'dismissed')}>
                          Dismiss
                        </Button>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </>
      )}

      <Dialog open={!!detailCompetitor} onClose={() => setDetailCompetitor(null)} fullWidth maxWidth="md">
        <DialogTitle>
          {detailCompetitor?.name} <Typography component="span" variant="caption" color="text.secondary">— {detailCompetitor?.domain}</Typography>
        </DialogTitle>
        <DialogContent>
          {detailCompetitor && (
            <Stack spacing={2}>
              {detailCompetitor.description && (
                <Typography variant="body2">{detailCompetitor.description}</Typography>
              )}
              <Grid container spacing={2}>
                {detailCompetitor.strengths && detailCompetitor.strengths.length > 0 && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: 'success.main' }}>
                      Strengths
                    </Typography>
                    {detailCompetitor.strengths.map((s) => (
                      <Typography key={s} variant="body2" sx={{ mb: 0.5 }}>
                        • {s}
                      </Typography>
                    ))}
                  </Grid>
                )}
                {detailCompetitor.weaknesses && detailCompetitor.weaknesses.length > 0 && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: 'warning.main' }}>
                      Weaknesses
                    </Typography>
                    {detailCompetitor.weaknesses.map((w) => (
                      <Typography key={w} variant="body2" sx={{ mb: 0.5 }}>
                        • {w}
                      </Typography>
                    ))}
                  </Grid>
                )}
              </Grid>
              {detailCompetitor.social_handles && (
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {Object.entries(detailCompetitor.social_handles).map(([k, v]) => (
                    <Chip key={k} label={`${k}: ${v}`} size="small" variant="outlined" />
                  ))}
                </Stack>
              )}
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
