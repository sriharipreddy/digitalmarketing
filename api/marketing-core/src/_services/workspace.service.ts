import type { Models } from '../models/index.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@marketing/shared-middleware';

export class WorkspaceService {
  constructor(private models: Models) {}

  /** Workspaces the user is an active member of (or owns). */
  async listForUser(userId: string) {
    const { WorkspaceMember, Workspace } = this.models;
    const memberships = await WorkspaceMember.findAll({
      where: { user_id: userId, status: 'active' },
      include: [{ model: Workspace, as: 'workspace' }],
      order: [['created_at', 'ASC']],
    });
    return memberships
      .map((m: any) => ({
        membership_id: m.id,
        role: m.role,
        joined_at: m.joined_at,
        workspace: this.publicWorkspace(m.workspace),
      }))
      .filter((m) => m.workspace !== null);
  }

  async get(workspaceId: string, userId: string) {
    const membership = await this.requireMember(workspaceId, userId);
    const workspace = await this.models.Workspace.findByPk(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace not found');
    return {
      workspace: this.publicWorkspace(workspace),
      role: membership.role,
    };
  }

  async update(
    workspaceId: string,
    userId: string,
    patch: {
      name?: string;
      timezone?: string;
      industry?: string;
      country?: string;
      logo_url?: string;
    },
  ) {
    const membership = await this.requireMember(workspaceId, userId);
    if (membership.role !== 'owner' && membership.role !== 'editor') {
      throw new ForbiddenError('Only owners and editors may edit workspace settings');
    }
    const workspace = await this.models.Workspace.findByPk(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace not found');

    const clean: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      if (patch.name.trim().length < 2) {
        throw new ValidationError('Invalid workspace name', { name: ['Must be at least 2 characters'] });
      }
      clean.name = patch.name.trim();
    }
    if (patch.timezone !== undefined) clean.timezone = patch.timezone;
    if (patch.industry !== undefined) clean.industry = patch.industry;
    if (patch.country !== undefined) clean.country = patch.country;
    if (patch.logo_url !== undefined) clean.logo_url = patch.logo_url;

    if (Object.keys(clean).length === 0) {
      return { workspace: this.publicWorkspace(workspace), role: membership.role };
    }
    await workspace.update(clean);
    return { workspace: this.publicWorkspace(workspace), role: membership.role };
  }

  /** Soft-delete: owners only. Marks status=pending_deletion. */
  async requestDeletion(workspaceId: string, userId: string) {
    const membership = await this.requireMember(workspaceId, userId);
    if (membership.role !== 'owner') {
      throw new ForbiddenError('Only the workspace owner may delete the workspace');
    }
    const workspace = await this.models.Workspace.findByPk(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace not found');
    if (workspace.status === 'pending_deletion' || workspace.status === 'deleted') {
      return { workspace: this.publicWorkspace(workspace) };
    }
    await workspace.update({ status: 'pending_deletion' });
    return { workspace: this.publicWorkspace(workspace) };
  }

  /** Throws ForbiddenError if user is not an active member of workspace. */
  async requireMember(workspaceId: string, userId: string) {
    const membership = await this.models.WorkspaceMember.findOne({
      where: { workspace_id: workspaceId, user_id: userId, status: 'active' },
    });
    if (!membership) throw new ForbiddenError('You are not a member of this workspace');
    return membership;
  }

  private publicWorkspace(w: any) {
    if (!w) return null;
    return {
      id: w.id,
      name: w.name,
      slug: w.slug,
      domain: w.domain,
      industry: w.industry,
      country: w.country,
      timezone: w.timezone,
      logo_url: w.logo_url,
      plan_id: w.plan_id,
      status: w.status,
      trial_ends_at: w.trial_ends_at,
      region: w.region,
      created_at: w.created_at,
    };
  }
}
