import type { Sequelize } from 'sequelize';
import { defineNotification } from './notification.model.js';
import { defineNotificationPreference } from './preference.model.js';

export function initModels(sequelize: Sequelize) {
  const Notification = defineNotification(sequelize);
  const NotificationPreference = defineNotificationPreference(sequelize);
  return { Notification, NotificationPreference };
}

export type Models = ReturnType<typeof initModels>;
