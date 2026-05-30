import { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Stack, Button, TextField, Chip, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, Tabs, Tab, Alert,
} from '@mui/material';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import {
  messagingApi,
  type MessageRow,
  type MessagingSuppression,
  type MessagingChannel,
} from '@/lib/email-api';

const STATUS_COLORS: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  queued: 'default',
  sending: 'info',
  sent: 'success',
  delivered: 'success',
  failed: 'error',
  bounced: 'error',
};

export default function Messaging() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const { enqueueSnackbar } = useSnackbar();

  const [tab, setTab] = useState<'send' | 'log' | 'suppressions'>('send');
  const [loading, setLoading] = useState(true);

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [suppressions, setSuppressions] = useState<MessagingSuppression[]>([]);
  const [channelFilter, setChannelFilter] = useState<MessagingChannel | ''>('');

  const [form, setForm] = useState({
    channel: 'sms' as MessagingChannel,
    to: '',
    body: '',
    template_external_id: '',
    recipient_timezone: 'UTC',
  });

  const [suppressOpen, setSuppressOpen] = useState(false);
  const [suppressForm, setSuppressForm] = useState({ channel: 'sms' as MessagingChannel, address: '', reason: 'manual' });

  const refresh = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const [m, s] = await Promise.all([
        messagingApi.list(active.id, channelFilter ? { channel: channelFilter, limit: 100 } : { limit: 100 }),
        messagingApi.listSuppressions(active.id, channelFilter || undefined),
      ]);
      setMessages(m.data.data.messages);
      setSuppressions(s.data.data.suppressions);
    } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [active?.id, channelFilter]);

  const send = async () => {
    if (!active) return;
    try {
      const r = await messagingApi.send(active.id, {
        channel: form.channel,
        to: form.to,
        body: form.body,
        template_external_id: form.template_external_id || undefined,
        recipient_timezone: form.recipient_timezone || undefined,
      });
      enqueueSnackbar(`Sent — status: ${r.data.data.message.status}`, { variant: 'success' });
      setForm({ ...form, to: '', body: '' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const suppress = async () => {
    if (!active) return;
    try {
      await messagingApi.suppress(active.id, suppressForm);
      setSuppressOpen(false);
      setSuppressForm({ channel: 'sms', address: '', reason: 'manual' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const unsuppress = async (s: MessagingSuppression) => {
    if (!active) return;
    if (!confirm(`Remove ${s.address} from ${s.channel} suppression list?`)) return;
    await messagingApi.unsuppress(active.id, { channel: s.channel, address: s.address });
    void refresh();
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Messaging (SMS / WhatsApp / Push)</Typography>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab value="send" label="Send" />
          <Tab value="log" label={`Log (${messages.length})`} />
          <Tab value="suppressions" label={`Suppressions (${suppressions.length})`} />
        </Tabs>
      </Paper>

      {tab === 'send' && (
        <Paper sx={{ p: 3, maxWidth: 640 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            SMS and WhatsApp are TCPA-guarded — sends are blocked outside 9 am – 9 pm in the recipient's time zone.
          </Alert>
          <Stack spacing={2}>
            <Select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as MessagingChannel })}>
              <MenuItem value="sms">SMS</MenuItem>
              <MenuItem value="whatsapp">WhatsApp</MenuItem>
              <MenuItem value="push">Push</MenuItem>
            </Select>
            <TextField
              label={form.channel === 'push' ? 'Device token' : 'To (E.164 phone)'}
              value={form.to}
              onChange={(e) => setForm({ ...form, to: e.target.value })}
            />
            <TextField
              label="Body"
              multiline minRows={3}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
            {form.channel === 'whatsapp' && (
              <TextField
                label="Template id (optional)"
                value={form.template_external_id}
                onChange={(e) => setForm({ ...form, template_external_id: e.target.value })}
              />
            )}
            {(form.channel === 'sms' || form.channel === 'whatsapp') && (
              <TextField
                label="Recipient timezone (TCPA)"
                value={form.recipient_timezone}
                onChange={(e) => setForm({ ...form, recipient_timezone: e.target.value })}
                helperText="e.g. America/New_York"
              />
            )}
            <Button variant="contained" onClick={send} disabled={!form.to || !form.body}>Send</Button>
          </Stack>
        </Paper>
      )}

      {tab === 'log' && (
        <>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Select size="small" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value as any)} displayEmpty>
              <MenuItem value="">All channels</MenuItem>
              <MenuItem value="sms">SMS</MenuItem>
              <MenuItem value="whatsapp">WhatsApp</MenuItem>
              <MenuItem value="push">Push</MenuItem>
            </Select>
          </Stack>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell>
                  <TableCell>Channel</TableCell>
                  <TableCell>To</TableCell>
                  <TableCell>Body</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {messages.map((m) => (
                  <TableRow key={m.id} hover>
                    <TableCell>{new Date(m.created_at).toLocaleString()}</TableCell>
                    <TableCell><Chip size="small" label={m.channel} /></TableCell>
                    <TableCell>{m.to_address}</TableCell>
                    <TableCell sx={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.body}</TableCell>
                    <TableCell><Chip size="small" label={m.status} color={STATUS_COLORS[m.status] ?? 'default'} /></TableCell>
                  </TableRow>
                ))}
                {messages.length === 0 && (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 4 }}>No messages sent.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {tab === 'suppressions' && (
        <>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
            <Button variant="contained" onClick={() => setSuppressOpen(true)}>Add suppression</Button>
          </Stack>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Suppressed</TableCell>
                  <TableCell>Channel</TableCell>
                  <TableCell>Address</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {suppressions.map((s) => (
                  <TableRow key={s.id} hover>
                    <TableCell>{new Date(s.suppressed_at).toLocaleString()}</TableCell>
                    <TableCell><Chip size="small" label={s.channel} /></TableCell>
                    <TableCell>{s.address}</TableCell>
                    <TableCell>{s.reason ?? '—'}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => unsuppress(s)}>Remove</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {suppressions.length === 0 && (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 4 }}>No suppressions.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      <Dialog open={suppressOpen} onClose={() => setSuppressOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add suppression</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Select value={suppressForm.channel} onChange={(e) => setSuppressForm({ ...suppressForm, channel: e.target.value as MessagingChannel })}>
              <MenuItem value="sms">SMS</MenuItem>
              <MenuItem value="whatsapp">WhatsApp</MenuItem>
              <MenuItem value="push">Push</MenuItem>
            </Select>
            <TextField label="Address" value={suppressForm.address} onChange={(e) => setSuppressForm({ ...suppressForm, address: e.target.value })} />
            <TextField label="Reason" value={suppressForm.reason} onChange={(e) => setSuppressForm({ ...suppressForm, reason: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuppressOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={suppress} disabled={!suppressForm.address}>Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
