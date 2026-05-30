import type { Sequelize } from 'sequelize';
import { BadRequestError } from '@marketing/shared-middleware';

export interface CapsByPlan {
  free: number;
  starter: number;
  pro: number;
  agency: number;
}

export class TokenCapService {
  constructor(
    private sequelize: Sequelize,
    private caps: CapsByPlan,
  ) {}

  /**
   * Look up today's used tokens for a workspace by SUM-ing content_generations
   * created today. Returns true if the workspace is under its cap. Throws if not.
   *
   * We size the cap by reading the workspace's plan slug from core_plans.
   * Cross-service read is fine here because we're sharing a database.
   */
  async assertWithinDailyCap(workspaceId: string): Promise<{ used: number; cap: number; plan_slug: string }> {
    const [planRow]: any = await this.sequelize.query(
      `SELECT p.slug
         FROM core_workspaces w
         LEFT JOIN core_plans p ON p.id = w.plan_id
        WHERE w.id = :ws
        LIMIT 1`,
      { replacements: { ws: workspaceId }, type: 'SELECT' as any },
    );
    const plan_slug = (planRow?.slug as string) ?? 'free';
    const cap = (this.caps as any)[plan_slug] ?? this.caps.free;

    const startOfDayUtc = new Date();
    startOfDayUtc.setUTCHours(0, 0, 0, 0);

    const [usedRow]: any = await this.sequelize.query(
      `SELECT COALESCE(SUM(total_tokens), 0) AS used
         FROM content_generations
        WHERE workspace_id = :ws
          AND created_at >= :since`,
      { replacements: { ws: workspaceId, since: startOfDayUtc }, type: 'SELECT' as any },
    );
    const used = Number(usedRow?.used ?? 0);

    if (used >= cap) {
      throw new BadRequestError(
        `Daily AI token cap reached for plan "${plan_slug}" (${used.toLocaleString()} / ${cap.toLocaleString()}). Resets at 00:00 UTC.`,
        'ai_quota_exceeded',
        { plan_slug, used, cap },
      );
    }
    return { used, cap, plan_slug };
  }
}
