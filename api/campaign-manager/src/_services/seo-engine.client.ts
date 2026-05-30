import axios, { type AxiosInstance } from 'axios';

export interface KeywordResult {
  keyword: string;
  search_volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  intent: string | null;
}

export class SeoEngineClient {
  private http: AxiosInstance;
  constructor(baseUrl: string) {
    this.http = axios.create({ baseURL: baseUrl, timeout: 30_000 });
  }

  async research(
    workspace_id: string,
    userJwt: string,
    body: { seed: string; country?: string; limit?: number },
  ): Promise<KeywordResult[]> {
    const res = await this.http.post(
      `/api/v1/seo/workspaces/${workspace_id}/keywords/research`,
      body,
      { headers: { Authorization: `Bearer ${userJwt}` } },
    );
    return res.data.data.results;
  }

  async save(workspace_id: string, userJwt: string, items: KeywordResult[]): Promise<number> {
    const res = await this.http.post(
      `/api/v1/seo/workspaces/${workspace_id}/keywords`,
      { items },
      { headers: { Authorization: `Bearer ${userJwt}` } },
    );
    return res.data.data.saved;
  }
}
