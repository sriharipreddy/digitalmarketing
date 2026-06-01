import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, Link, CircularProgress } from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSnackbar } from 'notistack';
import { api } from '@/lib/api';
import { setSession } from '@/store';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});
type LoginInput = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const [twoFa, setTwoFa] = useState<{ challenge_token: string; email: string } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');

  const onSubmit = async (data: LoginInput) => {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await api.post('/core/auth/login', data);
      const payload = res.data?.data;
      if (payload?.requires_2fa) {
        setTwoFa({ challenge_token: payload.challenge_token, email: payload.user.email });
        return;
      }
      dispatch(
        setSession({
          accessToken: payload.access_token,
          user: payload.user,
          workspace: payload.workspace,
        }),
      );
      enqueueSnackbar(`Welcome back, ${payload.user.full_name}`, { variant: 'success' });
      navigate('/app');
    } catch (err: any) {
      const errCode = err.response?.data?.error?.code;
      if (errCode === 'email_not_verified') {
        setServerError('Please verify your email first. Check your inbox for the link.');
      } else {
        setServerError(err.response?.data?.error?.message ?? 'Login failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onTwoFaSubmit = async () => {
    if (!twoFa) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await api.post('/core/auth/2fa/verify', {
        challenge_token: twoFa.challenge_token,
        code: twoFaCode,
      });
      const payload = res.data?.data;
      dispatch(
        setSession({
          accessToken: payload.access_token,
          user: payload.user,
          workspace: payload.workspace,
        }),
      );
      enqueueSnackbar(`Welcome back, ${payload.user.full_name}`, { variant: 'success' });
      navigate('/app');
    } catch (err: any) {
      setServerError(err.response?.data?.error?.message ?? 'Invalid code');
    } finally {
      setSubmitting(false);
    }
  };

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
      <Card sx={{ width: 420 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h2" gutterBottom>
            Sign in
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Welcome back to the Marketing Platform
          </Typography>

          {serverError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {serverError}
            </Alert>
          )}

          {twoFa ? (
            <Box>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Enter the 6-digit code from your authenticator app for <strong>{twoFa.email}</strong>.
              </Typography>
              <TextField
                fullWidth
                label="6-digit code"
                margin="normal"
                autoFocus
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }}
              />
              <Button
                fullWidth
                variant="contained"
                size="large"
                disabled={submitting || twoFaCode.length !== 6}
                onClick={onTwoFaSubmit}
                sx={{ mt: 2 }}
              >
                {submitting ? <CircularProgress size={24} color="inherit" /> : 'Verify and sign in'}
              </Button>
              <Button
                fullWidth
                size="small"
                onClick={() => {
                  setTwoFa(null);
                  setTwoFaCode('');
                  setServerError(null);
                }}
                sx={{ mt: 1 }}
              >
                Cancel
              </Button>
            </Box>
          ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              fullWidth
              label="Email"
              type="email"
              margin="normal"
              autoComplete="email"
              autoFocus
              {...register('email')}
              error={!!errors.email}
              helperText={errors.email?.message}
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              margin="normal"
              autoComplete="current-password"
              {...register('password')}
              error={!!errors.password}
              helperText={errors.password?.message}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={submitting}
              sx={{ mt: 3 }}
            >
              {submitting ? <CircularProgress size={24} color="inherit" /> : 'Sign in'}
            </Button>
          </form>
          )}

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No account?{' '}
              <Link component={RouterLink} to="/register">
                Register
              </Link>
            </Typography>
          </Box>

          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" component="div">
              <strong>Dev login:</strong>
              <br />
              admin@yourplatform.local / AdminDev1234!
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
