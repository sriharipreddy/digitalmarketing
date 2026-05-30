import crypto from 'node:crypto';

export interface ImportedContact {
  email: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  company?: string | null;
  tags?: string[];
  source_extras?: Record<string, unknown>;
}

export interface ImportDriver {
  /** Stream a batch of contacts from the source. Implementations should paginate
   * internally and return an empty array when there are no more. */
  fetchContactsBatch(cursor: string | null): Promise<{ rows: ImportedContact[]; nextCursor: string | null }>;
}

/**
 * HubSpot OAuth contacts importer — calls /crm/v3/objects/contacts with the
 * required scopes (`crm.objects.contacts.read`). Cursor is a HubSpot `after` token.
 */
export class HubSpotImportDriver implements ImportDriver {
  constructor(private accessToken: string, private pageSize: number = 100) {}

  async fetchContactsBatch(cursor: string | null) {
    const url = new URL('https://api.hubapi.com/crm/v3/objects/contacts');
    url.searchParams.set('limit', String(this.pageSize));
    url.searchParams.set('properties', 'email,firstname,lastname,phone,company');
    if (cursor) url.searchParams.set('after', cursor);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) throw new Error(`hubspot_${res.status}`);
    const j = (await res.json()) as {
      results: Array<{ id: string; properties: Record<string, string | null> }>;
      paging?: { next?: { after: string } };
    };
    const rows: ImportedContact[] = j.results.map((r) => ({
      email: r.properties.email ?? null,
      first_name: r.properties.firstname ?? null,
      last_name: r.properties.lastname ?? null,
      phone: r.properties.phone ?? null,
      company: r.properties.company ?? null,
      source_extras: { hubspot_id: r.id },
    }));
    return { rows, nextCursor: j.paging?.next?.after ?? null };
  }
}

/**
 * Mailchimp audience-members importer. Cursor is `offset`.
 */
export class MailchimpImportDriver implements ImportDriver {
  constructor(
    private apiKey: string,
    private dc: string,
    private audienceId: string,
    private pageSize: number = 100,
  ) {}

  async fetchContactsBatch(cursor: string | null) {
    const offset = cursor ? parseInt(cursor, 10) : 0;
    const url = new URL(`https://${this.dc}.api.mailchimp.com/3.0/lists/${this.audienceId}/members`);
    url.searchParams.set('count', String(this.pageSize));
    url.searchParams.set('offset', String(offset));
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${Buffer.from(`anystring:${this.apiKey}`).toString('base64')}` },
    });
    if (!res.ok) throw new Error(`mailchimp_${res.status}`);
    const j = (await res.json()) as {
      members: Array<{ email_address: string; merge_fields: Record<string, string>; tags: Array<{ name: string }> }>;
      total_items: number;
    };
    const rows: ImportedContact[] = j.members.map((m) => ({
      email: m.email_address,
      first_name: m.merge_fields.FNAME ?? null,
      last_name: m.merge_fields.LNAME ?? null,
      phone: m.merge_fields.PHONE ?? null,
      company: m.merge_fields.COMPANY ?? null,
      tags: m.tags?.map((t) => t.name) ?? [],
    }));
    const next = offset + rows.length < j.total_items ? String(offset + rows.length) : null;
    return { rows, nextCursor: next };
  }
}

/**
 * Klaviyo profiles importer. Cursor is the `page[cursor]` token.
 */
export class KlaviyoImportDriver implements ImportDriver {
  constructor(private apiKey: string, private pageSize: number = 100) {}

  async fetchContactsBatch(cursor: string | null) {
    const url = new URL('https://a.klaviyo.com/api/profiles');
    url.searchParams.set('page[size]', String(this.pageSize));
    if (cursor) url.searchParams.set('page[cursor]', cursor);
    const res = await fetch(url, {
      headers: {
        Authorization: `Klaviyo-API-Key ${this.apiKey}`,
        revision: '2024-10-15',
      },
    });
    if (!res.ok) throw new Error(`klaviyo_${res.status}`);
    const j = (await res.json()) as {
      data: Array<{ attributes: { email: string; first_name: string | null; last_name: string | null; phone_number: string | null; organization: string | null } }>;
      links?: { next?: string };
    };
    const rows: ImportedContact[] = j.data.map((d) => ({
      email: d.attributes.email,
      first_name: d.attributes.first_name,
      last_name: d.attributes.last_name,
      phone: d.attributes.phone_number,
      company: d.attributes.organization,
    }));
    let nextCursor: string | null = null;
    if (j.links?.next) {
      try {
        nextCursor = new URL(j.links.next).searchParams.get('page[cursor]');
      } catch { /* swallow */ }
    }
    return { rows, nextCursor };
  }
}

/** Deterministic stub for development. */
export class StubImportDriver implements ImportDriver {
  constructor(private source: string, private count = 5) {}

  async fetchContactsBatch(cursor: string | null) {
    if (cursor === 'done') return { rows: [], nextCursor: null };
    const rows: ImportedContact[] = [];
    for (let i = 0; i < this.count; i++) {
      const id = crypto.randomUUID().slice(0, 8);
      rows.push({
        email: `${this.source}-${id}@example.test`,
        first_name: `First${i}`,
        last_name: `Last${i}`,
        tags: [this.source],
      });
    }
    return { rows, nextCursor: 'done' };
  }
}
