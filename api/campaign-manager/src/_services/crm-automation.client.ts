import axios, { type AxiosInstance } from 'axios';

export interface AudiencePreview {
  size: number;
  sample: string[];
}

export class CrmAutomationClient {
  private http: AxiosInstance;
  constructor(baseUrl: string) {
    this.http = axios.create({ baseURL: baseUrl, timeout: 15_000 });
  }

  async listContacts(
    workspace_id: string,
    userJwt: string,
    opts?: { stage?: string; limit?: number },
  ): Promise<number> {
    const res = await this.http.get(`/api/v1/crm/workspaces/${workspace_id}/contacts`, {
      headers: { Authorization: `Bearer ${userJwt}` },
      params: { limit: opts?.limit ?? 1, stage: opts?.stage },
    });
    return res.data.data.total;
  }
}
