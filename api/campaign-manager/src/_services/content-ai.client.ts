import axios, { type AxiosInstance } from 'axios';

export interface GenerateInput {
  kind: 'blog' | 'social' | 'email' | 'ad_copy' | 'headline';
  prompt: string;
  brand_voice_id?: string;
}

export interface GenerateResult {
  generation_id: string;
  kind: string;
  output: string;
  total_tokens: number;
  cost_usd: number;
}

/**
 * Orchestrator clients forward the user's JWT verbatim — every service
 * shares JWT_SECRET so they all accept the same dashboard token. This
 * keeps the workspace + role checks identical to a direct dashboard call.
 */
export class ContentAiClient {
  private http: AxiosInstance;
  constructor(baseUrl: string) {
    this.http = axios.create({ baseURL: baseUrl, timeout: 60_000 });
  }

  async generate(workspace_id: string, userJwt: string, input: GenerateInput): Promise<GenerateResult> {
    const res = await this.http.post(
      `/api/v1/content/workspaces/${workspace_id}/generate`,
      input,
      { headers: { Authorization: `Bearer ${userJwt}` } },
    );
    const g = res.data.data.generation;
    return {
      generation_id: g.id,
      kind: g.kind,
      output: g.output,
      total_tokens: g.total_tokens,
      cost_usd: g.cost_usd,
    };
  }

  async savePiece(
    workspace_id: string,
    userJwt: string,
    body: { generation_id: string; title?: string },
  ): Promise<{ piece_id: string; title: string }> {
    const res = await this.http.post(
      `/api/v1/content/workspaces/${workspace_id}/pieces/from-generation`,
      body,
      { headers: { Authorization: `Bearer ${userJwt}` } },
    );
    return { piece_id: res.data.data.piece.id, title: res.data.data.piece.title };
  }
}
