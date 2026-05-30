import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  TextField,
  Chip,
  CircularProgress,
  Alert,
  LinearProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import { campaignApi } from '@/lib/campaign-api';

type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
interface StepUpdate {
  step: number;
  name: string;
  status: StepStatus;
  message?: string;
  data?: Record<string, unknown>;
  duration_ms?: number;
}

const STEP_LABELS: Record<string, string> = {
  parse_source: 'Parse source URL',
  brand_voice_check: 'Pick brand voice',
  generate_headlines: 'Generate headlines',
  generate_social: 'Generate social posts',
  generate_email: 'Generate email',
  save_content_pieces: 'Save to content library',
  research_keywords: 'Research keywords',
  resolve_audience: 'Resolve audience',
  create_campaign: 'Create campaign',
  create_utm_links: 'Create UTM links',
  intelligence_scan: 'Intelligence scan',
};

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') return <CheckCircleIcon color="success" />;
  if (status === 'failed') return <ErrorIcon color="error" />;
  if (status === 'skipped') return <SkipNextIcon color="disabled" />;
  if (status === 'running') return <CircularProgress size={20} />;
  return <RadioButtonUncheckedIcon color="disabled" />;
}

export default function OneClick() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);
  const { enqueueSnackbar } = useSnackbar();

  const [sourceUrl, setSourceUrl] = useState('');
  const [pitch, setPitch] = useState('');
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Record<number, StepUpdate>>({});
  const [finalSummary, setFinalSummary] = useState<Record<string, unknown> | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const run = async () => {
    if (!active || !accessToken) return;
    setSteps({});
    setFinalSummary(null);
    setErrorMsg(null);
    setRunning(true);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const res = await fetch(campaignApi.oneClickPath(active.id), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ source_url: sourceUrl, product_pitch: pitch }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text();
        try {
          const json = JSON.parse(body);
          throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
        } catch {
          throw new Error(body.slice(0, 200) || `HTTP ${res.status}`);
        }
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // SSE frames are separated by \n\n. Each frame has lines like:
      //   event: step
      //   data: {...}
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const eventLine = raw.split('\n').find((l) => l.startsWith('event:'));
          const dataLine = raw.split('\n').find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const event = eventLine?.slice(7).trim() ?? 'message';
          let data: any;
          try {
            data = JSON.parse(dataLine.slice(6));
          } catch {
            continue;
          }
          if (event === 'step') {
            setSteps((prev) => ({ ...prev, [data.step]: data }));
          } else if (event === 'done') {
            setFinalSummary(data.summary ?? null);
          } else if (event === 'error') {
            setErrorMsg(data.message ?? 'Unknown error');
          }
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        enqueueSnackbar('Cancelled', { variant: 'info' });
      } else {
        setErrorMsg(e.message ?? 'Failed');
      }
    } finally {
      setRunning(false);
      setAbortController(null);
    }
  };

  const cancel = () => {
    abortController?.abort();
  };

  const stepList = Array.from({ length: 11 }, (_, i) => i + 1).map((n) => steps[n]);
  const completedCount = stepList.filter((s) => s?.status === 'completed' || s?.status === 'skipped').length;
  const progressPercent = (completedCount / 11) * 100;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1 }}>
        One-Click Market Capture
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Paste a URL + a sentence about your product. We orchestrate content-ai, seo-engine, crm-automation,
        campaign-manager, and intelligence to ship a complete multi-channel campaign in one click.
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        All downstream services use their <strong>stub drivers</strong> by default — drop real
        OPENAI/DATAFORSEO keys into the relevant <code>.env</code> for live output. The orchestration
        + DB writes are real either way.
      </Alert>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack spacing={2}>
          <TextField
            label="Source URL"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://yourbrand.com/landing"
            fullWidth
            disabled={running}
          />
          <TextField
            label="Product pitch (one sentence)"
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            placeholder="Our new tool helps SaaS marketers ship multi-channel campaigns in minutes."
            fullWidth
            multiline
            minRows={2}
            disabled={running}
          />
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              size="large"
              onClick={run}
              disabled={running || sourceUrl.length < 3 || pitch.length < 10}
            >
              {running ? 'Running…' : 'Launch'}
            </Button>
            {running && (
              <Button variant="outlined" onClick={cancel}>
                Cancel
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {(running || stepList.some((s) => s)) && (
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Step {completedCount} / 11
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {Math.round(progressPercent)}%
            </Typography>
          </Stack>
          <LinearProgress variant="determinate" value={progressPercent} sx={{ height: 6, borderRadius: 3 }} />
        </Box>
      )}

      {errorMsg && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      <Stack spacing={1}>
        {stepList.map((s, idx) => {
          const n = idx + 1;
          if (!s) {
            return (
              <Paper key={n} sx={{ p: 2, opacity: 0.5 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <RadioButtonUncheckedIcon color="disabled" />
                  <Typography variant="body2" color="text.secondary">
                    Step {n}
                  </Typography>
                </Stack>
              </Paper>
            );
          }
          return (
            <Paper
              key={n}
              sx={{
                p: 2,
                borderLeft: 4,
                borderColor:
                  s.status === 'completed' ? 'success.main' :
                  s.status === 'failed' ? 'error.main' :
                  s.status === 'running' ? 'info.main' :
                  s.status === 'skipped' ? 'grey.400' :
                  'grey.300',
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <StatusIcon status={s.status} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={500}>
                    {n}. {STEP_LABELS[s.name] ?? s.name}
                  </Typography>
                  {s.message && (
                    <Typography variant="caption" color="text.secondary">
                      {s.message}
                    </Typography>
                  )}
                </Box>
                {s.duration_ms != null && (
                  <Chip label={`${s.duration_ms}ms`} size="small" variant="outlined" />
                )}
                <Chip
                  label={s.status}
                  size="small"
                  color={
                    s.status === 'completed' ? 'success' :
                    s.status === 'failed' ? 'error' :
                    s.status === 'running' ? 'info' :
                    'default'
                  }
                />
              </Stack>
            </Paper>
          );
        })}
      </Stack>

      {finalSummary && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Summary
          </Typography>
          <Box
            component="pre"
            sx={{
              p: 2,
              bgcolor: 'grey.50',
              borderRadius: 1,
              overflow: 'auto',
              fontSize: 12,
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
            }}
          >
            {JSON.stringify(finalSummary, null, 2)}
          </Box>
          {typeof finalSummary.campaign_id === 'string' && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Campaign created — find it on the{' '}
              <a href="/dashboard/campaigns" style={{ textDecoration: 'underline' }}>
                Campaigns page
              </a>
              .
            </Alert>
          )}
        </Paper>
      )}
    </Box>
  );
}
