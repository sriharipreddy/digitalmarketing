import axios, { type AxiosInstance } from 'axios';

export interface Recommendation {
  id: string;
  category: string;
  title: string;
  body: string;
  confidence: 'low' | 'medium' | 'high';
}

export class IntelligenceClient {
  private http: AxiosInstance;
  constructor(baseUrl: string) {
    this.http = axios.create({ baseURL: baseUrl, timeout: 15_000 });
  }

  async scan(workspace_id: string, userJwt: string): Promise<Recommendation[]> {
    const res = await this.http.post(
      `/api/v1/intelligence/workspaces/${workspace_id}/autopilot/scan`,
      {},
      { headers: { Authorization: `Bearer ${userJwt}` } },
    );
    return res.data.data.recommendations;
  }
}
