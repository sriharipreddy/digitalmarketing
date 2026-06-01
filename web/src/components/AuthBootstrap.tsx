import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, CircularProgress } from '@mui/material';
import { api } from '@/lib/api';
import { clearSession, setSession, type RootState } from '@/store';

/**
 * Runs once on app boot before the router renders.
 *
 *  1. If we already have a token in the store (rehydrated from localStorage),
 *     verify it with /users/me. Stale token → clear and let RequireAuth bounce.
 *  2. If we have NO token but the browser still holds the httpOnly refresh
 *     cookie, swap it for a fresh access token, then load /users/me.
 *  3. Either way, keep a tiny loading splash up until the verdict is in so
 *     RequireAuth doesn't redirect the user to /login a frame too early.
 */
export default function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        if (accessToken) {
          // Validate the rehydrated token against the server.
          const me = await api.get('/core/users/me');
          if (cancelled) return;
          const user = me.data?.data?.user;
          if (user) {
            // Token survived — only refresh the user payload; keep workspace as-is.
            dispatch(setSession({
              accessToken,
              user,
              workspace: null, // DashboardLayout's effect repopulates from memberships
            }));
          }
        } else {
          // No token in memory — try to swap the refresh-token cookie for a new one.
          const refreshed = await api.post('/core/auth/refresh-token');
          if (cancelled) return;
          const newToken = refreshed.data?.data?.access_token;
          if (newToken) {
            // Temporarily seed the token so the next request includes the header.
            dispatch(setSession({
              accessToken: newToken,
              user: { id: 'pending' } as any, // overwritten by /users/me below
              workspace: null,
            }));
            const me = await api.get('/core/users/me');
            const user = me.data?.data?.user;
            if (user) {
              dispatch(setSession({ accessToken: newToken, user, workspace: null }));
            } else {
              dispatch(clearSession());
            }
          }
        }
      } catch {
        // No valid session — fall through, RequireAuth will bounce to /login.
        if (!cancelled) dispatch(clearSession());
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  return <>{children}</>;
}
