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
  Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import { emailApi, type EmailList, type EmailSend } from '@/lib/email-api';

const STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  queued: 'info',
  sending: 'info',
  completed: 'success',
  partial: 'warning',
  failed: 'error',
};

export default function EmailPage() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const { enqueueSnackbar } = useSnackbar();

  const [lists, setLists] = useState<EmailList[]>([]);
  const [sends, setSends] = useState<EmailSend[]>([]);
  const [loading, setLoading] = useState(true);

  const [listOpen, setListOpen] = useState(false);
  const [listForm, setListForm] = useState({
    name: '',
    description: '',
    tag_includes: '',
    lifecycle_in: '',
  });

  const [sendOpen, setSendOpen] = useState(false);
  const [sendForm, setSendForm] = useState({
    list_id: '',
    subject: '',
    html: '<h1>Hello!</h1>',
  });
  const [preview, setPreview] = useState<{ size: number; sample: string[] } | null>(null);

  const refresh = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const [l, s] = await Promise.all([
        emailApi.listLists(active.id),
        emailApi.listSends(active.id, { limit: 25 }),
      ]);
      setLists(l.data.data.lists);
      setSends(s.data.data.rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const submitList = async () => {
    if (!active) return;
    try {
      const filter = {
        tag_includes: listForm.tag_includes.split(',').map((s) => s.trim()).filter(Boolean),
        lifecycle_in: listForm.lifecycle_in.split(',').map((s) => s.trim()).filter(Boolean),
      };
      await emailApi.createList(active.id, {
        name: listForm.name,
        description: listForm.description || undefined,
        filter,
      });
      setListOpen(false);
      setListForm({ name: '', description: '', tag_includes: '', lifecycle_in: '' });
      enqueueSnackbar('List created', { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const removeList = async (id: string) => {
    if (!active) return;
    if (!confirm('Delete this list?')) return;
    try {
      await emailApi.removeList(active.id, id);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const previewList = async (id: string) => {
    if (!active) return;
    try {
      const r = await emailApi.previewList(active.id, id);
      enqueueSnackbar(`Audience: ${r.data.data.size} contacts`, { variant: 'info' });
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const openSend = (listId: string) => {
    setSendForm({ list_id: listId, subject: '', html: '<h1>Hello!</h1><p>Your message.</p>' });
    setPreview(null);
    setSendOpen(true);
  };

  const refreshPreview = async () => {
    if (!active || !sendForm.list_id) return;
    try {
      const r = await emailApi.previewList(active.id, sendForm.list_id);
      setPreview(r.data.data);
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Preview failed', { variant: 'error' });
    }
  };

  useEffect(() => {
    if (sendOpen && sendForm.list_id) void refreshPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendOpen, sendForm.list_id]);

  const submitSend = async () => {
    if (!active) return;
    try {
      const r = await emailApi.send(active.id, {
        list_id: sendForm.list_id,
        subject: sendForm.subject,
        html: sendForm.html,
      });
      setSendOpen(false);
      enqueueSnackbar(
        `Send ${r.data.data.send_id.slice(0, 8)}… queued for ${r.data.data.audience_size} contacts`,
        { variant: 'success' },
      );
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Send failed', { variant: 'error' });
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
        <Typography variant="h5">Email</Typography>
        <Button variant="contained" onClick={() => setListOpen(true)}>
          New list
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Email-hub is in <strong>stub mode</strong>. Drop <code>SENDGRID_API_KEY</code> into <code>api/email-hub/.env</code>
        + set <code>EMAIL_DRIVER=sendgrid</code> for live mail.
      </Alert>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Lists ({lists.length})
      </Typography>
      <Paper sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Filter</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {lists.map((l) => {
              const tags = (l.filter.tag_includes ?? []).join(', ');
              const stages = (l.filter.lifecycle_in ?? []).join(', ');
              return (
                <TableRow key={l.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {l.name}
                    </Typography>
                    {l.description && (
                      <Typography variant="caption" color="text.secondary">
                        {l.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      {tags && <Chip size="small" label={`tags: ${tags}`} variant="outlined" />}
                      {stages && <Chip size="small" label={`stages: ${stages}`} variant="outlined" />}
                    </Stack>
                  </TableCell>
                  <TableCell>{new Date(l.created_at).toLocaleString()}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => previewList(l.id)}>
                      Preview
                    </Button>
                    <Button size="small" onClick={() => openSend(l.id)} variant="outlined" sx={{ ml: 1 }}>
                      Send
                    </Button>
                    <IconButton size="small" onClick={() => removeList(l.id)} sx={{ ml: 0.5 }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
            {lists.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    No lists yet. Create one above.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Recent sends
      </Typography>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Subject</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Audience</TableCell>
              <TableCell align="right">Sent</TableCell>
              <TableCell align="right">Opens</TableCell>
              <TableCell align="right">Clicks</TableCell>
              <TableCell>When</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sends.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.subject}</TableCell>
                <TableCell>
                  <Chip label={s.status} size="small" color={STATUS_COLORS[s.status] ?? 'default'} />
                </TableCell>
                <TableCell align="right">{s.audience_size}</TableCell>
                <TableCell align="right">{s.sent_count}</TableCell>
                <TableCell align="right">{s.opens}</TableCell>
                <TableCell align="right">{s.clicks}</TableCell>
                <TableCell>{new Date(s.created_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {sends.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    No sends yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={listOpen} onClose={() => setListOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New email list</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={listForm.name} onChange={(e) => setListForm({ ...listForm, name: e.target.value })} fullWidth />
            <TextField label="Description (optional)" value={listForm.description} onChange={(e) => setListForm({ ...listForm, description: e.target.value })} fullWidth />
            <Divider />
            <Typography variant="caption" color="text.secondary">
              Filter (contacts must match all conditions). Unsubscribed contacts are always excluded.
            </Typography>
            <TextField
              label="Has tags (comma-separated)"
              value={listForm.tag_includes}
              onChange={(e) => setListForm({ ...listForm, tag_includes: e.target.value })}
              placeholder="newsletter, beta"
              fullWidth
            />
            <TextField
              label="In lifecycle stages (comma-separated)"
              value={listForm.lifecycle_in}
              onChange={(e) => setListForm({ ...listForm, lifecycle_in: e.target.value })}
              placeholder="lead, mql, customer"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setListOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitList} disabled={!listForm.name}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={sendOpen} onClose={() => setSendOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Send to list</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {preview && (
              <Alert severity="info">
                Audience: <strong>{preview.size}</strong> contacts. Sample: {preview.sample.slice(0, 3).join(', ')}
                {preview.size > preview.sample.length && '…'}
              </Alert>
            )}
            <TextField
              label="Subject"
              value={sendForm.subject}
              onChange={(e) => setSendForm({ ...sendForm, subject: e.target.value })}
              fullWidth
            />
            <TextField
              label="HTML body"
              multiline
              minRows={8}
              value={sendForm.html}
              onChange={(e) => setSendForm({ ...sendForm, html: e.target.value })}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={submitSend}
            disabled={!sendForm.subject || preview?.size === 0}
          >
            Send now
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
