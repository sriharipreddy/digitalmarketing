import crypto from 'node:crypto';

export interface ProviderReview {
  provider_review_id: string;
  author_name: string | null;
  rating: number;
  body: string | null;
  posted_at: Date;
}

/**
 * Abstract local-listing provider (GMB, Apple Maps, Bing Places, Yelp).
 * Implementations live behind an interface so we can stub during dev / tests
 * and swap in real providers in production without touching service code.
 */
export interface LocalListingDriver {
  fetchReviews(providerAccountId: string): Promise<ProviderReview[]>;
  postReply(providerAccountId: string, providerReviewId: string, body: string): Promise<{ ok: boolean }>;
}

/**
 * Deterministic stub used in dev / tests. Returns a synthetic review set
 * derived from the account id so the same input always yields the same output.
 */
export class StubLocalListingDriver implements LocalListingDriver {
  async fetchReviews(providerAccountId: string): Promise<ProviderReview[]> {
    const seed = crypto.createHash('sha256').update(providerAccountId).digest();
    const count = (seed[0] ?? 0) % 5;
    const out: ProviderReview[] = [];
    for (let i = 0; i < count; i++) {
      const ratingByte = seed[i + 1] ?? 0;
      const rating = (ratingByte % 5) + 1;
      out.push({
        provider_review_id: `stub-${providerAccountId}-${i}`,
        author_name: `Reviewer ${i + 1}`,
        rating,
        body: rating >= 4 ? 'Great service.' : rating === 3 ? 'Average.' : 'Could be better.',
        posted_at: new Date(Date.now() - i * 86_400_000),
      });
    }
    return out;
  }

  async postReply(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}
