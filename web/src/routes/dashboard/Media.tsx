import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  TextField,
  Chip,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Alert,
  Tabs,
  Tab,
  Select,
  MenuItem,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import HearingIcon from '@mui/icons-material/Hearing';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import type { RootState } from '@/store';
import { mediaApi, type ImageGeneration, type Video } from '@/lib/media-api';

export default function Media() {
  const active = useSelector((s: RootState) => s.auth.workspace);
  const { enqueueSnackbar } = useSnackbar();

  const [tab, setTab] = useState<'images' | 'videos'>('images');
  const [loading, setLoading] = useState(true);

  // Images
  const [images, setImages] = useState<ImageGeneration[]>([]);
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<'1024x1024' | '1792x1024' | '1024x1792'>('1024x1024');
  const [style, setStyle] = useState<'natural' | 'vivid'>('vivid');
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Videos
  const [videos, setVideos] = useState<Video[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [transcribeOpen, setTranscribeOpen] = useState<{ video: Video } | null>(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [transcribing, setTranscribing] = useState(false);

  const refresh = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const [i, v] = await Promise.all([
        mediaApi.listImages(active.id, { limit: 25 }),
        mediaApi.listVideos(active.id, { limit: 25 }),
      ]);
      setImages(i.data.data.rows);
      setVideos(v.data.data.rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const generate = async () => {
    if (!active || prompt.trim().length < 4) return;
    setGenerating(true);
    try {
      const r = await mediaApi.generateImage(active.id, { prompt: prompt.trim(), size, style });
      enqueueSnackbar(`Generated (cost ~$${Number(r.data.data.image.cost_usd).toFixed(4)})`, { variant: 'success' });
      setPrompt('');
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const removeImage = async (img: ImageGeneration) => {
    if (!active) return;
    if (!confirm('Delete this image?')) return;
    try {
      await mediaApi.removeImage(active.id, img.id);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  const importYouTube = async () => {
    if (!active || !youtubeUrl.trim()) return;
    setImporting(true);
    try {
      await mediaApi.importYouTube(active.id, youtubeUrl.trim());
      enqueueSnackbar('Video imported', { variant: 'success' });
      setYoutubeUrl('');
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Import failed', { variant: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const startTranscribe = (video: Video) => {
    setTranscribeOpen({ video });
    setAudioUrl('');
  };

  const submitTranscribe = async () => {
    if (!active || !transcribeOpen) return;
    setTranscribing(true);
    try {
      await mediaApi.transcribe(active.id, transcribeOpen.video.id, audioUrl || undefined);
      enqueueSnackbar('Transcription complete', { variant: 'success' });
      setTranscribeOpen(null);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Transcription failed', { variant: 'error' });
    } finally {
      setTranscribing(false);
    }
  };

  const removeVideo = async (v: Video) => {
    if (!active) return;
    if (!confirm(`Delete "${v.title}"?`)) return;
    try {
      await mediaApi.removeVideo(active.id, v.id);
      void refresh();
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.error?.message ?? 'Failed', { variant: 'error' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Media
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        AI is in <strong>stub mode</strong>. Drop <code>OPENAI_API_KEY</code> into{' '}
        <code>api/media-hub/.env</code> and set <code>AI_DRIVER=openai</code> for DALL-E images +
        Whisper transcripts. Drop <code>YOUTUBE_API_KEY</code> for real YouTube imports.
      </Alert>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab value="images" label={`Images (${images.length})`} />
          <Tab value="videos" label={`Videos (${videos.length})`} />
        </Tabs>
      </Paper>

      {tab === 'images' && (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Generate image
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A minimalist hero image for a B2B SaaS landing page, vibrant gradient background"
                multiline
                minRows={2}
                fullWidth
              />
              <Stack direction="row" spacing={2} alignItems="center">
                <Select size="small" value={size} onChange={(e) => setSize(e.target.value as any)}>
                  <MenuItem value="1024x1024">1024 × 1024 (square)</MenuItem>
                  <MenuItem value="1792x1024">1792 × 1024 (landscape)</MenuItem>
                  <MenuItem value="1024x1792">1024 × 1792 (portrait)</MenuItem>
                </Select>
                <Select size="small" value={style} onChange={(e) => setStyle(e.target.value as any)}>
                  <MenuItem value="vivid">Vivid</MenuItem>
                  <MenuItem value="natural">Natural</MenuItem>
                </Select>
                <Button
                  variant="contained"
                  onClick={generate}
                  disabled={generating || prompt.trim().length < 4}
                >
                  {generating ? <CircularProgress size={18} color="inherit" /> : 'Generate'}
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {images.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No images yet — generate one above.
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {images.map((img) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={img.id}>
                  <Paper sx={{ overflow: 'hidden', position: 'relative' }}>
                    <Box
                      component="img"
                      src={img.image_url}
                      alt={img.prompt}
                      sx={{
                        display: 'block',
                        width: '100%',
                        aspectRatio: '1 / 1',
                        objectFit: 'cover',
                        cursor: 'zoom-in',
                      }}
                      onClick={() => setPreviewUrl(img.image_url)}
                    />
                    <Box sx={{ p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {img.prompt}
                      </Typography>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                        <Chip label={img.size} size="small" />
                        <Stack direction="row" spacing={0.5}>
                          <Typography variant="caption" color="text.secondary">
                            ${Number(img.cost_usd).toFixed(4)}
                          </Typography>
                          <IconButton size="small" onClick={() => removeImage(img)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {tab === 'videos' && (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Import YouTube video
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or just the video ID"
                fullWidth
                size="small"
              />
              <Button variant="contained" onClick={importYouTube} disabled={importing || !youtubeUrl.trim()}>
                {importing ? <CircularProgress size={18} color="inherit" /> : 'Import'}
              </Button>
            </Stack>
          </Paper>

          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell align="right">Duration</TableCell>
                  <TableCell align="right">Views</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {videos.map((v) => (
                  <TableRow key={v.id} hover>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {v.thumbnail_url && (
                          <Box component="img" src={v.thumbnail_url} sx={{ width: 80, height: 45, objectFit: 'cover', borderRadius: 0.5 }} />
                        )}
                        <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.title}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip label={v.source} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      {v.duration_seconds ? formatDuration(v.duration_seconds) : '—'}
                    </TableCell>
                    <TableCell align="right">{v.view_count?.toLocaleString() ?? '—'}</TableCell>
                    <TableCell>
                      <Chip
                        label={v.status}
                        size="small"
                        color={v.status === 'transcribed' ? 'success' : v.status === 'failed' ? 'error' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {v.source === 'youtube' && v.external_id && (
                        <IconButton size="small" onClick={() => window.open(`https://www.youtube.com/watch?v=${v.external_id}`, '_blank')}>
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      )}
                      {v.status !== 'transcribing' && (
                        <IconButton size="small" onClick={() => startTranscribe(v)} title="Transcribe">
                          <HearingIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton size="small" onClick={() => removeVideo(v)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {videos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        No videos imported yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      <Dialog open={!!previewUrl} onClose={() => setPreviewUrl(null)} maxWidth="md">
        {previewUrl && (
          <Box component="img" src={previewUrl} sx={{ display: 'block', maxWidth: '100%', maxHeight: '80vh' }} />
        )}
      </Dialog>

      <Dialog open={!!transcribeOpen} onClose={() => setTranscribeOpen(null)} fullWidth maxWidth="sm">
        <DialogTitle>Transcribe video</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              Provide a direct audio URL (mp3/m4a/wav). For YouTube videos you'll need to extract
              the audio first; the platform's API does not expose direct streams.
            </Alert>
            <TextField
              label="Audio URL"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="https://example.com/audio.mp3"
              fullWidth
            />
            <Button variant="contained" onClick={submitTranscribe} disabled={transcribing || !audioUrl}>
              {transcribing ? 'Transcribing…' : 'Start transcription'}
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
