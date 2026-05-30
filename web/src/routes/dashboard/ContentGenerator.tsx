import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Chip,
  CircularProgress,
  Select,
  MenuItem,
  Alert,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import { contentApi, type BrandVoice, type Generation } from '@/lib/content-api';

type Kind = Generation['kind'];

export default function ContentGenerator() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const { enqueueSnackbar } = useSnackbar();

  const [kind, setKind] = useState<Kind>('headline');
  const [prompt, setPrompt] = useState('');
  const [voiceId, setVoiceId] = useState<string>('');
  const [voices, setVoices] = useState<BrandVoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [lastGenerationId, setLastGenerationId] = useState<string | null>(null);
  const [tokens, setTokens] = useState<{ total: number; cost: number } | null>(null);
  const [quota, setQuota] = useState<{ used: number; cap: number; plan: string } | null>(null);
  const [recent, setRecent] = useState<Generation[]>([]);

  useEffect(() => {
    if (!active) return;
    void contentApi.listVoices(active.id).then((r) => setVoices(r.data.data.voices));
    void contentApi.listGenerations(active.id, { limit: 10 }).then((r) => setRecent(r.data.data.rows));
  }, [active]);

  const run = async () => {
    if (!active || prompt.trim().length < 4) return;
    setBusy(true);
    setOutput(null);
    setTokens(null);
    try {
      const r = await contentApi.generate(active.id, {
        kind,
        prompt: prompt.trim(),
        brand_voice_id: voiceId || undefined,
      });
      setOutput(r.data.data.generation.output);
      setLastGenerationId(r.data.data.generation.id);
      setTokens({
        total: r.data.data.generation.total_tokens,
        cost: r.data.data.generation.cost_usd,
      });
      setQuota({
        used: r.data.data.quota.used_after,
        cap: r.data.data.quota.cap,
        plan: r.data.data.quota.plan_slug,
      });
      // Refresh recent
      const lst = await contentApi.listGenerations(active.id, { limit: 10 });
      setRecent(lst.data.data.rows);
    } catch (e: any) {
      const err = e.response?.data?.error;
      if (err?.code === 'ai_quota_exceeded') {
        enqueueSnackbar(err.message, { variant: 'warning' });
        if (err.details) setQuota({ used: err.details.used, cap: err.details.cap, plan: err.details.plan_slug });
      } else {
        enqueueSnackbar(err?.message ?? 'Generation failed', { variant: 'error' });
      }
    } finally {
      setBusy(false);
    }
  };

  const createDefaultVoice = async () => {
    if (!active) return;
    try {
      const r = await contentApi.createVoice(active.id, {
        name: 'Default',
        tone: 'friendly',
        description: 'Approachable, plain-spoken, no jargon.',
      });
      setVoices([r.data.data.voice, ...voices]);
      setVoiceId(r.data.data.voice.id);
      enqueueSnackbar('Brand voice created', { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const copyOutput = () => {
    if (!output) return;
    void navigator.clipboard.writeText(output);
    enqueueSnackbar('Copied', { variant: 'info' });
  };

  const saveToLibrary = async () => {
    if (!active || !lastGenerationId) return;
    try {
      const r = await contentApi.savePieceFromGeneration(active.id, lastGenerationId);
      enqueueSnackbar(`Saved as piece "${r.data.data.piece.title}"`, { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Save failed', { variant: 'error' });
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Content generator
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        AI is in <strong>stub mode</strong>. Drop <code>OPENAI_API_KEY</code> into <code>api/content-ai/.env</code>
        and set <code>AI_DRIVER=openai</code> for live generation.
      </Alert>

      <Paper sx={{ p: 3, mb: 3, maxWidth: 900 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Kind
              </Typography>
              <Select size="small" value={kind} onChange={(e) => setKind(e.target.value as Kind)} sx={{ minWidth: 160 }}>
                <MenuItem value="headline">Headlines</MenuItem>
                <MenuItem value="social">Social posts</MenuItem>
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="ad_copy">Ad copy</MenuItem>
                <MenuItem value="blog">Blog</MenuItem>
              </Select>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Brand voice (optional)
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Select
                  size="small"
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value as string)}
                  displayEmpty
                  sx={{ minWidth: 200 }}
                >
                  <MenuItem value="">No voice</MenuItem>
                  {voices.map((v) => (
                    <MenuItem key={v.id} value={v.id}>
                      {v.name} — {v.tone}
                    </MenuItem>
                  ))}
                </Select>
                {voices.length === 0 && (
                  <Button size="small" onClick={createDefaultVoice}>
                    Create a default voice
                  </Button>
                )}
              </Stack>
            </Box>
          </Stack>

          <TextField
            label="Prompt"
            multiline
            minRows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want — e.g. headlines for a new SaaS launch targeting small ecommerce teams"
            fullWidth
          />

          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant="contained" onClick={run} disabled={busy || prompt.trim().length < 4}>
              {busy ? <CircularProgress size={18} color="inherit" /> : 'Generate'}
            </Button>
            {quota && (
              <Chip
                label={`AI quota: ${quota.used.toLocaleString()} / ${quota.cap.toLocaleString()} tokens (plan: ${quota.plan})`}
                size="small"
                color={quota.used >= quota.cap ? 'warning' : 'default'}
                variant="outlined"
              />
            )}
          </Stack>

          {output && (
            <Box>
              <Divider sx={{ mb: 2 }} />
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle1">Output</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  {tokens && (
                    <Chip
                      label={`${tokens.total.toLocaleString()} tokens · $${Number(tokens.cost).toFixed(4)}`}
                      size="small"
                    />
                  )}
                  <Tooltip title="Copy">
                    <IconButton size="small" onClick={copyOutput}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Button size="small" variant="outlined" onClick={saveToLibrary} disabled={!lastGenerationId}>
                    Save to library
                  </Button>
                </Stack>
              </Stack>
              <Paper variant="outlined" sx={{ p: 2, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
                {output}
              </Paper>
            </Box>
          )}
        </Stack>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Recent generations
      </Typography>
      <Paper>
        {recent.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No generations yet.
            </Typography>
          </Box>
        ) : (
          <Stack divider={<Divider />}>
            {recent.map((g) => (
              <Box key={g.id} sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip label={g.kind} size="small" />
                    <Typography variant="caption" color="text.secondary">
                      {new Date(g.created_at).toLocaleString()}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {g.total_tokens.toLocaleString()} tok · ${Number(g.cost_usd).toFixed(4)}
                  </Typography>
                </Stack>
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: 'text.secondary',
                    maxHeight: 120,
                    overflow: 'auto',
                  }}
                >
                  {g.output}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
