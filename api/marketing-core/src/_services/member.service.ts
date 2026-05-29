import crypto from 'node:crypto';
import type { Sequelize } from 'sequelize';
import type { Models } from '../models/index.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BadRequestError,
} from '@marketing/shared-middleware';
import type { MemberRole } from '@marketing/shared-types';

const VALID_ROLES: MemberRole[] = ['owner', 'editor', 'analyst', 'viewer'];
const INVITE_TTL_DAYS = 7;

export class MemberService {
  constructor(
    private sequelize: Sequelize,
    private models: Models,
  ) {}

  async list(workspaceId: string, requesterUserId: string) {
    await this.requireMember(workspaceId, requesterUserId);
    const { WorkspaceMember, User } = this.models;
    const members = await WorkspaceMember.findAll({
      where: { workspace_id: workspaceId },
      include: [{ model: User, as: 'user' }],
      order: [['created_at', 'ASC']],
    });
    return members.map((m: any) => this.publicMember(m));
  }

  async invite(
    workspaceId: string,
    requesterUserId: string,
    input: { email: string; role: MemberRole; full_name?: string },
  ): Promise<{ member: any; invite_token: string }> {
    const requester = await this.requireMember(workspaceId, requesterUserId);
    if (requester.role !== 'owner' && requester.role !== 'editor') {
      throw new ForbiddenError('Only owners and editors may invite members');
    }
    if (!VALID_ROLES.includes(input.role)) {
      throw new ValidationError('Invalid role', { role: [`Must be one of: ${VALID_ROLES.join(', ')}`] });
    }
    if (input.role === 'owner') {
      throw new ForbiddenError('Use transfer-ownership instead of inviting a second owner');
    }

    const { User, WorkspaceMember } = this.models;
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const memberId = await this.sequelize.transaction(async (t) => {
      let invitedUser = await User.findOne({ where: { user_email: input.email }, transaction: t });
      if (!invitedUser) {
        invitedUser = await User.create(
          {
            full_name: input.full_name ?? input.email.split('@')[0],
            user_email: input.email,
            type: 'team_member',
            status: 'invited',
            email_verified: false,
          } as any,
          { transaction: t },
        );
      }

      const existing = await WorkspaceMember.findOne({
        where: { workspace_id: workspaceId, user_id: invitedUser.id },
        transaction: t,
      });
      if (existing) {
        if (existing.status === 'active') {
          throw new BadRequestError('This user is already an active member');
        }
        await existing.update(
          {
            role: input.role,
            invited_by: requesterUserId,
            invite_token: inviteToken,
            invite_expires_at: expiresAt,
            status: 'invited',
          } as any,
          { transaction: t },
        );
        return existing.id;
      }

      const created = await WorkspaceMember.create(
        {
          workspace_id: workspaceId,
          user_id: invitedUser.id,
          role: input.role,
          invited_by: requesterUserId,
          invite_token: inviteToken,
          invite_expires_at: expiresAt,
          status: 'invited',
        } as any,
        { transaction: t },
      );
      return created.id;
    });

    return { member: await this.reload(memberId), invite_token: inviteToken };
  }

  /** Accept an invite — caller must already be logged in as the invited email. */
  async acceptInvite(token: string, acceptingUserId: string) {
    const { WorkspaceMember } = this.models;
    const member = await WorkspaceMember.findOne({ where: { invite_token: token } });
    if (!member) throw new NotFoundError('Invitation not found');
    if (member.status === 'active') throw new BadRequestError('Invitation already accepted');
    if (member.user_id !== acceptingUserId) {
      throw new ForbiddenError('This invitation belongs to a different user');
    }
    if (member.invite_expires_at && member.invite_expires_at < new Date()) {
      throw new BadRequestError('Invitation has expired');
    }
    await member.update({
      status: 'active',
      joined_at: new Date(),
      invite_token: null,
      invite_expires_at: null,
    });
    return this.reload(member.id);
  }

  async updateRole(
    workspaceId: string,
    requesterUserId: string,
    memberId: string,
    newRole: MemberRole,
  ) {
    const requester = await this.requireMember(workspaceId, requesterUserId);
    if (requester.role !== 'owner') {
      throw new ForbiddenError('Only the workspace owner may change member roles');
    }
    if (!VALID_ROLES.includes(newRole)) {
      throw new ValidationError('Invalid role', { role: [`Must be one of: ${VALID_ROLES.join(', ')}`] });
    }
    if (newRole === 'owner') {
      throw new ForbiddenError('Use transfer-ownership endpoint to change owner');
    }

    const member = await this.models.WorkspaceMember.findOne({
      where: { id: memberId, workspace_id: workspaceId },
    });
    if (!member) throw new NotFoundError('Member not found');
    if (member.role === 'owner') {
      throw new ForbiddenError('Cannot demote the owner directly');
    }
    await member.update({ role: newRole });
    return this.reload(member.id);
  }

  async remove(workspaceId: string, requesterUserId: string, memberId: string) {
    const requester = await this.requireMember(workspaceId, requesterUserId);
    const member = await this.models.WorkspaceMember.findOne({
      where: { id: memberId, workspace_id: workspaceId },
    });
    if (!member) throw new NotFoundError('Member not found');

    const isSelf = member.user_id === requesterUserId;
    const isOwnerActing = requester.role === 'owner';

    if (!isSelf && !isOwnerActing) {
      throw new ForbiddenError('Only owners may remove other members');
    }
    if (member.role === 'owner') {
      throw new ForbiddenError('The workspace owner cannot be removed; transfer ownership first');
    }
    await member.destroy();
    return { id: member.id, removed: true };
  }

  async requireMember(workspaceId: string, userId: string) {
    const m = await this.models.WorkspaceMember.findOne({
      where: { workspace_id: workspaceId, user_id: userId, status: 'active' },
    });
    if (!m) throw new ForbiddenError('You are not a member of this workspace');
    return m;
  }

  private async reload(memberId: string) {
    const { WorkspaceMember, User } = this.models;
    const m = await WorkspaceMember.findByPk(memberId, {
      include: [{ model: User, as: 'user' }],
    });
    return this.publicMember(m);
  }

  private publicMember(m: any) {
    if (!m) return null;
    return {
      id: m.id,
      workspace_id: m.workspace_id,
      user_id: m.user_id,
      role: m.role,
      status: m.status,
      joined_at: m.joined_at,
      invited_by: m.invited_by,
      invite_expires_at: m.invite_expires_at,
      created_at: m.created_at,
      user: m.user
        ? {
            id: m.user.id,
            full_name: m.user.full_name,
            email: m.user.user_email,
            avatar_url: m.user.avatar_url,
            status: m.user.status,
          }
        : null,
    };
  }
}
