import type { Models } from '../models/index.js';
import type { AsoDriver } from './aso.driver.js';
import type { AppPlatform } from '../models/app-listing.model.js';
import { NotFoundError } from '@marketing/shared-middleware';

export class AsoService {
  constructor(private models: Models, private driver: AsoDriver) {}

  async list(workspaceId: string) {
    return this.models.AppListing.findAll({
      where: { workspace_id: workspaceId },
      order: [['created_at', 'DESC']],
    });
  }

  async track(workspaceId: string, platform: AppPlatform, appExternalId: string) {
    const snap = await this.driver.fetch(platform, appExternalId);
    const [row] = await this.models.AppListing.findOrCreate({
      where: { workspace_id: workspaceId, platform, app_external_id: appExternalId },
      defaults: {
        workspace_id: workspaceId,
        platform,
        app_external_id: appExternalId,
        ...snap,
        last_sync_at: new Date(),
      } as any,
    });
    await row.update({ ...snap, last_sync_at: new Date() });
    return row;
  }

  async sync(workspaceId: string, appId: string) {
    const row = await this.models.AppListing.findOne({ where: { id: appId, workspace_id: workspaceId } });
    if (!row) throw new NotFoundError('App listing not found');
    const snap = await this.driver.fetch(row.platform, row.app_external_id);
    await row.update({ ...snap, last_sync_at: new Date() });
    return row;
  }

  async remove(workspaceId: string, appId: string) {
    const row = await this.models.AppListing.findOne({ where: { id: appId, workspace_id: workspaceId } });
    if (!row) throw new NotFoundError('App listing not found');
    await row.destroy();
  }
}
