import crypto from 'node:crypto';
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

  /**
   * Create a workspace and add the caller as its owner. Used by the dashboard
   * when a signed-in user has no memberships yet (e.g. seeded platform admins,
   * or anyone who registered without a workspace at sign-up).
   */
  async create(userId: string, input: { name: string; timezone?: string; country?: string; industry?: string }) {
    const name = input.name?.trim() ?? '';
    if (name.length < 2) {
      throw new ValidationError('Invalid workspace name', { name: ['Must be at least 2 characters'] });
    }
    const { Workspace, WorkspaceMember, Plan } = this.models;

    const transaction = await Workspace.sequelize!.transaction();
    try {
      const freePlan = await Plan.findOne({ where: { slug: 'free' }, transaction });
      const slug = await this.uniqueSlug(this.toSlug(name), transaction);
      const workspace = await Workspace.create(
        {
          name,
          slug,
          owner_id: userId,
          plan_id: freePlan?.id ?? null,
          status: 'trial',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          timezone: input.timezone ?? 'UTC',
          country: input.country ?? null,
          industry: input.industry ?? null,
        } as any,
        { transaction },
      );
      await WorkspaceMember.create(
        {
          workspace_id: workspace.id,
          user_id: userId,
          role: 'owner',
          status: 'active',
          joined_at: new Date(),
        } as any,
        { transaction },
      );
      await transaction.commit();
      return { workspace: this.publicWorkspace(workspace), role: 'owner' as const };
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  /** Throws ForbiddenError if user is not an active member of workspace. */
  async requireMember(workspaceId: string, userId: string) {
    const membership = await this.models.WorkspaceMember.findOne({
      where: { workspace_id: workspaceId, user_id: userId, status: 'active' },
    });
    if (!membership) throw new ForbiddenError('You are not a member of this workspace');
    return membership;
  }

  private toSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
  }

  private async uniqueSlug(base: string, transaction: any): Promise<string> {
    if (!base) base = 'workspace';
    let candidate = base;
    for (let i = 1; i < 100; i++) {
      const existing = await this.models.Workspace.findOne({ where: { slug: candidate }, transaction });
      if (!existing) return candidate;
      candidate = `${base}-${i}`;
    }
    return `${base}-${crypto.randomBytes(3).toString('hex')}`;
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
