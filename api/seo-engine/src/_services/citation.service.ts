import type { Models } from '../models/index.js';
import type { CitationStatus } from '../models/citation.model.js';
import { NotFoundError } from '@marketing/shared-middleware';

const DEFAULT_DIRECTORIES = [
  { name: 'Yelp', url: 'https://www.yelp.com/biz_user_account/new' },
  { name: 'Yellow Pages', url: 'https://accounts.yp.com/' },
  { name: 'Bing Places', url: 'https://www.bingplaces.com' },
  { name: 'Foursquare', url: 'https://business.foursquare.com' },
  { name: 'TripAdvisor', url: 'https://www.tripadvisor.com/Owners' },
  { name: 'Better Business Bureau', url: 'https://www.bbb.org' },
  { name: 'MapQuest', url: 'https://business.mapquest.com' },
  { name: 'Apple Maps', url: 'https://mapsconnect.apple.com' },
];

export class CitationService {
  constructor(private models: Models) {}

  async list(workspaceId: string, listingId: string) {
    return this.models.LocalCitation.findAll({
      where: { workspace_id: workspaceId, listing_id: listingId },
      order: [['created_at', 'DESC']],
    });
  }

  /**
   * Seed citation rows for every directory in our default catalogue so the dashboard
   * can render the entire to-do list immediately. Idempotent on (listing_id, directory_name).
   */
  async seedDefaults(workspaceId: string, listingId: string) {
    const listing = await this.models.LocalListing.findOne({
      where: { id: listingId, workspace_id: workspaceId },
    });
    if (!listing) throw new NotFoundError('Listing not found');

    let created = 0;
    for (const d of DEFAULT_DIRECTORIES) {
      const [, isNew] = await this.models.LocalCitation.findOrCreate({
        where: { listing_id: listingId, directory_name: d.name },
        defaults: {
          workspace_id: workspaceId,
          listing_id: listingId,
          directory_name: d.name,
          directory_url: d.url,
          status: 'pending',
        } as any,
      });
      if (isNew) created++;
    }
    return { created, total: DEFAULT_DIRECTORIES.length };
  }

  async updateStatus(workspaceId: string, citationId: string, status: CitationStatus, submissionUrl?: string | null) {
    const c = await this.models.LocalCitation.findOne({ where: { id: citationId, workspace_id: workspaceId } });
    if (!c) throw new NotFoundError('Citation not found');
    const patch: any = { status };
    if (submissionUrl !== undefined) patch.submission_url = submissionUrl;
    if (status === 'submitted') patch.submitted_at = new Date();
    if (status === 'live') patch.verified_at = new Date();
    await c.update(patch);
    return c;
  }
}
