import crypto from 'node:crypto';
import type { Models } from '../models/index.js';
import { sha256 } from '../_helpers/api-key-auth.js';
import { NotFoundError, ValidationError } from '@marketing/shared-middleware';

export interface CreatedApiKey {
  id: string;
  prefix: string;
  /** Full bearer token — shown ONCE on creation. After this we only store the hash. */
  secret: string;
  name: string;
  scopes: string[];
  expires_at: Date | null;
  created_at: Date;
}

export class ApiKeyService {
  constructor(private models: Models) {}

  async list(workspaceId: string) {
    return this.models.ApiKey.findAll({
      where: { workspace_id: workspaceId },
      order: [['created_at', 'DESC']],
    });
  }

  async create(workspaceId: string, userId: string, input: {
    name: string;
    scopes?: string[];
    expires_at?: Date;
  }): Promise<CreatedApiKey> {
    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError('Invalid name', { name: ['Required'] });
    }
    const prefix = `mk_${crypto.randomBytes(4).toString('hex')}`; // 11 chars total
    const secret = crypto.randomBytes(24).toString('base64url');   // 32 chars
    const fullKey = `${prefix}_${secret}`;
    const hash = sha256(fullKey);

    const created = await this.models.ApiKey.create({
      workspace_id: workspaceId,
      name: input.name.trim(),
      prefix,
      hash,
      scopes: input.scopes ?? [],
      status: 'active',
      expires_at: input.expires_at ?? null,
      created_by: userId,
    } as any);

    return {
      id: created.id,
      prefix,
      secret: fullKey,
      name: created.name,
      scopes: input.scopes ?? [],
      expires_at: created.expires_at,
      created_at: created.created_at,
    };
  }

  async revoke(workspaceId: string, id: string) {
    const key = await this.models.ApiKey.findOne({ where: { id, workspace_id: workspaceId } });
    if (!key) throw new NotFoundError('API key not found');
    await key.update({ status: 'revoked' });
    return key;
  }

  publicApiKey(k: any) {
    return {
      id: k.id,
      workspace_id: k.workspace_id,
      name: k.name,
      prefix: k.prefix,
      scopes: k.scopes,
      status: k.status,
      last_used_at: k.last_used_at,
      expires_at: k.expires_at,
      created_at: k.created_at,
    };
  }
}
