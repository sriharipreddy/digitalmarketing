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
  IconButton,
  Alert,
  Select,
  MenuItem,
  Avatar,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import { socialApi, type SocialAccount, type SocialPost, type SocialPlatform } from '@/lib/social-api';

const PLATFORMS: SocialPlatform[] = ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'youtube'];

const STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  scheduled: 'info',
  publishing: 'info',
  published: 'success',
  failed: 'error',
  cancelled: 'default',
};

export default function Social() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const { enqueueSnackbar } = useSnackbar();

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [postOpen, setPostOpen] = useState(false);
  const [postForm, setPostForm] = useState({ account_id: '', content: '', scheduled_at: '' });

  const refresh = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const [a, p] = await Promise.all([
        socialApi.listAccounts(active.id),
        socialApi.listPosts(active.id, { limit: 50 }),
      ]);
      setAccounts(a.data.data.accounts);
      setPosts(p.data.data.rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const connect = async (platform: SocialPlatform) => {
    if (!active) return;
    try {
      // In stub mode, the authorize URL points right back at our callback path.
      const r = await socialApi.startConnect(active.id, platform, window.location.origin + '/dashboard/social');
      // Stub URL has ?code=stub_code_xxx&state=xxx&platform=xxx. Parse and immediately finish.
      const url = new URL(r.data.data.authorize_url);
      const code = url.searchParams.get('code')!;
      const state = url.searchParams.get('state')!;
      await socialApi.finishConnect(active.id, { platform, code, state });
      enqueueSnackbar(`Connected ${platform}`, { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Connect failed', { variant: 'error' });
    }
  };

  const disconnect = async (a: SocialAccount) => {
    if (!active) return;
    if (!confirm(`Disconnect ${a.platform} @${a.handle}?`)) return;
    try {
      await socialApi.disconnect(active.id, a.id);
      enqueueSnackbar('Disconnected', { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const submitPost = async () => {
    if (!active) return;
    try {
      await socialApi.createPost(active.id, {
        account_id: postForm.account_id,
        content: postForm.content,
        scheduled_at: postForm.scheduled_at ? new Date(postForm.scheduled_at).toISOString() : null,
      });
      setPostOpen(false);
      setPostForm({ account_id: '', content: '', scheduled_at: '' });
      enqueueSnackbar('Post created', { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const publishNow = async (p: SocialPost) => {
    if (!active) return;
    try {
      await socialApi.publishPost(active.id, p.id);
      enqueueSnackbar(`Published to ${p.platform}`, { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Publish failed', { variant: 'error' });
    }
  };

  const removePost = async (p: SocialPost) => {
    if (!active) return;
    if (!confirm('Delete this post?')) return;
    try {
      await socialApi.removePost(active.id, p.id);
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
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Social</Typography>
        <Button variant="contained" onClick={() => setPostOpen(true)} disabled={accounts.length === 0}>
          New post
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        OAuth is in <strong>stub mode</strong>. "Connect" creates a fake account; "Publish" returns a fake external
        post ID. Once Meta/Twitter/LinkedIn approve your apps, drop the credentials into <code>api/social-hub/.env</code>
        and set <code>SOCIAL_DRIVER=live</code>.
      </Alert>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Connected accounts
      </Typography>
      <Paper sx={{ mb: 3, p: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {PLATFORMS.map((p) => (
            <Button key={p} variant="outlined" size="small" onClick={() => connect(p)}>
              Connect {p}
            </Button>
          ))}
        </Stack>
        {accounts.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            No accounts connected yet.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Account</TableCell>
                <TableCell>Platform</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>
                        {a.handle.slice(1, 3).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2">{a.handle}</Typography>
                        {a.display_name && (
                          <Typography variant="caption" color="text.secondary">
                            {a.display_name}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip label={a.platform} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={a.status}
                      size="small"
                      color={a.status === 'connected' ? 'success' : 'warning'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => disconnect(a)}>
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
        Posts ({posts.length})
      </Typography>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Content</TableCell>
              <TableCell>Platform</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Scheduled</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {posts.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell sx={{ maxWidth: 380 }}>
                  <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.content}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={p.platform} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  <Chip label={p.status} size="small" color={STATUS_COLORS[p.status] ?? 'default'} />
                </TableCell>
                <TableCell>{p.scheduled_at ? new Date(p.scheduled_at).toLocaleString() : '—'}</TableCell>
                <TableCell align="right">
                  {p.external_url && (
                    <IconButton size="small" onClick={() => window.open(p.external_url!, '_blank')}>
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  )}
                  {(p.status === 'draft' || p.status === 'scheduled' || p.status === 'failed') && (
                    <IconButton size="small" onClick={() => publishNow(p)} title="Publish now">
                      <SendIcon fontSize="small" />
                    </IconButton>
                  )}
                  <IconButton size="small" onClick={() => removePost(p)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {posts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    No posts yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={postOpen} onClose={() => setPostOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New social post</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Select
              value={postForm.account_id}
              onChange={(e) => setPostForm({ ...postForm, account_id: e.target.value as string })}
              displayEmpty
            >
              <MenuItem value="" disabled>
                Select account
              </MenuItem>
              {accounts.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.platform} — {a.handle}
                </MenuItem>
              ))}
            </Select>
            <TextField
              label="Content"
              multiline
              minRows={4}
              value={postForm.content}
              onChange={(e) => setPostForm({ ...postForm, content: e.target.value })}
              fullWidth
              helperText={`${postForm.content.length} chars`}
            />
            <TextField
              label="Schedule for (optional)"
              type="datetime-local"
              value={postForm.scheduled_at}
              onChange={(e) => setPostForm({ ...postForm, scheduled_at: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPostOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitPost} disabled={!postForm.account_id || !postForm.content}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
