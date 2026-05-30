import crypto from 'node:crypto';
import type { AppPlatform } from '../models/app-listing.model.js';

export interface AppListingSnapshot {
  app_name: string;
  developer_name: string | null;
  category: string | null;
  current_version: string | null;
  rating_average: number | null;
  rating_count: number | null;
  keywords: string[] | null;
  description_short: string | null;
  description_full: string | null;
}

/**
 * Abstract ASO provider — fetches public-app-listing metadata from App Store
 * or Google Play. Stub used during dev / tests.
 */
export interface AsoDriver {
  fetch(platform: AppPlatform, appExternalId: string): Promise<AppListingSnapshot>;
}

export class StubAsoDriver implements AsoDriver {
  async fetch(platform: AppPlatform, appExternalId: string): Promise<AppListingSnapshot> {
    const h = crypto.createHash('sha256').update(`${platform}:${appExternalId}`).digest();
    return {
      app_name: `Sample App ${appExternalId.slice(0, 6)}`,
      developer_name: 'Sample Developer',
      category: platform === 'ios' ? 'Productivity' : 'Tools',
      current_version: `1.${(h[0] ?? 0) % 10}.${(h[1] ?? 0) % 20}`,
      rating_average: Number((3 + ((h[2] ?? 0) % 200) / 100).toFixed(2)),
      rating_count: ((h[3] ?? 0) << 8) + (h[4] ?? 0),
      keywords: ['marketing', 'analytics', 'crm', 'seo'],
      description_short: 'A high-quality sample app description.',
      description_full: 'Full description with feature highlights, screenshots and changelog notes. '.repeat(4),
    };
  }
}
