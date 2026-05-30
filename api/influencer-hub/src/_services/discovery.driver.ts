import type { InfluencerPlatform } from '../models/influencer.model.js';

export interface DiscoverInput {
  platform: InfluencerPlatform;
  topic?: string;
  country?: string;
  min_followers?: number;
  max_followers?: number;
  min_engagement_rate?: number;
  limit: number;
}

export interface DiscoverResult {
  platform: InfluencerPlatform;
  external_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  followers: number;
  engagement_rate: number;
  audience_country: string | null;
  topics: string[];
  estimated_cost_usd: number;
}

export interface DiscoveryDriver {
  discover(input: DiscoverInput): Promise<DiscoverResult[]>;
}

/**
 * Stub — generates deterministic synthetic influencers from the seed topic.
 * Useful for UI development without a HypeAuditor/Modash subscription.
 */
export class StubDiscoveryDriver implements DiscoveryDriver {
  async discover(input: DiscoverInput): Promise<DiscoverResult[]> {
    const out: DiscoverResult[] = [];
    const topic = (input.topic ?? 'creator').toLowerCase().replace(/\s+/g, '_');
    for (let i = 0; i < input.limit; i++) {
      const seed = `${input.platform}_${topic}_${i}`;
      const followers = clamp(input.min_followers ?? 1_000, input.max_followers ?? 1_000_000, range(seed, 1_000, 1_000_000));
      const er = Number((range(seed + '_er', 100, 1200) / 10000).toFixed(4));
      out.push({
        platform: input.platform,
        external_id: seed,
        handle: `@${topic}_${input.platform[0]}${i}`,
        display_name: `${topic.replace(/_/g, ' ')} creator ${i + 1}`,
        avatar_url: `https://picsum.photos/seed/${seed}/128/128`,
        bio: `Top ${topic.replace(/_/g, ' ')} content on ${input.platform}. Bookings open.`,
        followers,
        engagement_rate: er,
        audience_country: input.country ?? 'US',
        topics: [topic, 'lifestyle', 'creator-economy'],
        estimated_cost_usd: Math.round((followers / 1000) * 5 * 100) / 100,
      });
    }
    return out;
  }
}

function range(seed: string, lo: number, hi: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const v = Math.abs(h) % (hi - lo + 1);
  return lo + v;
}

function clamp(min: number, max: number, val: number): number {
  return Math.max(min, Math.min(max, val));
}
