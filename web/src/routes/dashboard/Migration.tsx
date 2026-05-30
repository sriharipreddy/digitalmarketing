import { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Stack, Button, TextField, Chip, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, Tabs, Tab, Alert, IconButton, LinearProgress,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import {
  integrationApi,
  type DataImport,
  type DataExport,
  type ImportSource,
} from '@/lib/integration-api';

const SOURCE_LABEL: Record<ImportSource, string> = {
  csv: 'CSV upload',
  hubspot: 'HubSpot',
  mailchimp: 'Mailchimp',
  klaviyo: 'Klaviyo',
};

const STATUS_COLORS: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'default',
  mapping: 'default',
  processing: 'info',
  completed: 'success',
  failed: 'error',
  building: 'info',
  ready: 'success',
  expired: 'warning',
};

export default function Migration() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const { enqueueSnackbar } = useSnackbar();

  const [tab, setTab] = useState<'imports' | 'exports'>('imports');
  const [loading, setLoading] = useState(true);
  const [imports, setImports] = useState<DataImport[]>([]);
  const [exports, setExports] = useState<DataExport[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{ source: ImportSource }>({ source: 'csv' });

  const [runOpen, setRunOpen] = useState<DataImport | null>(null);
  const [runForm, setRunForm] = useState({
    csv_body: '',
    access_token: '',
    api_key: '',
    dc: '',
    audience_id: '',
    column_mapping: '{"email":"email","first_name":"first_name","last_name":"last_name"}',
    use_stub: false,
  });

  const [dsarOpen, setDsarOpen] = useState(false);
  const [dsarForm, setDsarForm] = useState({ subject_email: '' });

  const [viewDsar, setViewDsar] = useState<DataExport | null>(null);

  const refresh = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const [i, e] = await Promise.all([
        integrationApi.listImports(active.id),
        integrationApi.listExports(active.id),
      ]);
      setImports(i.data.data.imports);
      setExports(e.data.data.exports);
    } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [active?.id]);

  const createImport = async () => {
    if (!active) return;
    try {
      const r = await integrationApi.createImport(active.id, { source: createForm.source, entity: 'contacts' });
      setCreateOpen(false);
      void refresh();
      setRunOpen(r.data.data.import);
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const runImport = async () => {
    if (!active || !runOpen) return;
    try {
      let columnMapping: Record<string, string> | undefined;
      if (runOpen.source === 'csv') {
        try { columnMapping = JSON.parse(runForm.column_mapping); }
        catch { enqueueSnackbar('Invalid column_mapping JSON', { variant: 'error' }); return; }
      }
      const body = {
        csv_body: runOpen.source === 'csv' ? runForm.csv_body : undefined,
        column_mapping: columnMapping,
        access_token: runOpen.source === 'hubspot' ? runForm.access_token || undefined : undefined,
        api_key: (runOpen.source === 'mailchimp' || runOpen.source === 'klaviyo') ? runForm.api_key || undefined : undefined,
        audience_id: runOpen.source === 'mailchimp' ? runForm.audience_id || undefined : undefined,
        dc: runOpen.source === 'mailchimp' ? runForm.dc || undefined : undefined,
        use_stub: runForm.use_stub || undefined,
      };
      const r = await integrationApi.runImport(active.id, runOpen.id, body);
      enqueueSnackbar(`Processed ${r.data.data.processed} (ok ${r.data.data.succeeded} / fail ${r.data.data.failed})`, { variant: 'success' });
      setRunOpen(null);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const createDsar = async () => {
    if (!active) return;
    try {
      await integrationApi.createDsar(active.id, { subject_email: dsarForm.subject_email });
      setDsarOpen(false);
      setDsarForm({ subject_email: '' });
      enqueueSnackbar('DSAR export queued', { variant: 'success' });
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Data Migration</Typography>
        <IconButton size="small" onClick={refresh}><RefreshIcon /></IconButton>
      </Stack>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab value="imports" label={`Imports (${imports.length})`} />
          <Tab value="exports" label={`Exports / DSAR (${exports.length})`} />
        </Tabs>
      </Paper>

      {tab === 'imports' && (
        <>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
            <Button variant="contained" onClick={() => setCreateOpen(true)}>New import</Button>
          </Stack>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Created</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Entity</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Rows</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {imports.map((i) => {
                  const pct = i.total_rows > 0 ? Math.round((i.processed_rows / i.total_rows) * 100) : 0;
                  return (
                    <TableRow key={i.id} hover>
                      <TableCell>{new Date(i.created_at).toLocaleString()}</TableCell>
                      <TableCell>{SOURCE_LABEL[i.source]}</TableCell>
                      <TableCell>{i.entity}</TableCell>
                      <TableCell><Chip size="small" label={i.status} color={STATUS_COLORS[i.status] ?? 'default'} /></TableCell>
                      <TableCell align="right">{i.processed_rows} / {i.total_rows}</TableCell>
                      <TableCell sx={{ minWidth: 140 }}>
                        {i.status === 'processing' ? <LinearProgress variant="determinate" value={pct} /> : <Typography variant="caption">{i.succeeded_rows} ok · {i.failed_rows} fail</Typography>}
                      </TableCell>
                      <TableCell align="right">
                        {i.status === 'pending' && (
                          <Button size="small" onClick={() => setRunOpen(i)}>Run</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {imports.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 4 }}>No imports yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {tab === 'exports' && (
        <>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
            <Button variant="contained" onClick={() => setDsarOpen(true)}>New DSAR export</Button>
          </Stack>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Created</TableCell>
                  <TableCell>Kind</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Expires</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {exports.map((ex) => (
                  <TableRow key={ex.id} hover>
                    <TableCell>{new Date(ex.created_at).toLocaleString()}</TableCell>
                    <TableCell><Chip size="small" label={ex.kind} /></TableCell>
                    <TableCell>{ex.subject_email ?? ex.subject_user_id ?? '—'}</TableCell>
                    <TableCell><Chip size="small" label={ex.status} color={STATUS_COLORS[ex.status] ?? 'default'} /></TableCell>
                    <TableCell>{ex.expires_at ? new Date(ex.expires_at).toLocaleString() : '—'}</TableCell>
                    <TableCell align="right">
                      {ex.status === 'ready' && <Button size="small" onClick={() => setViewDsar(ex)}>View</Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {exports.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 4 }}>No exports yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New import</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Select value={createForm.source} onChange={(e) => setCreateForm({ source: e.target.value as ImportSource })}>
              <MenuItem value="csv">CSV upload</MenuItem>
              <MenuItem value="hubspot">HubSpot</MenuItem>
              <MenuItem value="mailchimp">Mailchimp</MenuItem>
              <MenuItem value="klaviyo">Klaviyo</MenuItem>
            </Select>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createImport}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!runOpen} onClose={() => setRunOpen(null)} fullWidth maxWidth="md">
        <DialogTitle>Run {runOpen ? SOURCE_LABEL[runOpen.source] : ''} import</DialogTitle>
        <DialogContent>
          {runOpen && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="info">
                For dev / sandbox, tick "Use stub driver" to verify the pipeline without real credentials. Stub generates 5 fake contacts.
              </Alert>
              <Stack direction="row" spacing={1} alignItems="center">
                <input
                  type="checkbox"
                  checked={runForm.use_stub}
                  onChange={(e) => setRunForm({ ...runForm, use_stub: e.target.checked })}
                />
                <Typography variant="body2">Use stub driver (skip real credentials)</Typography>
              </Stack>
              {runOpen.source === 'csv' && !runForm.use_stub && (
                <>
                  <TextField
                    label="CSV body (first row = header)"
                    multiline minRows={6}
                    value={runForm.csv_body}
                    onChange={(e) => setRunForm({ ...runForm, csv_body: e.target.value })}
                    placeholder={'email,first_name,last_name\nfoo@example.com,Foo,Bar'}
                  />
                  <TextField
                    label="Column mapping (JSON)"
                    multiline minRows={3}
                    value={runForm.column_mapping}
                    onChange={(e) => setRunForm({ ...runForm, column_mapping: e.target.value })}
                  />
                </>
              )}
              {runOpen.source === 'hubspot' && !runForm.use_stub && (
                <TextField label="HubSpot access token" value={runForm.access_token} onChange={(e) => setRunForm({ ...runForm, access_token: e.target.value })} />
              )}
              {runOpen.source === 'mailchimp' && !runForm.use_stub && (
                <>
                  <TextField label="Mailchimp API key" value={runForm.api_key} onChange={(e) => setRunForm({ ...runForm, api_key: e.target.value })} />
                  <TextField label="Data center (e.g. us21)" value={runForm.dc} onChange={(e) => setRunForm({ ...runForm, dc: e.target.value })} />
                  <TextField label="Audience id" value={runForm.audience_id} onChange={(e) => setRunForm({ ...runForm, audience_id: e.target.value })} />
                </>
              )}
              {runOpen.source === 'klaviyo' && !runForm.use_stub && (
                <TextField label="Klaviyo API key" value={runForm.api_key} onChange={(e) => setRunForm({ ...runForm, api_key: e.target.value })} />
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRunOpen(null)}>Cancel</Button>
          <Button variant="contained" onClick={runImport}>Run import</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dsarOpen} onClose={() => setDsarOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Build DSAR export</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              Builds a JSON dossier of every record we hold about the subject email. Required for GDPR Article 15 (right of access).
            </Alert>
            <TextField label="Subject email" value={dsarForm.subject_email} onChange={(e) => setDsarForm({ subject_email: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDsarOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createDsar} disabled={!dsarForm.subject_email}>Build</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!viewDsar} onClose={() => setViewDsar(null)} fullWidth maxWidth="lg">
        <DialogTitle>DSAR manifest</DialogTitle>
        <DialogContent>
          {viewDsar && (
            <Box component="pre" sx={{
              p: 2, bgcolor: 'grey.100', borderRadius: 1, fontFamily: 'monospace', fontSize: 12,
              maxHeight: 600, overflow: 'auto',
            }}>
              {JSON.stringify(viewDsar.manifest, null, 2)}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDsar(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
