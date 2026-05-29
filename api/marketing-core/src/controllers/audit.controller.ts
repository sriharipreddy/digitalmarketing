import type { Request, Response, NextFunction } from 'express';
import type { AuditService } from '../_services/audit.service.js';
import type { WorkspaceService } from '../_services/workspace.service.js';

export class AuditController {
  constructor(
    private auditService: AuditService,
    private workspaceService: WorkspaceService,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const workspace_id = req.params.workspace_id as string;
      // Permission check: requester must be an active member of the workspace
      await this.workspaceService.requireMember(workspace_id, req.user!.id);

      const limit = parseInt((req.query.limit as string) ?? '50', 10);
      const offset = parseInt((req.query.offset as string) ?? '0', 10);
      const action = req.query.action as string | undefined;
      const target_type = req.query.target_type as string | undefined;

      const result = await this.auditService.list({
        workspace_id,
        limit: Number.isFinite(limit) ? limit : 50,
        offset: Number.isFinite(offset) ? offset : 0,
        action,
        target_type,
      });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
