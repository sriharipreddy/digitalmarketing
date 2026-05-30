import type { Models } from '../models/index.js';
import type { LocalListingDriver } from './local-listing.driver.js';
import type { LocalProvider } from '../models/local-listing.model.js';
import { NotFoundError } from '@marketing/shared-middleware';

export interface CreateListingInput {
  provider: LocalProvider;
  provider_account_id: string;
  business_name: string;
  address_line1?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country?: string;
  phone?: string | null;
  website_url?: string | null;
  categories?: string[] | null;
  hours?: Record<string, unknown> | null;
}

export class LocalListingService {
  constructor(private models: Models, private driver: LocalListingDriver) {}

  async list(workspaceId: string) {
    return this.models.LocalListing.findAll({
      where: { workspace_id: workspaceId },
      order: [['created_at', 'DESC']],
    });
  }

  async create(workspaceId: string, input: CreateListingInput) {
    const [row] = await this.models.LocalListing.findOrCreate({
      where: {
        workspace_id: workspaceId,
        provider: input.provider,
        provider_account_id: input.provider_account_id,
      },
      defaults: {
        workspace_id: workspaceId,
        provider: input.provider,
        provider_account_id: input.provider_account_id,
        business_name: input.business_name,
        address_line1: input.address_line1 ?? null,
        city: input.city ?? null,
        region: input.region ?? null,
        postal_code: input.postal_code ?? null,
        country: input.country ?? 'US',
        phone: input.phone ?? null,
        website_url: input.website_url ?? null,
        categories: input.categories ?? null,
        hours: input.hours ?? null,
        status: 'pending_verification',
      } as any,
    });
    return row;
  }

  async remove(workspaceId: string, listingId: string) {
    const row = await this.models.LocalListing.findOne({ where: { id: listingId, workspace_id: workspaceId } });
    if (!row) throw new NotFoundError('Listing not found');
    await row.destroy();
  }

  async syncReviews(workspaceId: string, listingId: string) {
    const listing = await this.models.LocalListing.findOne({
      where: { id: listingId, workspace_id: workspaceId },
    });
    if (!listing) throw new NotFoundError('Listing not found');

    const reviews = await this.driver.fetchReviews(listing.provider_account_id);
    let inserted = 0;
    for (const r of reviews) {
      const [, created] = await this.models.LocalReview.findOrCreate({
        where: { listing_id: listing.id, provider_review_id: r.provider_review_id },
        defaults: {
          workspace_id: workspaceId,
          listing_id: listing.id,
          provider_review_id: r.provider_review_id,
          author_name: r.author_name,
          rating: r.rating,
          body: r.body,
          sentiment: r.rating >= 4 ? 'positive' : r.rating === 3 ? 'neutral' : 'negative',
          posted_at: r.posted_at,
        } as any,
      });
      if (created) inserted++;
    }
    await listing.update({ last_sync_at: new Date(), status: 'verified' });
    return { inserted, total: reviews.length };
  }

  async listReviews(workspaceId: string, listingId: string) {
    return this.models.LocalReview.findAll({
      where: { workspace_id: workspaceId, listing_id: listingId },
      order: [['posted_at', 'DESC']],
    });
  }

  async respond(workspaceId: string, listingId: string, reviewId: string, body: string) {
    const review = await this.models.LocalReview.findOne({
      where: { id: reviewId, workspace_id: workspaceId, listing_id: listingId },
    });
    if (!review) throw new NotFoundError('Review not found');
    const listing = await this.models.LocalListing.findByPk(listingId);
    if (!listing) throw new NotFoundError('Listing not found');

    const res = await this.driver.postReply(listing.provider_account_id, review.provider_review_id, body);
    if (!res.ok) throw new Error('Provider rejected reply');
    await review.update({ response_body: body, responded_at: new Date() });
    return review;
  }
}
