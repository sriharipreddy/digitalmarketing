export interface YouTubeVideoMetadata {
  external_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  view_count: number | null;
  published_at: Date | null;
  channel_title: string | null;
}

export interface YouTubeDriver {
  fetchMetadata(videoIdOrUrl: string): Promise<YouTubeVideoMetadata>;
}

/** Real driver — YouTube Data API v3 `videos.list`. */
export class RealYouTubeDriver implements YouTubeDriver {
  constructor(private apiKey: string) {}

  async fetchMetadata(videoIdOrUrl: string): Promise<YouTubeVideoMetadata> {
    const videoId = extractVideoId(videoIdOrUrl);
    if (!videoId) throw new Error('Could not parse a YouTube video ID');

    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet,contentDetails,statistics');
    url.searchParams.set('id', videoId);
    url.searchParams.set('key', this.apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`YouTube API ${res.status}: ${body.slice(0, 400)}`);
    }
    const data: any = await res.json();
    const item = data.items?.[0];
    if (!item) throw new Error('Video not found');

    return {
      external_id: videoId,
      title: item.snippet?.title ?? '',
      description: item.snippet?.description ?? null,
      thumbnail_url:
        item.snippet?.thumbnails?.maxres?.url ??
        item.snippet?.thumbnails?.high?.url ??
        item.snippet?.thumbnails?.default?.url ??
        null,
      duration_seconds: parseDuration(item.contentDetails?.duration),
      view_count: item.statistics?.viewCount ? Number(item.statistics.viewCount) : null,
      published_at: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : null,
      channel_title: item.snippet?.channelTitle ?? null,
    };
  }
}

export class StubYouTubeDriver implements YouTubeDriver {
  async fetchMetadata(videoIdOrUrl: string): Promise<YouTubeVideoMetadata> {
    const videoId = extractVideoId(videoIdOrUrl) ?? `stub_${Date.now().toString(36)}`;
    return {
      external_id: videoId,
      title: `Stub video ${videoId}`,
      description: `This is a stubbed YouTube video metadata response for ${videoId}. Drop YOUTUBE_API_KEY into api/media-hub/.env for real imports.`,
      thumbnail_url: `https://picsum.photos/seed/${videoId}/1280/720`,
      duration_seconds: 240 + (hash(videoId) % 600),
      view_count: 1000 + (hash(videoId) % 100_000),
      published_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      channel_title: 'Stub Channel',
    };
  }
}

function extractVideoId(input: string): string | null {
  // Accept raw IDs (11 alphanum) or various YouTube URL shapes.
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = input.match(re);
    if (m) return m[1]!;
  }
  return null;
}

/** Convert ISO 8601 duration (PT1H2M30S) to seconds. */
function parseDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  const h = parseInt(m[1] ?? '0', 10);
  const min = parseInt(m[2] ?? '0', 10);
  const s = parseInt(m[3] ?? '0', 10);
  return h * 3600 + min * 60 + s;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
