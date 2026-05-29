import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Button,
} from '@mui/material';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { workspaceApi, type AuditEntry } from '@/lib/workspace-api';

const PAGE_SIZE = 25;

export default function AuditLog() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    workspaceApi
      .listAudit(active.id, { limit: PAGE_SIZE, offset })
      .then((r) => {
        setEntries(r.data.data.rows);
        setTotal(r.data.data.total);
      })
      .finally(() => setLoading(false));
  }, [active, offset]);

  if (loading && entries.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Audit log
      </Typography>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Target</TableCell>
              <TableCell>Actor</TableCell>
              <TableCell>Request</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{new Date(e.createdAt).toLocaleString()}</TableCell>
                <TableCell>
                  <Chip label={e.action} size="small" />
                </TableCell>
                <TableCell>
                  {e.target_type ? `${e.target_type}:${(e.target_id ?? '').slice(0, 8)}…` : '—'}
                </TableCell>
                <TableCell>{(e.actor_user_id ?? '').slice(0, 8) || '—'}</TableCell>
                <TableCell>
                  <code style={{ fontSize: 11 }}>{(e.request_id ?? '').slice(0, 16)}</code>
                </TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    No audit events yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Stack direction="row" spacing={2} sx={{ mt: 2 }} justifyContent="space-between" alignItems="center">
        <Typography variant="body2" color="text.secondary">
          {total === 0
            ? '0 events'
            : `Showing ${offset + 1}-${Math.min(offset + entries.length, total)} of ${total}`}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
            Previous
          </Button>
          <Button
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
