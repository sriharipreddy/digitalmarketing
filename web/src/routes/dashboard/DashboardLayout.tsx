import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Avatar,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  Divider,
  ListSubheader,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import type { RootState } from '@/store';
import { clearSession, setMemberships, setActiveWorkspace } from '@/store';
import { api } from '@/lib/api';
import { workspaceApi } from '@/lib/workspace-api';
import NotificationBell from '@/components/NotificationBell';
import { useSnackbar } from 'notistack';

const drawerWidth = 240;

const modules = [
  { label: 'Overview', path: '/dashboard' },
  { label: 'One-Click', path: '/dashboard/one-click' },
  { label: 'SEO', path: '/dashboard/seo' },
  { label: 'Local SEO', path: '/dashboard/local-seo' },
  { label: 'Campaigns', path: '/dashboard/campaigns' },
  { label: 'Content', path: '/dashboard/content' },
  { label: 'Library', path: '/dashboard/content/library' },
  { label: 'Email', path: '/dashboard/email' },
  { label: 'Messaging', path: '/dashboard/messaging' },
  { label: 'Social', path: '/dashboard/social' },
  { label: 'CRM', path: '/dashboard/crm' },
  { label: 'Analytics', path: '/dashboard/analytics' },
  { label: 'Media', path: '/dashboard/media' },
  { label: 'Influencer', path: '/dashboard/influencer' },
  { label: 'Intelligence', path: '/dashboard/intelligence' },
  { label: 'Affiliate', path: '/dashboard/affiliate' },
  { label: 'Notifications', path: '/dashboard/notifications' },
  { label: 'Integrations', path: '/dashboard/integrations' },
  { label: 'Migration', path: '/dashboard/migration' },
];

const workspaceMenu = [
  { label: 'Settings', path: '/dashboard/workspace/settings' },
  { label: 'Members', path: '/dashboard/workspace/members' },
  { label: 'Billing', path: '/dashboard/workspace/billing' },
  { label: 'Audit log', path: '/dashboard/workspace/audit-log' },
];

const profileMenu = [
  { label: 'Security', path: '/dashboard/profile/security' },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const user = useSelector((s: RootState) => s.auth.user);
  const workspace = useSelector((s: RootState) => s.auth.workspace);
  const memberships = useSelector((s: RootState) => s.auth.memberships);

  useEffect(() => {
    workspaceApi
      .listMemberships()
      .then((r) => {
        const list = r.data.data.memberships;
        dispatch(setMemberships(list));
        if (!workspace && list.length > 0) {
          const first = list[0]!;
          dispatch(
            setActiveWorkspace({ id: first.workspace.id, name: first.workspace.name, status: first.workspace.status }),
          );
        }
      })
      .catch(() => {
        /* 401 already handled by interceptor */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/core/auth/logout');
    } catch {
      /* ignore */
    }
    dispatch(clearSession());
    enqueueSnackbar('Signed out', { variant: 'info' });
    navigate('/login');
  };

  const handleSwitch = (id: string) => {
    const m = memberships.find((m) => m.workspace.id === id);
    if (!m) return;
    dispatch(setActiveWorkspace({ id: m.workspace.id, name: m.workspace.name, status: m.workspace.status }));
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ width: `calc(100% - ${drawerWidth}px)`, ml: `${drawerWidth}px` }}>
        <Toolbar>
          {memberships.length > 1 ? (
            <Select
              size="small"
              value={workspace?.id ?? ''}
              onChange={(e) => handleSwitch(e.target.value as string)}
              sx={{
                color: 'inherit',
                bgcolor: 'rgba(255,255,255,0.1)',
                '& .MuiSelect-icon': { color: 'inherit' },
                mr: 2,
                minWidth: 200,
              }}
            >
              {memberships.map((m) => (
                <MenuItem key={m.workspace.id} value={m.workspace.id}>
                  {m.workspace.name}
                </MenuItem>
              ))}
            </Select>
          ) : (
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              {workspace?.name ?? 'Marketing Platform'}
            </Typography>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <NotificationBell />
          <Tooltip title={user?.email ?? ''}>
            <Avatar sx={{ bgcolor: 'secondary.main', mr: 1, width: 32, height: 32, fontSize: 14 }}>
              {(user?.name ?? 'U').slice(0, 1)}
            </Avatar>
          </Tooltip>
          <Tooltip title="Sign out">
            <IconButton color="inherit" onClick={handleLogout} size="small">
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            mkt
          </Typography>
        </Toolbar>
        <List>
          {modules.map((m) => (
            <ListItemButton
              key={m.path}
              selected={location.pathname === m.path}
              onClick={() => navigate(m.path)}
            >
              <ListItemText primary={m.label} />
            </ListItemButton>
          ))}
          <Divider sx={{ my: 1 }} />
          <ListSubheader sx={{ bgcolor: 'transparent' }}>Workspace</ListSubheader>
          {workspaceMenu.map((m) => (
            <ListItemButton
              key={m.path}
              selected={location.pathname === m.path}
              onClick={() => navigate(m.path)}
            >
              <ListItemText primary={m.label} />
            </ListItemButton>
          ))}
          <Divider sx={{ my: 1 }} />
          <ListSubheader sx={{ bgcolor: 'transparent' }}>Profile</ListSubheader>
          {profileMenu.map((m) => (
            <ListItemButton
              key={m.path}
              selected={location.pathname === m.path}
              onClick={() => navigate(m.path)}
            >
              <ListItemText primary={m.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
