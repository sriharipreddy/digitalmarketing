import { useEffect, useMemo, useState } from 'react';
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
  ListItemIcon,
  ListItemText,
  Avatar,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  Divider,
  Menu,
  ListSubheader,
  CircularProgress,
  Paper,
  Stack,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/HomeOutlined';
import BoltIcon from '@mui/icons-material/BoltOutlined';
import SearchIcon from '@mui/icons-material/SearchOutlined';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import CampaignIcon from '@mui/icons-material/CampaignOutlined';
import ArticleIcon from '@mui/icons-material/ArticleOutlined';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooksOutlined';
import MailIcon from '@mui/icons-material/MailOutlined';
import SmsIcon from '@mui/icons-material/SmsOutlined';
import ShareIcon from '@mui/icons-material/ShareOutlined';
import PeopleIcon from '@mui/icons-material/PeopleOutlined';
import InsightsIcon from '@mui/icons-material/InsightsOutlined';
import MovieIcon from '@mui/icons-material/MovieOutlined';
import StarIcon from '@mui/icons-material/StarBorderOutlined';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import HandshakeIcon from '@mui/icons-material/HandshakeOutlined';
import NotificationsIcon from '@mui/icons-material/NotificationsNoneOutlined';
import HubIcon from '@mui/icons-material/HubOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHorizOutlined';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import GroupIcon from '@mui/icons-material/GroupOutlined';
import CreditCardIcon from '@mui/icons-material/CreditCardOutlined';
import HistoryIcon from '@mui/icons-material/HistoryOutlined';
import LockIcon from '@mui/icons-material/LockOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import type { RootState } from '@/store';
import { clearSession, setMemberships, setActiveWorkspace } from '@/store';
import { api } from '@/lib/api';
import { workspaceApi } from '@/lib/workspace-api';
import NotificationBell from '@/components/NotificationBell';
import { useSnackbar } from 'notistack';

const drawerWidth = 252;

interface NavItem {
  label: string;
  path: string;
  icon: JSX.Element;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', path: '/app', icon: <HomeIcon fontSize="small" /> },
      { label: 'One-Click', path: '/app/one-click', icon: <BoltIcon fontSize="small" /> },
    ],
  },
  {
    label: 'Acquire',
    items: [
      { label: 'SEO', path: '/app/seo', icon: <SearchIcon fontSize="small" /> },
      { label: 'Local SEO', path: '/app/local-seo', icon: <PlaceIcon fontSize="small" /> },
      { label: 'Campaigns', path: '/app/campaigns', icon: <CampaignIcon fontSize="small" /> },
      { label: 'Content', path: '/app/content', icon: <ArticleIcon fontSize="small" /> },
      { label: 'Library', path: '/app/content/library', icon: <LibraryBooksIcon fontSize="small" /> },
    ],
  },
  {
    label: 'Engage',
    items: [
      { label: 'Email', path: '/app/email', icon: <MailIcon fontSize="small" /> },
      { label: 'Messaging', path: '/app/messaging', icon: <SmsIcon fontSize="small" /> },
      { label: 'Social', path: '/app/social', icon: <ShareIcon fontSize="small" /> },
      { label: 'CRM', path: '/app/crm', icon: <PeopleIcon fontSize="small" /> },
    ],
  },
  {
    label: 'Measure',
    items: [
      { label: 'Analytics', path: '/app/analytics', icon: <InsightsIcon fontSize="small" /> },
      { label: 'Media', path: '/app/media', icon: <MovieIcon fontSize="small" /> },
      { label: 'Influencer', path: '/app/influencer', icon: <StarIcon fontSize="small" /> },
      { label: 'Intelligence', path: '/app/intelligence', icon: <VisibilityIcon fontSize="small" /> },
    ],
  },
  {
    label: 'Grow',
    items: [
      { label: 'Affiliate', path: '/app/affiliate', icon: <HandshakeIcon fontSize="small" /> },
      { label: 'Notifications', path: '/app/notifications', icon: <NotificationsIcon fontSize="small" /> },
      { label: 'Integrations', path: '/app/integrations', icon: <HubIcon fontSize="small" /> },
      { label: 'Migration', path: '/app/migration', icon: <SwapHorizIcon fontSize="small" /> },
    ],
  },
];

const WORKSPACE_MENU: NavItem[] = [
  { label: 'Settings', path: '/app/workspace/settings', icon: <SettingsIcon fontSize="small" /> },
  { label: 'Members', path: '/app/workspace/members', icon: <GroupIcon fontSize="small" /> },
  { label: 'Billing', path: '/app/workspace/billing', icon: <CreditCardIcon fontSize="small" /> },
  { label: 'Audit log', path: '/app/workspace/audit-log', icon: <HistoryIcon fontSize="small" /> },
];

const PROFILE_MENU: NavItem[] = [
  { label: 'Security', path: '/app/profile/security', icon: <LockIcon fontSize="small" /> },
];

/** Lookup for the AppBar title — flattens all groups + tail menus. */
function findActiveLabel(pathname: string): string {
  const all = [
    ...NAV_GROUPS.flatMap((g) => g.items),
    ...WORKSPACE_MENU,
    ...PROFILE_MENU,
  ];
  // Exact match first, then longest-prefix.
  const exact = all.find((i) => i.path === pathname);
  if (exact) return exact.label;
  const prefix = all
    .filter((i) => pathname.startsWith(i.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return prefix?.label ?? '';
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const user = useSelector((s: RootState) => s.auth.user);
  const workspace = useSelector((s: RootState) => s.auth.workspace);
  const memberships = useSelector((s: RootState) => s.auth.memberships);

  const [accountAnchor, setAccountAnchor] = useState<null | HTMLElement>(null);
  const accountOpen = Boolean(accountAnchor);
  const [membershipsLoaded, setMembershipsLoaded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', country: '' });
  const [creating, setCreating] = useState(false);

  const reloadMemberships = async () => {
    try {
      const r = await workspaceApi.listMemberships();
      const list = r.data.data.memberships;
      dispatch(setMemberships(list));
      if (!workspace && list.length > 0) {
        const first = list[0]!;
        dispatch(setActiveWorkspace({ id: first.workspace.id, name: first.workspace.name, status: first.workspace.status }));
      }
    } catch {
      /* 401 handled by axios interceptor */
    } finally {
      setMembershipsLoaded(true);
    }
  };

  useEffect(() => {
    void reloadMemberships();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateWorkspace = async () => {
    if (createForm.name.trim().length < 2) return;
    setCreating(true);
    try {
      const r = await workspaceApi.create({
        name: createForm.name.trim(),
        country: createForm.country.trim() ? createForm.country.trim().toUpperCase() : undefined,
      });
      const ws = r.data.data.workspace;
      dispatch(setActiveWorkspace({ id: ws.id, name: ws.name, status: ws.status }));
      await reloadMemberships();
      setCreateOpen(false);
      setCreateForm({ name: '', country: '' });
      enqueueSnackbar(`Workspace "${ws.name}" created`, { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Could not create workspace', { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

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

  const activeLabel = useMemo(() => findActiveLabel(location.pathname), [location.pathname]);

  const initials = (user?.name ?? user?.email ?? 'U')
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ minHeight: 64, gap: 2 }}>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1 }}>
              {workspace?.name ?? 'Workspace'}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3, mt: 0.25 }} noWrap>
              {activeLabel || 'Dashboard'}
            </Typography>
          </Box>

          {memberships.length > 1 && (
            <Select
              size="small"
              value={workspace?.id ?? ''}
              onChange={(e) => handleSwitch(e.target.value as string)}
              sx={{ minWidth: 200, bgcolor: 'background.default', borderRadius: 2 }}
            >
              {memberships.map((m) => (
                <MenuItem key={m.workspace.id} value={m.workspace.id}>
                  {m.workspace.name}
                </MenuItem>
              ))}
            </Select>
          )}

          <NotificationBell />

          <Tooltip title="Account">
            <IconButton
              onClick={(e) => setAccountAnchor(e.currentTarget)}
              size="small"
              sx={{
                p: 0.5, pl: 1, borderRadius: 2,
                border: 1, borderColor: 'divider',
                '&:hover': { bgcolor: 'background.default' },
              }}
            >
              <Avatar sx={{
                width: 30, height: 30, mr: 0.75,
                fontSize: 13, fontWeight: 600,
                bgcolor: 'secondary.main',
              }}>
                {initials}
              </Avatar>
              <KeyboardArrowDownIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={accountAnchor}
            open={accountOpen}
            onClose={() => setAccountAnchor(null)}
            slotProps={{ paper: { sx: { mt: 1, minWidth: 220, borderRadius: 2 } } }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="body2" fontWeight={600} noWrap>{user?.name ?? user?.email ?? 'User'}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>{user?.email}</Typography>
            </Box>
            <Divider />
            {PROFILE_MENU.map((m) => (
              <MenuItem
                key={m.path}
                onClick={() => { setAccountAnchor(null); navigate(m.path); }}
              >
                <ListItemIcon>{m.icon}</ListItemIcon>
                {m.label}
              </MenuItem>
            ))}
            <Divider />
            <MenuItem onClick={() => { setAccountAnchor(null); handleLogout(); }}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            // Explicit column flex + a scrollable middle child are what keep
            // the bottom user card pinned and prevent the nav list from
            // overlapping section headers when content is taller than the drawer.
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Toolbar sx={{ minHeight: 64, gap: 1.25 }}>
          <Box sx={{
            width: 32, height: 32, borderRadius: 1.5,
            background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 800, fontSize: 14,
          }}>
            M
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
              Marketing
            </Typography>
            <Typography variant="caption" color="text.secondary">Platform</Typography>
          </Box>
        </Toolbar>
        <Divider />

        <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 0, py: 1 }}>
          {NAV_GROUPS.map((group) => (
            <List
              key={group.label}
              dense
              subheader={
                <ListSubheader
                  sx={{
                    bgcolor: 'transparent',
                    px: 2,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    lineHeight: '32px',
                  }}
                >
                  {group.label}
                </ListSubheader>
              }
              sx={{ px: 1, py: 0 }}
            >
              {group.items.map((item) => {
                const selected = location.pathname === item.path
                  || (item.path !== '/app' && location.pathname.startsWith(item.path + '/'));
                return (
                  <ListItemButton
                    key={item.path}
                    selected={selected}
                    onClick={() => navigate(item.path)}
                    sx={{
                      borderRadius: 1.5,
                      mb: 0.25,
                      px: 1.5,
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        '& .MuiListItemIcon-root': { color: 'inherit' },
                        '&:hover': { bgcolor: 'primary.dark' },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32, color: 'text.secondary' }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{ fontSize: 14, fontWeight: selected ? 600 : 500 }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          ))}

          <Divider sx={{ my: 1, mx: 2 }} />

          <List
            dense
            subheader={
              <ListSubheader sx={{
                bgcolor: 'transparent', px: 2,
                fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                textTransform: 'uppercase', color: 'text.secondary',
                lineHeight: '32px',
              }}>
                Workspace
              </ListSubheader>
            }
            sx={{ px: 1, py: 0 }}
          >
            {WORKSPACE_MENU.map((item) => {
              const selected = location.pathname === item.path;
              return (
                <ListItemButton
                  key={item.path}
                  selected={selected}
                  onClick={() => navigate(item.path)}
                  sx={{
                    borderRadius: 1.5,
                    mb: 0.25,
                    px: 1.5,
                    '&.Mui-selected': {
                      bgcolor: 'action.selected',
                      '& .MuiListItemIcon-root': { color: 'primary.main' },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32, color: 'text.secondary' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ fontSize: 14, fontWeight: selected ? 600 : 500 }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>

        <Divider />
        <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Avatar sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 600, bgcolor: 'secondary.main' }}>
            {initials}
          </Avatar>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {user?.name ?? 'User'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {user?.email}
            </Typography>
          </Box>
          <Tooltip title="Sign out">
            <IconButton size="small" onClick={handleLogout}>
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8, minWidth: 0 }}>
        {!membershipsLoaded ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : !workspace ? (
          <Paper sx={{ p: 6, maxWidth: 520, mx: 'auto', mt: 4, textAlign: 'center' }}>
            <Typography variant="h5" sx={{ mb: 1 }}>
              Welcome, {user?.name ?? user?.email}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              You don't belong to any workspace yet. Create one to start using the platform —
              you can rename it or invite teammates later.
            </Typography>
            <Stack spacing={2} alignItems="stretch" sx={{ maxWidth: 360, mx: 'auto' }}>
              <Button variant="contained" size="large" onClick={() => setCreateOpen(true)}>
                Create your first workspace
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Outlet />
        )}
      </Box>

      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New workspace</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Workspace name"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              autoFocus
              placeholder="Acme Inc."
            />
            <TextField
              label="Country (optional)"
              value={createForm.country}
              onChange={(e) => setCreateForm({ ...createForm, country: e.target.value })}
              placeholder="US"
              inputProps={{ maxLength: 2 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateWorkspace}
            disabled={creating || createForm.name.trim().length < 2}
          >
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
