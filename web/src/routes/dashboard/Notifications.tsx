import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Chip,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import { notificationApi, type Notification } from '@/lib/notification-api';

const SEVERITY_COLORS: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

export default function Notifications() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [rows, setRows] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const r = await notificationApi.list(active.id, { unread_only: unreadOnly || undefined, limit: 100 });
      setRows(r.data.data.rows);
      setTotal(r.data.data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, unreadOnly]);

  const markAll = async () => {
    if (!active) return;
    try {
      await notificationApi.markAllRead(active.id);
      enqueueSnackbar('All marked read', { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const click = async (n: Notification) => {
    if (!active) return;
    if (!n.read_at) {
      try { await notificationApi.markRead(active.id, n.id); } catch { /* ignore */ }
    }
    if (n.action_url) navigate(n.action_url);
    else void refresh();
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
        <Typography variant="h5">Notifications</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControlLabel
            control={<Switch checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />}
            label="Unread only"
          />
          <Button variant="outlined" onClick={markAll}>Mark all read</Button>
        </Stack>
      </Stack>

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Kind</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Source</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((n) => (
              <TableRow
                key={n.id}
                hover
                onClick={() => click(n)}
                sx={{
                  cursor: 'pointer',
                  bgcolor: n.read_at ? undefined : 'action.hover',
                  borderLeft: 3,
                  borderColor: `${SEVERITY_COLORS[n.severity] ?? 'info'}.main`,
                }}
              >
                <TableCell>{new Date(n.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={n.read_at ? 400 : 600}>
                    {n.title}
                  </Typography>
                  {n.body && (
                    <Typography variant="caption" color="text.secondary">{n.body}</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip label={n.kind} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  <Chip label={n.severity} size="small" color={SEVERITY_COLORS[n.severity] ?? 'default'} />
                </TableCell>
                <TableCell>
                  <Typography variant="caption">{n.from_service}</Typography>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    {unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        Showing {rows.length} of {total}
      </Typography>
    </Box>
  );
}
