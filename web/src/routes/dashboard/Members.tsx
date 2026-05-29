import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  Alert,
  Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import { workspaceApi, type Member } from '@/lib/workspace-api';

type RoleOption = 'editor' | 'analyst' | 'viewer';

export default function Members() {
  const { enqueueSnackbar } = useSnackbar();
  const active = useSelector((s: RootState) => s.auth.workspace);
  const currentUserId = useSelector((s: RootState) => s.auth.user?.id ?? '');

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<string>('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<RoleOption>('editor');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [lastInviteToken, setLastInviteToken] = useState<string | null>(null);

  const refresh = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const [list, ws] = await Promise.all([
        workspaceApi.listMembers(active.id),
        workspaceApi.get(active.id),
      ]);
      setMembers(list.data.data.members);
      setMyRole(ws.data.data.role);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const canInvite = myRole === 'owner' || myRole === 'editor';
  const isOwner = myRole === 'owner';

  const submitInvite = async () => {
    if (!active) return;
    setInviting(true);
    try {
      const r = await workspaceApi.invite(active.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
        full_name: inviteName.trim() || undefined,
      });
      setLastInviteToken(r.data.data.invite_token);
      setInviteEmail('');
      setInviteName('');
      enqueueSnackbar('Invitation created', { variant: 'success' });
      await refresh();
    } catch (e: any) {
      const msg = e.response?.data?.error?.message ?? 'Invite failed';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (member: Member, role: RoleOption) => {
    if (!active) return;
    try {
      await workspaceApi.updateRole(active.id, member.id, role);
      enqueueSnackbar('Role updated', { variant: 'success' });
      await refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const remove = async (member: Member) => {
    if (!active) return;
    if (!confirm(`Remove ${member.user?.email ?? 'this member'}?`)) return;
    try {
      await workspaceApi.removeMember(active.id, member.id);
      enqueueSnackbar('Member removed', { variant: 'success' });
      await refresh();
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
        <Typography variant="h5">Workspace members</Typography>
        {canInvite && (
          <Button variant="contained" onClick={() => setInviteOpen(true)}>
            Invite member
          </Button>
        )}
      </Stack>

      {lastInviteToken && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          onClose={() => setLastInviteToken(null)}
        >
          Invite token (share with the invitee until email-send is wired):{' '}
          <code style={{ wordBreak: 'break-all' }}>{lastInviteToken}</code>
        </Alert>
      )}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Member</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((m) => {
              const isOwnerRow = m.role === 'owner';
              const isSelf = m.user_id === currentUserId;
              return (
                <TableRow key={m.id}>
                  <TableCell>{m.user?.full_name ?? '—'}</TableCell>
                  <TableCell>{m.user?.email ?? '—'}</TableCell>
                  <TableCell>
                    {isOwner && !isOwnerRow ? (
                      <Select
                        size="small"
                        value={m.role}
                        onChange={(e) => changeRole(m, e.target.value as RoleOption)}
                      >
                        <MenuItem value="editor">editor</MenuItem>
                        <MenuItem value="analyst">analyst</MenuItem>
                        <MenuItem value="viewer">viewer</MenuItem>
                      </Select>
                    ) : (
                      <Chip label={m.role} size="small" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={m.status}
                      size="small"
                      color={m.status === 'active' ? 'success' : m.status === 'invited' ? 'warning' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {isOwnerRow ? (
                      <Tooltip title="Workspace owner can't be removed (transfer ownership first)">
                        <span>
                          <IconButton disabled size="small">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    ) : isOwner || isSelf ? (
                      <IconButton size="small" onClick={() => remove(m)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Invite team member</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Full name (optional)"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              fullWidth
            />
            <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as RoleOption)}>
              <MenuItem value="editor">editor — can create content + invite</MenuItem>
              <MenuItem value="analyst">analyst — read + reporting</MenuItem>
              <MenuItem value="viewer">viewer — read-only</MenuItem>
            </Select>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitInvite} disabled={!inviteEmail || inviting}>
            {inviting ? 'Inviting…' : 'Send invite'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
