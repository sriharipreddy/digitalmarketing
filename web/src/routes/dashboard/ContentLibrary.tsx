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
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import TranslateIcon from '@mui/icons-material/Translate';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import {
  contentApi,
  type ContentPiece,
  type ContentStatus,
  type ContentKind,
} from '@/lib/content-api';

const STATUSES: ContentStatus[] = ['draft', 'in_review', 'scheduled', 'published', 'archived'];
const KINDS: ContentKind[] = ['blog', 'social', 'email', 'ad_copy', 'headline', 'landing_page', 'press_release'];

const STATUS_COLORS: Record<ContentStatus, 'default' | 'success' | 'warning' | 'info'> = {
  draft: 'default',
  in_review: 'warning',
  scheduled: 'info',
  published: 'success',
  archived: 'default',
};

export default function ContentLibrary() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(true);
  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterKind, setFilterKind] = useState<string>('');

  const [editing, setEditing] = useState<ContentPiece | null>(null);
  const [editForm, setEditForm] = useState({ title: '', body: '', status: 'draft' as ContentStatus, scheduled_at: '' });

  const [translating, setTranslating] = useState<ContentPiece | null>(null);
  const [target, setTarget] = useState('es');

  const refresh = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const r = await contentApi.listPieces(active.id, {
        status: filterStatus || undefined,
        kind: filterKind || undefined,
        limit: 100,
      });
      setPieces(r.data.data.rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, filterStatus, filterKind]);

  const startEdit = (p: ContentPiece) => {
    setEditing(p);
    setEditForm({
      title: p.title,
      body: p.body,
      status: p.status,
      scheduled_at: p.scheduled_at ? p.scheduled_at.slice(0, 16) : '',
    });
  };

  const submitEdit = async () => {
    if (!active || !editing) return;
    try {
      const patch: any = {
        title: editForm.title,
        body: editForm.body,
        status: editForm.status,
      };
      if (editForm.status === 'scheduled') {
        if (!editForm.scheduled_at) {
          enqueueSnackbar('Pick a scheduled_at when status=scheduled', { variant: 'warning' });
          return;
        }
        patch.scheduled_at = new Date(editForm.scheduled_at).toISOString();
      } else if (editForm.scheduled_at) {
        patch.scheduled_at = new Date(editForm.scheduled_at).toISOString();
      }
      await contentApi.updatePiece(active.id, editing.id, patch);
      enqueueSnackbar('Updated', { variant: 'success' });
      setEditing(null);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Update failed', { variant: 'error' });
    }
  };

  const translate = async () => {
    if (!active || !translating) return;
    try {
      const r = await contentApi.translatePiece(active.id, translating.id, target);
      enqueueSnackbar(`Translated to ${target}`, { variant: 'success' });
      setTranslating(null);
      void refresh();
      // Open the new translation in the editor
      setTimeout(() => startEdit(r.data.data.piece), 200);
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Translation failed', { variant: 'error' });
    }
  };

  const remove = async (p: ContentPiece) => {
    if (!active) return;
    if (!confirm(`Delete "${p.title}"?`)) return;
    try {
      await contentApi.removePiece(active.id, p.id);
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
        Content library
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Save AI generations here to edit, schedule, and translate them. Pieces flow through{' '}
        <strong>draft → in_review → scheduled → published</strong>.
      </Alert>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="body2">Filter:</Typography>
          <Select size="small" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as string)} displayEmpty sx={{ minWidth: 150 }}>
            <MenuItem value="">Any status</MenuItem>
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </Select>
          <Select size="small" value={filterKind} onChange={(e) => setFilterKind(e.target.value as string)} displayEmpty sx={{ minWidth: 150 }}>
            <MenuItem value="">Any kind</MenuItem>
            {KINDS.map((k) => (
              <MenuItem key={k} value={k}>
                {k}
              </MenuItem>
            ))}
          </Select>
          <Box sx={{ flex: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {pieces.length} piece(s)
          </Typography>
        </Stack>
      </Paper>

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Kind</TableCell>
              <TableCell>Language</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Scheduled</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {pieces.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell sx={{ maxWidth: 280 }}>
                  <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={p.kind} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  <Chip label={p.language} size="small" />
                </TableCell>
                <TableCell>
                  <Chip label={p.status} size="small" color={STATUS_COLORS[p.status]} />
                </TableCell>
                <TableCell>{p.scheduled_at ? new Date(p.scheduled_at).toLocaleString() : '—'}</TableCell>
                <TableCell>{new Date(p.updated_at).toLocaleString()}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => setTranslating(p)} title="Translate">
                    <TranslateIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => startEdit(p)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => remove(p)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {pieces.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    No pieces yet. Generate copy in <strong>Content</strong>, then click "Save as
                    piece".
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="md">
        <DialogTitle>Edit content piece</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              fullWidth
            />
            <TextField
              label="Body"
              value={editForm.body}
              onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
              multiline
              minRows={10}
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <Select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ContentStatus })}
                sx={{ minWidth: 180 }}
              >
                {STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
              <TextField
                label="Scheduled for"
                type="datetime-local"
                value={editForm.scheduled_at}
                onChange={(e) => setEditForm({ ...editForm, scheduled_at: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={submitEdit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!translating} onClose={() => setTranslating(null)} fullWidth maxWidth="xs">
        <DialogTitle>Translate</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Translate "{translating?.title}" into:
            </Typography>
            <Select value={target} onChange={(e) => setTarget(e.target.value as string)}>
              <MenuItem value="es">Spanish (es)</MenuItem>
              <MenuItem value="fr">French (fr)</MenuItem>
              <MenuItem value="de">German (de)</MenuItem>
              <MenuItem value="pt">Portuguese (pt)</MenuItem>
              <MenuItem value="it">Italian (it)</MenuItem>
              <MenuItem value="ja">Japanese (ja)</MenuItem>
              <MenuItem value="zh">Chinese (zh)</MenuItem>
            </Select>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTranslating(null)}>Cancel</Button>
          <Button variant="contained" onClick={translate}>
            Translate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
