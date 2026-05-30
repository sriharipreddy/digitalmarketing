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
  Divider,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import { campaignApi, type Campaign, type UtmLink } from '@/lib/campaign-api';

const STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  scheduled: 'info',
  sending: 'info',
  completed: 'success',
  paused: 'warning',
  cancelled: 'error',
};

export default function Campaigns() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const { enqueueSnackbar } = useSnackbar();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [utmLinks, setUtmLinks] = useState<UtmLink[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    goal: '',
    subject: '',
    html: '<h1>Hello!</h1><p>Your message here.</p>',
    tag_includes: '',
  });
  const [creating, setCreating] = useState(false);

  const [utmOpen, setUtmOpen] = useState(false);
  const [utmForm, setUtmForm] = useState({
    destination_url: '',
    source: '',
    medium: 'email',
    campaign: '',
  });

  const refresh = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const [c, u] = await Promise.all([
        campaignApi.list(active.id),
        campaignApi.listUtm(active.id),
      ]);
      setCampaigns(c.data.data.rows);
      setUtmLinks(u.data.data.rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const submitCreate = async () => {
    if (!active) return;
    setCreating(true);
    try {
      const tag_includes = form.tag_includes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await campaignApi.create(active.id, {
        name: form.name,
        kind: 'email',
        goal: form.goal || undefined,
        channels: [
          {
            kind: 'email',
            config: {
              subject: form.subject,
              html: form.html,
              inline_filter: tag_includes.length ? { tag_includes } : undefined,
            },
          },
        ],
      });
      setCreateOpen(false);
      setForm({ name: '', goal: '', subject: '', html: '<h1>Hello!</h1><p>Your message here.</p>', tag_includes: '' });
      enqueueSnackbar('Campaign created', { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Create failed', { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const dispatch = async (c: Campaign) => {
    if (!active) return;
    try {
      const r = await campaignApi.dispatch(active.id, c.id);
      enqueueSnackbar(
        `Dispatched — campaign status: ${r.data.data.status}`,
        { variant: r.data.data.status === 'completed' ? 'success' : 'warning' },
      );
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Dispatch failed', { variant: 'error' });
    }
  };

  const remove = async (c: Campaign) => {
    if (!active) return;
    if (!confirm(`Delete campaign "${c.name}"?`)) return;
    try {
      await campaignApi.remove(active.id, c.id);
      enqueueSnackbar('Campaign deleted', { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Delete failed', { variant: 'error' });
    }
  };

  const createUtm = async () => {
    if (!active) return;
    try {
      await campaignApi.createUtm(active.id, utmForm);
      setUtmOpen(false);
      setUtmForm({ destination_url: '', source: '', medium: 'email', campaign: '' });
      enqueueSnackbar('UTM link created', { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const copyUtm = (url: string) => {
    void navigator.clipboard.writeText(url);
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
        <Typography variant="h5">Campaigns</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => setUtmOpen(true)}>
            New UTM link
          </Button>
          <Button variant="contained" onClick={() => setCreateOpen(true)}>
            New campaign
          </Button>
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Sends route via email-hub which uses the SendGrid <strong>stub driver</strong> by default. Drop a real
        <code> SENDGRID_API_KEY</code> in <code>api/email-hub/.env</code> + set <code>EMAIL_DRIVER=sendgrid</code>
        for live mail.
      </Alert>

      <Paper sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Kind</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Channels</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {campaigns.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.name}</TableCell>
                <TableCell>
                  <Chip label={c.kind} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  <Chip label={c.status} size="small" color={STATUS_COLORS[c.status] ?? 'default'} />
                </TableCell>
                <TableCell>{c.channels?.length ?? 0}</TableCell>
                <TableCell>{new Date(c.createdAt).toLocaleString()}</TableCell>
                <TableCell align="right">
                  {c.status === 'draft' && (
                    <IconButton size="small" onClick={() => dispatch(c)} title="Dispatch">
                      <SendIcon fontSize="small" />
                    </IconButton>
                  )}
                  <IconButton size="small" onClick={() => remove(c)} disabled={c.status === 'sending'}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {campaigns.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    No campaigns yet. Create one above.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1 }}>
        UTM links
      </Typography>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Short URL</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Medium</TableCell>
              <TableCell>Campaign</TableCell>
              <TableCell align="right">Clicks</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {utmLinks.map((u) => {
              // Same-origin redirect — Vite proxy / Nginx routes /api/v1/campaign to campaign-manager.
              const utmBase = import.meta.env.VITE_UTM_REDIRECT_BASE ?? `${window.location.origin}/api/v1/campaign`;
              const shortUrl = `${utmBase}/u/${u.short_code}`;
              return (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <code style={{ fontSize: 12 }}>{shortUrl}</code>
                  </TableCell>
                  <TableCell>{u.source}</TableCell>
                  <TableCell>{u.medium}</TableCell>
                  <TableCell>{u.campaign}</TableCell>
                  <TableCell align="right">{u.click_count}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => copyUtm(shortUrl)}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
            {utmLinks.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    No UTM links yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>New email campaign</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
            <TextField
              label="Goal (optional)"
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              fullWidth
            />
            <Divider />
            <Typography variant="caption" color="text.secondary">
              Email channel
            </Typography>
            <TextField
              label="Subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              fullWidth
            />
            <TextField
              label="HTML body"
              multiline
              minRows={6}
              value={form.html}
              onChange={(e) => setForm({ ...form, html: e.target.value })}
              fullWidth
            />
            <TextField
              label="Audience: include contacts with tags (comma-separated)"
              value={form.tag_includes}
              onChange={(e) => setForm({ ...form, tag_includes: e.target.value })}
              placeholder="e.g. newsletter, beta-users"
              fullWidth
              helperText="Leave empty to target all subscribed contacts in the workspace"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitCreate} disabled={creating || !form.name || !form.subject}>
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={utmOpen} onClose={() => setUtmOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New UTM link</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Destination URL"
              value={utmForm.destination_url}
              onChange={(e) => setUtmForm({ ...utmForm, destination_url: e.target.value })}
              placeholder="https://yoursite.com/landing"
              fullWidth
            />
            <Stack direction="row" spacing={1}>
              <TextField label="Source" value={utmForm.source} onChange={(e) => setUtmForm({ ...utmForm, source: e.target.value })} fullWidth />
              <Select value={utmForm.medium} onChange={(e) => setUtmForm({ ...utmForm, medium: e.target.value as string })} sx={{ minWidth: 140 }}>
                <MenuItem value="email">email</MenuItem>
                <MenuItem value="social">social</MenuItem>
                <MenuItem value="cpc">cpc</MenuItem>
                <MenuItem value="organic">organic</MenuItem>
                <MenuItem value="referral">referral</MenuItem>
              </Select>
            </Stack>
            <TextField label="Campaign" value={utmForm.campaign} onChange={(e) => setUtmForm({ ...utmForm, campaign: e.target.value })} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUtmOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createUtm} disabled={!utmForm.destination_url || !utmForm.source || !utmForm.campaign}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
