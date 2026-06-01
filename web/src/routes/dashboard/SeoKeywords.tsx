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
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Checkbox,
  IconButton,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import { seoApi, type ResearchResult, type SavedKeyword } from '@/lib/seo-api';

export default function SeoKeywords() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const { enqueueSnackbar } = useSnackbar();

  const [saved, setSaved] = useState<SavedKeyword[]>([]);
  const [loading, setLoading] = useState(true);

  const [seed, setSeed] = useState('');
  const [researching, setResearching] = useState(false);
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [driverMode, setDriverMode] = useState<'stub' | 'live' | null>(null);

  const refresh = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const r = await seoApi.list(active.id);
      setSaved(r.data.data.rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const research = async () => {
    if (!active || seed.trim().length < 2) return;
    setResearching(true);
    setResults([]);
    setSelected({});
    try {
      const r = await seoApi.research(active.id, seed.trim(), { limit: 10 });
      setResults(r.data.data.results);
      if (r.data.data.driver) setDriverMode(r.data.data.driver);
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Research failed', { variant: 'error' });
    } finally {
      setResearching(false);
    }
  };

  const save = async () => {
    if (!active) return;
    const picks = results.filter((_, i) => selected[i]);
    if (picks.length === 0) {
      enqueueSnackbar('Pick at least one keyword', { variant: 'warning' });
      return;
    }
    try {
      const r = await seoApi.save(active.id, picks);
      enqueueSnackbar(`Saved ${r.data.data.saved} keywords`, { variant: 'success' });
      setResults([]);
      setSelected({});
      setSeed('');
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Save failed', { variant: 'error' });
    }
  };

  const remove = async (id: string) => {
    if (!active) return;
    try {
      await seoApi.remove(active.id, id);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        SEO keywords
      </Typography>

      {driverMode === 'stub' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Keyword research is in <strong>stub mode</strong>. Drop DataForSEO credentials into
          <code> api/seo-engine/.env</code> + set <code>DATAFORSEO_DRIVER=dataforseo</code> for live SERP data.
        </Alert>
      )}
      {driverMode === 'live' && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Live DataForSEO results — volumes, difficulty, and CPC are real SERP data.
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3, maxWidth: 900 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Research a seed keyword
        </Typography>
        <Stack direction="row" spacing={1}>
          <TextField
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="e.g. marketing automation"
            fullWidth
            size="small"
            onKeyDown={(e) => {
              if (e.key === 'Enter') research();
            }}
          />
          <Button variant="contained" onClick={research} disabled={researching || seed.trim().length < 2}>
            {researching ? 'Researching…' : 'Research'}
          </Button>
        </Stack>

        {results.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={Object.values(selected).some(Boolean) && !results.every((_, i) => selected[i])}
                      checked={results.length > 0 && results.every((_, i) => selected[i])}
                      onChange={(e) => {
                        const next: Record<string, boolean> = {};
                        if (e.target.checked) results.forEach((_, i) => (next[i] = true));
                        setSelected(next);
                      }}
                    />
                  </TableCell>
                  <TableCell>Keyword</TableCell>
                  <TableCell align="right">Volume</TableCell>
                  <TableCell align="right">Difficulty</TableCell>
                  <TableCell align="right">CPC</TableCell>
                  <TableCell>Intent</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={!!selected[i]}
                        onChange={(e) => setSelected({ ...selected, [i]: e.target.checked })}
                      />
                    </TableCell>
                    <TableCell>{r.keyword}</TableCell>
                    <TableCell align="right">{r.search_volume?.toLocaleString() ?? '—'}</TableCell>
                    <TableCell align="right">{r.difficulty ?? '—'}</TableCell>
                    <TableCell align="right">{r.cpc != null ? `$${Number(r.cpc).toFixed(2)}` : '—'}</TableCell>
                    <TableCell>{r.intent ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{ mt: 1 }}>
              <Button variant="contained" onClick={save}>
                Save selected to keyword bank
              </Button>
            </Box>
          </Box>
        )}
      </Paper>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Saved keywords
      </Typography>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Keyword</TableCell>
                <TableCell>Country</TableCell>
                <TableCell align="right">Volume</TableCell>
                <TableCell align="right">Difficulty</TableCell>
                <TableCell align="right">CPC</TableCell>
                <TableCell>Intent</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {saved.map((k) => (
                <TableRow key={k.id}>
                  <TableCell>{k.keyword}</TableCell>
                  <TableCell>{k.country}</TableCell>
                  <TableCell align="right">{k.search_volume?.toLocaleString() ?? '—'}</TableCell>
                  <TableCell align="right">{k.difficulty ?? '—'}</TableCell>
                  <TableCell align="right">{k.cpc != null ? `$${Number(k.cpc).toFixed(2)}` : '—'}</TableCell>
                  <TableCell>
                    {k.intent ? <Chip label={k.intent} size="small" /> : '—'}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => remove(k.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {saved.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No keywords saved yet. Research a seed above to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
