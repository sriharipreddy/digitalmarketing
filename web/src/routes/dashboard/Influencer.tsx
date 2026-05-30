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
  Avatar,
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
import SendIcon from '@mui/icons-material/Send';
import EmailIcon from '@mui/icons-material/Email';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import {
  influencerApi,
  type Influencer,
  type Outreach,
  type InfluencerPlatform,
  type InfluencerStatus,
} from '@/lib/influencer-api';

const STATUSES: InfluencerStatus[] = ['discovered', 'shortlisted', 'contacted', 'negotiating', 'contracted', 'declined', 'paused'];
const STATUS_COLORS: Record<InfluencerStatus, 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'> = {
  discovered: 'default',
  shortlisted: 'info',
  contacted: 'info',
  negotiating: 'warning',
  contracted: 'success',
  declined: 'error',
  paused: 'default',
};

export default function InfluencerPage() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const { enqueueSnackbar } = useSnackbar();

  const [tab, setTab] = useState<'influencers' | 'outreach'>('influencers');
  const [loading, setLoading] = useState(true);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [outreach, setOutreach] = useState<Outreach[]>([]);

  // Discovery form
  const [platform, setPlatform] = useState<InfluencerPlatform>('instagram');
  const [topic, setTopic] = useState('');
  const [minFollowers, setMinFollowers] = useState('5000');
  const [limit, setLimit] = useState('10');
  const [discovering, setDiscovering] = useState(false);

  // Outreach dialog
  const [draftOpen, setDraftOpen] = useState<{ influencer: Influencer } | null>(null);
  const [brief, setBrief] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [previewOutreach, setPreviewOutreach] = useState<Outreach | null>(null);

  const refresh = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const [i, o] = await Promise.all([
        influencerApi.list(active.id),
        influencerApi.listOutreach(active.id),
      ]);
      setInfluencers(i.data.data.rows);
      setOutreach(o.data.data.rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const discover = async () => {
    if (!active) return;
    setDiscovering(true);
    try {
      const r = await influencerApi.discover(active.id, {
        platform,
        topic: topic.trim() || undefined,
        min_followers: Number(minFollowers) || undefined,
        limit: Number(limit) || 10,
      });
      enqueueSnackbar(`Found ${r.data.data.discovered} influencers`, { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Discovery failed', { variant: 'error' });
    } finally {
      setDiscovering(false);
    }
  };

  const updateStatus = async (inf: Influencer, status: InfluencerStatus) => {
    if (!active) return;
    try {
      await influencerApi.updateStatus(active.id, inf.id, status);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const remove = async (inf: Influencer) => {
    if (!active) return;
    if (!confirm(`Remove ${inf.handle}?`)) return;
    try {
      await influencerApi.remove(active.id, inf.id);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const submitDraft = async () => {
    if (!active || !draftOpen) return;
    setDrafting(true);
    try {
      const r = await influencerApi.draft(active.id, {
        influencer_id: draftOpen.influencer.id,
        campaign_brief: brief,
      });
      setDraftOpen(null);
      setBrief('');
      enqueueSnackbar('Outreach drafted', { variant: 'success' });
      setPreviewOutreach(r.data.data.outreach);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    } finally {
      setDrafting(false);
    }
  };

  const sendOutreach = async (o: Outreach) => {
    if (!active) return;
    try {
      await influencerApi.sendOutreach(active.id, o.id);
      enqueueSnackbar('Outreach sent', { variant: 'success' });
      setPreviewOutreach(null);
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
        Influencers
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Discovery is in <strong>stub mode</strong>. Drop a HypeAuditor or Modash API key into{' '}
        <code>api/influencer-hub/.env</code> for real data.
      </Alert>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab value="influencers" label={`Influencers (${influencers.length})`} />
          <Tab value="outreach" label={`Outreach (${outreach.length})`} />
        </Tabs>
      </Paper>

      {tab === 'influencers' && (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Discover influencers
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Select size="small" value={platform} onChange={(e) => setPlatform(e.target.value as InfluencerPlatform)}>
                <MenuItem value="instagram">Instagram</MenuItem>
                <MenuItem value="tiktok">TikTok</MenuItem>
                <MenuItem value="youtube">YouTube</MenuItem>
                <MenuItem value="twitter">Twitter</MenuItem>
                <MenuItem value="linkedin">LinkedIn</MenuItem>
              </Select>
              <TextField size="small" placeholder="Topic (e.g. fitness)" value={topic} onChange={(e) => setTopic(e.target.value)} />
              <TextField
                size="small"
                type="number"
                label="Min followers"
                value={minFollowers}
                onChange={(e) => setMinFollowers(e.target.value)}
                sx={{ width: 150 }}
              />
              <TextField
                size="small"
                type="number"
                label="Limit"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                sx={{ width: 100 }}
              />
              <Button variant="contained" onClick={discover} disabled={discovering}>
                {discovering ? <CircularProgress size={18} color="inherit" /> : 'Discover'}
              </Button>
            </Stack>
          </Paper>

          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Creator</TableCell>
                  <TableCell>Platform</TableCell>
                  <TableCell align="right">Followers</TableCell>
                  <TableCell align="right">ER</TableCell>
                  <TableCell align="right">Est. cost</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {influencers.map((i) => (
                  <TableRow key={i.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar src={i.avatar_url ?? undefined} sx={{ width: 32, height: 32 }}>
                          {i.handle.slice(1, 3).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2">{i.handle}</Typography>
                          {i.display_name && (
                            <Typography variant="caption" color="text.secondary">
                              {i.display_name}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip label={i.platform} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">{i.followers.toLocaleString()}</TableCell>
                    <TableCell align="right">{(i.engagement_rate * 100).toFixed(2)}%</TableCell>
                    <TableCell align="right">
                      {i.estimated_cost_usd != null ? `$${i.estimated_cost_usd.toFixed(0)}` : '—'}
                    </TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={i.status}
                        onChange={(e) => updateStatus(i, e.target.value as InfluencerStatus)}
                        sx={{ minWidth: 130 }}
                      >
                        {STATUSES.map((s) => (
                          <MenuItem key={s} value={s}>
                            {s}
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => setDraftOpen({ influencer: i })}>
                        <EmailIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => remove(i)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {influencers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        No influencers yet — discover some above.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
          {influencers.length > 0 && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
              {STATUSES.map((s) => {
                const count = influencers.filter((i) => i.status === s).length;
                if (count === 0) return null;
                return <Chip key={s} label={`${s}: ${count}`} size="small" color={STATUS_COLORS[s]} />;
              })}
            </Stack>
          )}
        </>
      )}

      {tab === 'outreach' && (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Creator</TableCell>
                <TableCell>Channel</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {outreach.map((o) => (
                <TableRow key={o.id} hover>
                  <TableCell>{o.influencer?.handle ?? '—'}</TableCell>
                  <TableCell>
                    <Chip label={o.channel} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.subject ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={o.status}
                      size="small"
                      color={
                        o.status === 'accepted' ? 'success' :
                        o.status === 'declined' ? 'error' :
                        o.status === 'sent' || o.status === 'replied' ? 'info' :
                        'default'
                      }
                    />
                  </TableCell>
                  <TableCell>{new Date(o.created_at).toLocaleString()}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setPreviewOutreach(o)}>
                      View
                    </Button>
                    {o.status === 'draft' && (
                      <IconButton size="small" onClick={() => sendOutreach(o)} title="Send">
                        <SendIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {outreach.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No outreach yet — draft one from the Influencers tab.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={!!draftOpen} onClose={() => setDraftOpen(null)} fullWidth maxWidth="sm">
        <DialogTitle>Draft outreach to {draftOpen?.influencer.handle}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Campaign brief (1-2 sentences)"
              multiline
              minRows={3}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="We're launching a new fitness app and looking for creators to demo it in stories…"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDraftOpen(null)}>Cancel</Button>
          <Button variant="contained" onClick={submitDraft} disabled={drafting || brief.trim().length < 10}>
            {drafting ? 'Drafting…' : 'Draft'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!previewOutreach} onClose={() => setPreviewOutreach(null)} fullWidth maxWidth="md">
        <DialogTitle>{previewOutreach?.subject}</DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary">
            To {previewOutreach?.influencer?.handle} via {previewOutreach?.channel}
          </Typography>
          <Box
            component="pre"
            sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}
          >
            {previewOutreach?.body}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOutreach(null)}>Close</Button>
          {previewOutreach?.status === 'draft' && (
            <Button variant="contained" onClick={() => previewOutreach && sendOutreach(previewOutreach)}>
              Send
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
