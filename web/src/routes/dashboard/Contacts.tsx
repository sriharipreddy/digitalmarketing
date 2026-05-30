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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import { crmApi, type Contact, type LifecycleStage } from '@/lib/crm-api';

const STAGES: LifecycleStage[] = ['subscriber', 'lead', 'mql', 'sql', 'customer', 'evangelist', 'churned'];

export default function Contacts() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const { enqueueSnackbar } = useSnackbar();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<string>('');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', company: '', phone: '' });
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const r = await crmApi.listContacts(active.id, {
        limit: 100,
        stage: stageFilter || undefined,
      });
      setContacts(r.data.data.rows);
      setTotal(r.data.data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, stageFilter]);

  const submitCreate = async () => {
    if (!active) return;
    if (!form.email && !form.phone) {
      enqueueSnackbar('Email or phone required', { variant: 'warning' });
      return;
    }
    setCreating(true);
    try {
      await crmApi.createContact(active.id, {
        email: form.email || undefined,
        first_name: form.first_name || undefined,
        last_name: form.last_name || undefined,
        company: form.company || undefined,
        phone: form.phone || undefined,
      });
      setCreateOpen(false);
      setForm({ email: '', first_name: '', last_name: '', company: '', phone: '' });
      enqueueSnackbar('Contact created', { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const updateStage = async (c: Contact, newStage: LifecycleStage) => {
    if (!active) return;
    try {
      await crmApi.updateContact(active.id, c.id, { lifecycle_stage: newStage });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const remove = async (c: Contact) => {
    if (!active) return;
    if (!confirm(`Delete ${c.email ?? c.phone}?`)) return;
    try {
      await crmApi.removeContact(active.id, c.id);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Contacts</Typography>
        <Button variant="contained" onClick={() => setCreateOpen(true)}>
          New contact
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="body2">Filter by lifecycle:</Typography>
          <Select
            size="small"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as string)}
            displayEmpty
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All ({total})</MenuItem>
            {STAGES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Stage</TableCell>
                <TableCell>Source</TableCell>
                <TableCell align="right">Score</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {contacts.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>{c.email ?? '—'}</TableCell>
                  <TableCell>{[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}</TableCell>
                  <TableCell>{c.company ?? '—'}</TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={c.lifecycle_stage}
                      onChange={(e) => updateStage(c, e.target.value as LifecycleStage)}
                      sx={{ minWidth: 130 }}
                    >
                      {STAGES.map((s) => (
                        <MenuItem key={s} value={s}>
                          {s}
                        </MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>
                    {c.source ? <Chip label={c.source} size="small" variant="outlined" /> : '—'}
                  </TableCell>
                  <TableCell align="right">{c.lead_score}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => remove(c)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {contacts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No contacts yet. Add one above or publish a lead form.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New contact</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
            <Stack direction="row" spacing={1}>
              <TextField label="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} fullWidth />
              <TextField label="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} fullWidth />
            </Stack>
            <TextField label="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} fullWidth />
            <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitCreate} disabled={creating || (!form.email && !form.phone)}>
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
