import type { Sequelize } from 'sequelize';
import { defineCompetitor } from './competitor.model.js';
import { defineCompetitorAd } from './competitor-ad.model.js';
import { defineRecommendation } from './recommendation.model.js';

export function initModels(sequelize: Sequelize) {
  const Competitor = defineCompetitor(sequelize);
  const CompetitorAd = defineCompetitorAd(sequelize, { Competitor });
  const AutopilotRecommendation = defineRecommendation(sequelize);

  Competitor.hasMany(CompetitorAd, { foreignKey: 'competitor_id', as: 'ads' });
  CompetitorAd.belongsTo(Competitor, { foreignKey: 'competitor_id', as: 'competitor' });

  return { Competitor, CompetitorAd, AutopilotRecommendation };
}

export type Models = ReturnType<typeof initModels>;
