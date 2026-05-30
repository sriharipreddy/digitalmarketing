import axios, { type AxiosInstance } from 'axios';
import { mintServiceToken } from './service-jwt.js';

export interface EmailSendInput {
  workspace_id: string;
  template_id?: string;
  subject: string;
  html: string;
  text: string;
  list_id?: string;
  inline_filter?: {
    tag_includes?: string[];
    tag_excludes?: string[];
    lifecycle_in?: string[];
  };
  utm?: { source: string; medium: string; campaign: string };
}

export interface EmailSendResult {
  send_id: string;
  audience_size: number;
  status: 'queued' | 'sending' | 'completed' | 'failed';
}

export class EmailHubClient {
  private http: AxiosInstance;

  constructor(
    baseUrl: string,
    private jwtSecret: string,
    private from: string,
  ) {
    this.http = axios.create({ baseURL: baseUrl, timeout: 30_000 });
  }

  async send(workspace_id: string, body: EmailSendInput): Promise<EmailSendResult> {
    const token = mintServiceToken({
      jwtSecret: this.jwtSecret,
      from: this.from,
      to: 'email-hub',
      workspace_id,
    });
    // workspace_id lives in the URL; strip from the body so email-hub's Joi schema accepts it.
    const { workspace_id: _wsId, template_id: _tplId, ...rest } = body as any;
    void _wsId;
    void _tplId;
    const res = await this.http.post(`/api/v1/email/internal/workspaces/${workspace_id}/sends`, rest, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data.data;
  }
}
