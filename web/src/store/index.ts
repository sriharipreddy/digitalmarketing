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

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    accessToken: null,
    workspace: null,
    memberships: [],
  } as AuthState,
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

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
