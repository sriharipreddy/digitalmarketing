import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Link,
} from '@mui/material';
import { api } from '@/lib/api';

type Status = 'idle' | 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }
    setStatus('verifying');
    api
      .post('/core/auth/verify-email', { token })
      .then((res) => {
        setStatus('success');
        setMessage(`Verified ${res.data?.data?.email ?? 'your email'}. You can now sign in.`);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.error?.message ?? 'Could not verify this link.');
      });
  }, [params]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ width: 440 }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom>
            Email verification
          </Typography>

          {status === 'verifying' && (
            <Box sx={{ py: 4 }}>
              <CircularProgress />
              <Typography variant="body2" sx={{ mt: 2 }}>
                Checking your link…
              </Typography>
            </Box>
          )}

          {status === 'success' && (
            <>
              <Alert severity="success" sx={{ my: 2 }}>
                {message}
              </Alert>
              <Button variant="contained" onClick={() => navigate('/login')}>
                Continue to sign in
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <Alert severity="error" sx={{ my: 2 }}>
                {message}
              </Alert>
              <Typography variant="body2" color="text.secondary">
                Need a new link?{' '}
                <Link component={RouterLink} to="/login">
                  Sign in
                </Link>{' '}
                and request another from the prompt.
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
