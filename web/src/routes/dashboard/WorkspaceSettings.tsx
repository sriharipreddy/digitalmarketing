import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Chip,
  CircularProgress,
  Divider,
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import { setActiveWorkspace } from '@/store';
import { workspaceApi, type WorkspaceSummary } from '@/lib/workspace-api';

export default function WorkspaceSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useDispatch();
  const active = useSelector((s: RootState) => s.auth.workspace);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [role, setRole] = useState<string>('');
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    workspaceApi
      .get(active.id)
      .then((r) => {
        const w = r.data.data.workspace;
        setWorkspace(w);
        setRole(r.data.data.role);
        setName(w.name);
        setTimezone(w.timezone ?? '');
        setIndustry(w.industry ?? '');
        setCountry(w.country ?? '');
      })
      .finally(() => setLoading(false));
  }, [active]);

  const canEdit = role === 'owner' || role === 'editor';

  const onSave = async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      const r = await workspaceApi.update(workspace.id, {
        name: name.trim() || undefined,
        timezone: timezone || undefined,
        industry: industry || undefined,
        country: country ? country.toUpperCase() : undefined,
      });
      setWorkspace(r.data.data.workspace);
      dispatch(
        setActiveWorkspace({
          id: r.data.data.workspace.id,
          name: r.data.data.workspace.name,
          status: r.data.data.workspace.status,
        }),
      );
      enqueueSnackbar('Settings saved', { variant: 'success' });
    } catch (e: any) {
      const msg = e.response?.data?.error?.message ?? 'Failed to save';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !workspace) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Workspace settings
      </Typography>
      <Paper sx={{ p: 3, maxWidth: 720 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={workspace.status} size="small" color={workspace.status === 'trial' ? 'warning' : 'success'} />
            <Chip label={`Your role: ${role}`} size="small" variant="outlined" />
            <Chip label={`Region: ${workspace.region}`} size="small" variant="outlined" />
          </Stack>

          <Divider />

          <TextField
            label="Workspace name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            fullWidth
          />
          <TextField
            label="Timezone (IANA)"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="e.g. America/New_York"
            disabled={!canEdit}
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              disabled={!canEdit}
              fullWidth
            />
            <TextField
              label="Country (ISO 2-letter)"
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              inputProps={{ maxLength: 2 }}
              disabled={!canEdit}
              sx={{ width: 220 }}
            />
          </Stack>

          {canEdit ? (
            <Box>
              <Button variant="contained" onClick={onSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Only workspace owners and editors can change these settings.
            </Typography>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
