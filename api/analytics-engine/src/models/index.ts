import type { Sequelize } from 'sequelize';
import { defineAnalyticsEvent } from './event.model.js';
import { defineConversionGoal } from './goal.model.js';

export function initModels(sequelize: Sequelize) {
  const AnalyticsEvent = defineAnalyticsEvent(sequelize);
  const ConversionGoal = defineConversionGoal(sequelize);
  return { AnalyticsEvent, ConversionGoal };
}

export type Models = ReturnType<typeof initModels>;
