import type { AdPlatform } from '../models/competitor-ad.model.js';

export interface CompetitorAnalysisResult {
  description: string;
  industry: string;
  est_monthly_traffic: number;
  est_employee_count: string;
  social_handles: Record<string, string>;
  strengths: string[];
  weaknesses: string[];
}

export interface AdSpyResult {
  platform: AdPlatform;
  external_id: string;
  creative_url: string | null;
  headline: string;
  body: string;
  landing_url: string;
  first_seen_at: Date;
  last_seen_at: Date;
  est_spend_usd: number;
  est_impressions: number;
}

export interface IntelligenceDriver {
  analyzeCompetitor(domain: string, name: string): Promise<CompetitorAnalysisResult>;
  spyAds(domain: string, platform: AdPlatform, limit: number): Promise<AdSpyResult[]>;
}

/**
 * Stub — deterministic synthetic data so the UI flow works without paid
 * SimilarWeb/SEMrush feeds. Swap with `RealIntelligenceDriver` that fans out
 * to Meta Ad Library, Google Ads Transparency Center, etc.
 */
export class StubIntelligenceDriver implements IntelligenceDriver {
  async analyzeCompetitor(domain: string, name: string): Promise<CompetitorAnalysisResult> {
    const seed = simpleHash(domain);
    const traffic = 50_000 + (seed % 5_000_000);
    return {
      description: `${name} is a leading SaaS company in the ${categorise(seed)} space, focused on enterprise customers.`,
      industry: categorise(seed),
      est_monthly_traffic: traffic,
      est_employee_count: bucketEmployees(seed),
      social_handles: {
        twitter: `@${slug(name)}`,
        linkedin: `linkedin.com/company/${slug(name)}`,
        youtube: `youtube.com/@${slug(name)}`,
      },
      strengths: [
        'Strong organic SEO presence',
        'Clear positioning + landing page',
        'Active content marketing',
      ].slice(0, 2 + (seed % 2)),
      weaknesses: [
        'Underinvested in paid social',
        'Slower mobile experience',
        'Limited integrations ecosystem',
      ].slice(0, 2 + (seed % 2)),
    };
  }

  async spyAds(domain: string, platform: AdPlatform, limit: number): Promise<AdSpyResult[]> {
    const ads: AdSpyResult[] = [];
    for (let i = 0; i < limit; i++) {
      const seed = simpleHash(`${domain}_${platform}_${i}`);
      const firstSeen = new Date(Date.now() - (30 + (seed % 60)) * 24 * 60 * 60 * 1000);
      const lastSeen = new Date(Date.now() - (seed % 7) * 24 * 60 * 60 * 1000);
      ads.push({
        platform,
        external_id: `${platform}_${domain}_${i}_${seed}`,
        creative_url: `https://picsum.photos/seed/${platform}_${seed}/600/600`,
        headline: pickHeadline(seed),
        body: pickBody(seed),
        landing_url: `https://${domain}/${slug(pickHeadline(seed))}`,
        first_seen_at: firstSeen,
        last_seen_at: lastSeen,
        est_spend_usd: 500 + (seed % 50_000),
        est_impressions: 10_000 + (seed % 5_000_000),
      });
    }
    return ads;
  }
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function categorise(seed: number): string {
  const cats = ['marketing automation', 'analytics', 'CRM', 'content management', 'sales enablement'];
  return cats[seed % cats.length]!;
}

function bucketEmployees(seed: number): string {
  const buckets = ['1-10', '11-50', '51-200', '201-1000', '1001-5000'];
  return buckets[seed % buckets.length]!;
}

function pickHeadline(seed: number): string {
  const headlines = [
    'Cut your CAC by 40% in 90 days',
    'The marketing OS for growing teams',
    'AI that writes copy that converts',
    'Get a free demo this month',
    'Built for SaaS marketers',
    'Scale your campaigns without scaling headcount',
  ];
  return headlines[seed % headlines.length]!;
}

function pickBody(seed: number): string {
  const bodies = [
    'See how 5,000+ teams use us to plan and ship multi-channel campaigns.',
    'No more switching tabs. One platform for content, ads, and analytics.',
    'Try our AI campaign builder free for 14 days. No credit card required.',
    'Real attribution. Real ROI. Real results from real customers.',
  ];
  return bodies[seed % bodies.length]!;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}
