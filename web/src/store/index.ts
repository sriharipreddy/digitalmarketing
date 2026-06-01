import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { JwtPayload } from '@marketing/shared-types';
import type { Membership } from '@/lib/workspace-api';

interface ActiveWorkspace {
  id: string;
  name: string;
  status: string;
}

interface AuthState {
  user: JwtPayload | null;
  accessToken: string | null;
  workspace: ActiveWorkspace | null;
  memberships: Membership[];
}

const STORAGE_KEY = 'mkt.auth.v1';

/**
 * Restore session from localStorage so a hard refresh doesn't bounce the user
 * back to /login. We persist only what's needed to rebuild the in-memory store
 * (user, accessToken, workspace); memberships are re-fetched by DashboardLayout
 * on mount, so they don't need to round-trip storage.
 *
 * If the access token is past its `exp`, drop it — the request interceptor
 * would otherwise send a guaranteed-401 on the first call, just to clear it.
 */
function loadPersistedState(): AuthState {
  const empty: AuthState = { user: null, accessToken: null, workspace: null, memberships: [] };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    if (!parsed.accessToken || !parsed.user) return empty;
    if (isJwtExpired(parsed.accessToken)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return empty;
    }
    return {
      user: parsed.user as JwtPayload,
      accessToken: parsed.accessToken,
      workspace: parsed.workspace ?? null,
      memberships: [],
    };
  } catch {
    return empty;
  }
}

function isJwtExpired(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return true;
  try {
    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp !== 'number') return false; // no exp claim → treat as live
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: loadPersistedState(),
  reducers: {
    setSession(
      state,
      action: PayloadAction<{ user: JwtPayload; accessToken: string; workspace: ActiveWorkspace | null }>,
    ) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.workspace = action.payload.workspace;
    },
    setMemberships(state, action: PayloadAction<Membership[]>) {
      state.memberships = action.payload;
    },
    setActiveWorkspace(state, action: PayloadAction<ActiveWorkspace>) {
      state.workspace = action.payload;
    },
    clearSession(state) {
      state.user = null;
      state.accessToken = null;
      state.workspace = null;
      state.memberships = [];
    },
  },
});

export const { setSession, setMemberships, setActiveWorkspace, clearSession } = authSlice.actions;

export const store = configureStore({
  reducer: { auth: authSlice.reducer },
});

// Persist auth on every change. Memberships are intentionally excluded — they
// rehydrate from the server on mount and storing them would just bloat the row.
store.subscribe(() => {
  if (typeof window === 'undefined') return;
  const { user, accessToken, workspace } = store.getState().auth;
  try {
    if (!user || !accessToken) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, accessToken, workspace }));
    }
  } catch {
    /* quota / private-mode — ignore */
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
