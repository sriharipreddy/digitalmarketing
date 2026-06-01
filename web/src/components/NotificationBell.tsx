import { useEffect, useState, useRef, useCallback } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Button,
  Stack,
  Chip,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '@/store';
import { notificationApi, type Notification } from '@/lib/notification-api';

const SEVERITY_COLORS: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

export default function NotificationBell() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);
  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [streamOk, setStreamOk] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const open = Boolean(anchorEl);

  const refresh = useCallback(async () => {
    if (!active) return;
    try {
      const [list, cnt] = await Promise.all([
        notificationApi.list(active.id, { limit: 10 }),
        notificationApi.unreadCount(active.id),
      ]);
      setItems(list.data.data.rows);
      setCount(cnt.data.data.count);
    } catch {
      /* silently ignore — bell is non-critical */
    }
  }, [active]);

  // Initial fetch
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // SSE subscription — pushes new notifications + bumps unread count in real time
  useEffect(() => {
    if (!active || !accessToken) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setStreamOk(false);

    const run = async () => {
      try {
        const res = await fetch(notificationApi.streamPath(active.id), {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}`, Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          setStreamOk(false);
          return;
        }
        setStreamOk(true);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const raw = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            if (raw.startsWith(':')) continue; // keep-alive ping
            const eventLine = raw.split('\n').find((l) => l.startsWith('event:'));
            const dataLine = raw.split('\n').find((l) => l.startsWith('data:'));
            if (!eventLine || !dataLine) continue;
            const event = eventLine.slice(7).trim();
            try {
              const data = JSON.parse(dataLine.slice(6));
              if (event === 'notification') {
                setItems((prev) => [data, ...prev].slice(0, 10));
                setCount((c) => c + 1);
              }
            } catch {
              /* ignore parse errors */
            }
          }
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') setStreamOk(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [active, accessToken]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    void refresh();
  };

  const handleClose = () => setAnchorEl(null);

  const click = async (n: Notification) => {
    if (!active) return;
    if (!n.read_at) {
      try {
        await notificationApi.markRead(active.id, n.id);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
        setCount((c) => Math.max(0, c - 1));
      } catch {
        /* ignore */
      }
    }
    if (n.action_url) {
      handleClose();
      navigate(n.action_url);
    }
  };

  const markAll = async () => {
    if (!active) return;
    setLoading(true);
    try {
      await notificationApi.markAllRead(active.id);
      setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
      setCount(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title={streamOk ? 'Notifications' : 'Notifications (offline)'}>
        <IconButton color="inherit" onClick={handleOpen} size="small" sx={{ mr: 0.5 }}>
          <Badge badgeContent={count} color="error" max={99}>
            {streamOk ? <NotificationsIcon /> : <NotificationsOffIcon />}
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 380, maxHeight: 480 } } }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.5 }}>
          <Typography variant="subtitle1">Notifications</Typography>
          {count > 0 && (
            <Button size="small" onClick={markAll} disabled={loading}>
              Mark all read
            </Button>
          )}
        </Stack>
        <Divider />
        {items.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No notifications yet.
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {items.map((n) => (
              <ListItemButton
                key={n.id}
                onClick={() => click(n)}
                sx={{
                  bgcolor: n.read_at ? undefined : 'action.hover',
                  alignItems: 'flex-start',
                  borderLeft: 3,
                  borderColor: `${SEVERITY_COLORS[n.severity] ?? 'info'}.main`,
                }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Typography variant="body2" fontWeight={n.read_at ? 400 : 600} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.title}
                      </Typography>
                      <Chip label={n.kind.split('.')[0]} size="small" variant="outlined" sx={{ flexShrink: 0 }} />
                    </Stack>
                  }
                  secondary={
                    <Box>
                      {n.body && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.body}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.disabled">
                        {new Date(n.created_at).toLocaleString()}
                      </Typography>
                    </Box>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        )}
        <Divider />
        <Box sx={{ p: 1, textAlign: 'center' }}>
          <Button
            size="small"
            onClick={() => {
              handleClose();
              navigate('/app/notifications');
            }}
          >
            View all
          </Button>
        </Box>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <CircularProgress size={16} />
          </Box>
        )}
      </Popover>
    </>
  );
}
