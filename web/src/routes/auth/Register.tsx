import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, Link, CircularProgress } from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSnackbar } from 'notistack';
import { api } from '@/lib/api';

const registerSchema = z.object({
  full_name: z.string().min(2, 'Name too short'),
  email: z.string().email(),
  password: z.string().min(12, 'Minimum 12 characters'),
  workspace_name: z.string().min(2, 'Workspace name too short'),
});
type RegisterInput = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    setSubmitting(true);
    setServerError(null);
    try {
      await api.post('/core/auth/register', data);
      enqueueSnackbar('Account created. Please sign in.', { variant: 'success' });
      navigate('/login');
    } catch (err: any) {
      setServerError(err.response?.data?.error?.message ?? 'Registration failed');
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
      <Card sx={{ width: 480 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h2" gutterBottom>
            Create your account
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            14-day free trial. No credit card required.
          </Typography>

          {serverError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {serverError}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              fullWidth
              label="Full name"
              margin="normal"
              autoComplete="name"
              {...register('full_name')}
              error={!!errors.full_name}
              helperText={errors.full_name?.message}
            />
            <TextField
              fullWidth
              label="Work email"
              type="email"
              margin="normal"
              autoComplete="email"
              {...register('email')}
              error={!!errors.email}
              helperText={errors.email?.message}
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              margin="normal"
              autoComplete="new-password"
              {...register('password')}
              error={!!errors.password}
              helperText={errors.password?.message ?? 'Minimum 12 characters'}
            />
            <TextField
              fullWidth
              label="Business name"
              margin="normal"
              {...register('workspace_name')}
              error={!!errors.workspace_name}
              helperText={errors.workspace_name?.message ?? 'This becomes your workspace name'}
            />

            <Button type="submit" fullWidth variant="contained" size="large" disabled={submitting} sx={{ mt: 3 }}>
              {submitting ? <CircularProgress size={24} color="inherit" /> : 'Create account'}
            </Button>
          </form>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Already have an account?{' '}
              <Link component={RouterLink} to="/login">
                Sign in
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
