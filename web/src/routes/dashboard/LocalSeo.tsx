import { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Stack, Button, Chip, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Select, Alert, Tabs, Tab, IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import {
  seoApi,
  type LocalListing,
  type LocalReview,
  type LocalCitation,
  type LocalProvider,
  type AppListing,
  type AppPlatform,
  type CitationStatus,
} from '@/lib/seo-api';

export default function LocalSeo() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const { enqueueSnackbar } = useSnackbar();

  const [tab, setTab] = useState<'listings' | 'aso'>('listings');
  const [loading, setLoading] = useState(true);

  const [listings, setListings] = useState<LocalListing[]>([]);
  const [selected, setSelected] = useState<LocalListing | null>(null);
  const [reviews, setReviews] = useState<LocalReview[]>([]);
  const [citations, setCitations] = useState<LocalCitation[]>([]);
  const [apps, setApps] = useState<AppListing[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ provider: 'gmb' as LocalProvider, provider_account_id: '', business_name: '' });

  const [appOpen, setAppOpen] = useState(false);
  const [appForm, setAppForm] = useState({ platform: 'ios' as AppPlatform, app_external_id: '' });

  const [replyOpen, setReplyOpen] = useState<LocalReview | null>(null);
  const [replyBody, setReplyBody] = useState('');

  const refresh = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const [l, a] = await Promise.all([
        seoApi.listListings(active.id),
        seoApi.listApps(active.id),
      ]);
      setListings(l.data.data.listings);
      setApps(a.data.data.apps);
    } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [active?.id]);

  const refreshListingDetails = async (listing: LocalListing) => {
    if (!active) return;
    setSelected(listing);
    const [r, c] = await Promise.all([
      seoApi.listReviews(active.id, listing.id),
      seoApi.listCitations(active.id, listing.id),
    ]);
    setReviews(r.data.data.reviews);
    setCitations(c.data.data.citations);
  };

  const createListing = async () => {
    if (!active) return;
    try {
      await seoApi.createListing(active.id, createForm);
      setCreateOpen(false);
      setCreateForm({ provider: 'gmb', provider_account_id: '', business_name: '' });
      void refresh();
      enqueueSnackbar('Listing created', { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const sync = async (l: LocalListing) => {
    if (!active) return;
    const r = await seoApi.syncReviews(active.id, l.id);
    enqueueSnackbar(`Synced — ${r.data.data.inserted} new reviews`, { variant: 'success' });
    void refresh();
    if (selected?.id === l.id) void refreshListingDetails(l);
  };

  const seedCitations = async (l: LocalListing) => {
    if (!active) return;
    await seoApi.seedCitations(active.id, l.id);
    enqueueSnackbar('Citation directories seeded', { variant: 'success' });
    if (selected?.id === l.id) void refreshListingDetails(l);
  };

  const submitReply = async () => {
    if (!active || !selected || !replyOpen) return;
    try {
      await seoApi.respondReview(active.id, selected.id, replyOpen.id, replyBody);
      setReplyOpen(null); setReplyBody('');
      void refreshListingDetails(selected);
      enqueueSnackbar('Reply posted', { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const updateCitation = async (c: LocalCitation, status: CitationStatus) => {
    if (!active || !selected) return;
    await seoApi.updateCitationStatus(active.id, c.id, status);
    void refreshListingDetails(selected);
  };

  const trackApp = async () => {
    if (!active) return;
    try {
      await seoApi.trackApp(active.id, appForm);
      setAppOpen(false); setAppForm({ platform: 'ios', app_external_id: '' });
      void refresh();
      enqueueSnackbar('App tracked', { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Local SEO &amp; ASO</Typography>
        <IconButton size="small" onClick={refresh}><RefreshIcon /></IconButton>
      </Stack>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab value="listings" label={`Local listings (${listings.length})`} />
          <Tab value="aso" label={`App listings (${apps.length})`} />
        </Tabs>
      </Paper>

      {tab === 'listings' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 2 }}>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1">Listings</Typography>
              <Button size="small" variant="contained" onClick={() => setCreateOpen(true)}>Add</Button>
            </Stack>
            {listings.length === 0 && (
              <Typography variant="body2" color="text.secondary">No listings yet.</Typography>
            )}
            {listings.map((l) => (
              <Paper
                key={l.id}
                variant="outlined"
                onClick={() => refreshListingDetails(l)}
                sx={{
                  p: 1.5, mb: 1, cursor: 'pointer',
                  borderColor: selected?.id === l.id ? 'primary.main' : undefined,
                }}
              >
                <Typography variant="body1" fontWeight={600}>{l.business_name}</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                  <Chip size="small" label={l.provider} />
                  <Chip size="small" label={l.status} color={l.status === 'verified' ? 'success' : 'default'} />
                </Stack>
              </Paper>
            ))}
          </Paper>
          <Box>
            {!selected ? (
              <Paper sx={{ p: 3 }}>
                <Typography color="text.secondary">Select a listing to view reviews and citations.</Typography>
              </Paper>
            ) : (
              <Stack spacing={2}>
                <Paper sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">{selected.business_name}</Typography>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => sync(selected)}>Sync reviews</Button>
                      <Button size="small" onClick={() => seedCitations(selected)}>Seed citations</Button>
                    </Stack>
                  </Stack>
                </Paper>
                <Paper>
                  <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle2">Reviews ({reviews.length})</Typography>
                  </Box>
                  {reviews.length === 0 && <Box sx={{ p: 2 }}><Typography variant="body2" color="text.secondary">No reviews yet — try Sync.</Typography></Box>}
                  {reviews.map((r) => (
                    <Box key={r.id} sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip size="small" label={`★ ${r.rating}`} color={r.sentiment === 'positive' ? 'success' : r.sentiment === 'negative' ? 'error' : 'default'} />
                          <Typography variant="caption">{r.author_name ?? 'Anonymous'}</Typography>
                        </Stack>
                        {!r.response_body && (
                          <Button size="small" onClick={() => { setReplyOpen(r); setReplyBody(''); }}>Reply</Button>
                        )}
                      </Stack>
                      <Typography variant="body2" sx={{ mt: 1 }}>{r.body}</Typography>
                      {r.response_body && (
                        <Box sx={{ mt: 1, pl: 2, borderLeft: 2, borderColor: 'primary.main' }}>
                          <Typography variant="caption" color="text.secondary">Your reply:</Typography>
                          <Typography variant="body2">{r.response_body}</Typography>
                        </Box>
                      )}
                    </Box>
                  ))}
                </Paper>
                <Paper>
                  <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle2">Citations ({citations.length})</Typography>
                  </Box>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Directory</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {citations.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell><a href={c.directory_url} target="_blank" rel="noreferrer">{c.directory_name}</a></TableCell>
                          <TableCell>
                            <Select size="small" value={c.status} onChange={(e) => updateCitation(c, e.target.value as CitationStatus)}>
                              <MenuItem value="pending">pending</MenuItem>
                              <MenuItem value="submitted">submitted</MenuItem>
                              <MenuItem value="live">live</MenuItem>
                              <MenuItem value="rejected">rejected</MenuItem>
                            </Select>
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                      {citations.length === 0 && (
                        <TableRow><TableCell colSpan={3} align="center" sx={{ color: 'text.secondary', py: 2 }}>No citations seeded.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Paper>
              </Stack>
            )}
          </Box>
        </Box>
      )}

      {tab === 'aso' && (
        <>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
            <Button variant="contained" onClick={() => setAppOpen(true)}>Track app</Button>
          </Stack>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>App</TableCell>
                  <TableCell>Platform</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Rating</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {apps.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell>{a.app_name}<br /><Typography variant="caption" color="text.secondary">{a.developer_name}</Typography></TableCell>
                    <TableCell><Chip size="small" label={a.platform} /></TableCell>
                    <TableCell>{a.category ?? '—'}</TableCell>
                    <TableCell align="right">{a.rating_average ?? '—'} {a.rating_count ? `(${a.rating_count})` : ''}</TableCell>
                    <TableCell>{a.current_version ?? '—'}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => seoApi.syncApp(active!.id, a.id).then(refresh)}>Sync</Button>
                      <IconButton size="small" onClick={() => seoApi.removeApp(active!.id, a.id).then(refresh)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {apps.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 4 }}>No apps tracked.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New local listing</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Select value={createForm.provider} onChange={(e) => setCreateForm({ ...createForm, provider: e.target.value as LocalProvider })}>
              <MenuItem value="gmb">Google Business Profile</MenuItem>
              <MenuItem value="apple_maps">Apple Maps</MenuItem>
              <MenuItem value="bing_places">Bing Places</MenuItem>
              <MenuItem value="yelp">Yelp</MenuItem>
            </Select>
            <TextField label="Provider account id" value={createForm.provider_account_id} onChange={(e) => setCreateForm({ ...createForm, provider_account_id: e.target.value })} />
            <TextField label="Business name" value={createForm.business_name} onChange={(e) => setCreateForm({ ...createForm, business_name: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createListing} disabled={!createForm.business_name || !createForm.provider_account_id}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={appOpen} onClose={() => setAppOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Track an app</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Select value={appForm.platform} onChange={(e) => setAppForm({ ...appForm, platform: e.target.value as AppPlatform })}>
              <MenuItem value="ios">iOS</MenuItem>
              <MenuItem value="android">Android</MenuItem>
            </Select>
            <TextField label="App ID" placeholder={appForm.platform === 'ios' ? '123456789' : 'com.example.app'} value={appForm.app_external_id} onChange={(e) => setAppForm({ ...appForm, app_external_id: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAppOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={trackApp} disabled={!appForm.app_external_id}>Track</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!replyOpen} onClose={() => setReplyOpen(null)} fullWidth maxWidth="sm">
        <DialogTitle>Reply to review</DialogTitle>
        <DialogContent>
          {replyOpen && <Alert severity="info" sx={{ mb: 2 }}><Typography variant="caption">★ {replyOpen.rating}</Typography><br />{replyOpen.body}</Alert>}
          <TextField multiline minRows={4} fullWidth label="Reply" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReplyOpen(null)}>Cancel</Button>
          <Button variant="contained" onClick={submitReply} disabled={!replyBody}>Reply</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
