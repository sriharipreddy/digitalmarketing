import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Grid, Skeleton, Alert } from '@mui/material';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { api } from '@/lib/api';

interface MeResponse {
  user: { id: string; name: string; email: string; type: string };
  workspace_id?: string;
}

export default function DashboardOverview() {
  const user = useSelector((s: RootState) => s.auth.user);
  const workspace = useSelector((s: RootState) => s.auth.workspace);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/core/users/me')
      .then((res) => setMe(res.data.data))
      .catch((err) => setError(err.response?.data?.error?.message ?? 'Failed to load'));
  }, []);

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        Welcome, {user?.name?.split(' ')[0] ?? 'there'} 👋
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {workspace ? `${workspace.name} • ${workspace.status}` : 'No workspace yet — create one to get started'}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Visitors (30d)
              </Typography>
              <Typography variant="h3">—</Typography>
              <Typography variant="caption" color="text.secondary">
                Analytics not yet connected
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Leads (30d)
              </Typography>
              <Typography variant="h3">—</Typography>
              <Typography variant="caption" color="text.secondary">
                CRM not yet implemented
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Active campaigns
              </Typography>
              <Typography variant="h3">0</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Status
              </Typography>
              <Typography variant="h3" color="success.main">
                Live
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h3" gutterBottom>
                Phase 0 — foundation live
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                The platform skeleton is up. marketing-core is responding. Frontend is connected.
              </Typography>
              <Typography variant="body2" component="div">
                Next steps:
                <ul>
                  <li>Implement workspace + member management endpoints</li>
                  <li>Add email verification flow</li>
                  <li>Wire 2FA</li>
                  <li>Build out the other 13 services per the build plan</li>
                </ul>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h3" gutterBottom>
                Connection check
              </Typography>
              {me ? (
                <Box sx={{ fontFamily: 'monospace', fontSize: 12, mt: 1 }}>
                  <div>id: {me.user.id.slice(0, 8)}…</div>
                  <div>type: {me.user.type}</div>
                  <div>workspace_id: {me.workspace_id ? me.workspace_id.slice(0, 8) + '…' : '(none)'}</div>
                </Box>
              ) : (
                <Skeleton variant="rounded" height={80} />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
