import type { Sequelize } from 'sequelize';
import { defineApiKey } from './api-key.model.js';
import { defineWebhook } from './webhook.model.js';
import { defineWebhookDelivery } from './delivery.model.js';
import { defineDataImport } from './import.model.js';
import { defineDataExport } from './export.model.js';

export function initModels(sequelize: Sequelize) {
  const ApiKey = defineApiKey(sequelize);
  const Webhook = defineWebhook(sequelize);
  const WebhookDelivery = defineWebhookDelivery(sequelize, { Webhook });
  const DataImport = defineDataImport(sequelize);
  const DataExport = defineDataExport(sequelize);

  Webhook.hasMany(WebhookDelivery, { foreignKey: 'webhook_id', as: 'deliveries' });
  WebhookDelivery.belongsTo(Webhook, { foreignKey: 'webhook_id', as: 'webhook' });

  return { ApiKey, Webhook, WebhookDelivery, DataImport, DataExport };
}

export type Models = ReturnType<typeof initModels>;
