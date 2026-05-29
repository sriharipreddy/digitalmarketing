import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  TextField,
  Alert,
  Divider,
  Chip,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { api } from '@/lib/api';

type EnrollState =
  | { kind: 'idle' }
  | { kind: 'enrolling'; secret: string; qrDataUrl: string }
  | { kind: 'enabled' };

export default function ProfileSecurity() {
  const { enqueueSnackbar } = useSnackbar();
  const [state, setState] = useState<EnrollState>({ kind: 'idle' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const begin = async () => {
    setBusy(true);
    try {
      const res = await api.post('/core/users/me/2fa/begin');
      const d = res.data.data;
      setState({ kind: 'enrolling', secret: d.secret, qrDataUrl: d.qr_data_url });
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await api.post('/core/users/me/2fa/confirm', { code });
      setState({ kind: 'enabled' });
      setCode('');
      enqueueSnackbar('2FA enabled', { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Invalid code', { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await api.post('/core/users/me/2fa/disable', { code });
      setState({ kind: 'idle' });
      setCode('');
      enqueueSnackbar('2FA disabled', { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Invalid code', { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Security
      </Typography>
      <Paper sx={{ p: 3, maxWidth: 720 }}>
        <Stack spacing={3}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography variant="h6">Two-factor authentication</Typography>
              {state.kind === 'enabled' && <Chip label="enabled" color="success" size="small" />}
              {state.kind === 'idle' && <Chip label="not enabled" size="small" />}
              {state.kind === 'enrolling' && <Chip label="setup in progress" color="warning" size="small" />}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Use an authenticator app (1Password, Google Authenticator, Authy) to generate one-time
              codes when signing in.
            </Typography>
          </Box>

          <Divider />

          {state.kind === 'idle' && (
            <Box>
              <Button variant="contained" onClick={begin} disabled={busy}>
                Set up two-factor
              </Button>
            </Box>
          )}

          {state.kind === 'enrolling' && (
            <Stack spacing={2}>
              <Alert severity="info">
                Scan this QR with your authenticator app, then enter the 6-digit code it generates.
              </Alert>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <img src={state.qrDataUrl} alt="2FA QR code" width={220} height={220} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Or enter the secret manually:
                </Typography>
                <code
                  style={{
                    display: 'block',
                    background: '#f4f4f4',
                    padding: '8px 12px',
                    borderRadius: 4,
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                  }}
                >
                  {state.secret}
                </code>
              </Box>
              <TextField
                label="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }}
                fullWidth
              />
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={confirm} disabled={busy || code.length !== 6}>
                  Enable 2FA
                </Button>
                <Button onClick={() => setState({ kind: 'idle' })} disabled={busy}>
                  Cancel
                </Button>
              </Stack>
            </Stack>
          )}

          {state.kind === 'enabled' && (
            <Stack spacing={2}>
              <Alert severity="success">
                Two-factor is on. You'll be asked for a code at next sign-in.
              </Alert>
              <TextField
                label="Enter current 6-digit code to disable"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }}
                fullWidth
              />
              <Box>
                <Button color="error" variant="outlined" onClick={disable} disabled={busy || code.length !== 6}>
                  Disable 2FA
                </Button>
              </Box>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
