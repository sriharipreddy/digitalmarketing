import type { Sequelize } from 'sequelize';
import { defineInfluencer } from './influencer.model.js';
import { defineOutreach } from './outreach.model.js';

export function initModels(sequelize: Sequelize) {
  const Influencer = defineInfluencer(sequelize);
  const Outreach = defineOutreach(sequelize, { Influencer });

  Influencer.hasMany(Outreach, { foreignKey: 'influencer_id', as: 'outreaches' });
  Outreach.belongsTo(Influencer, { foreignKey: 'influencer_id', as: 'influencer' });

  return { Influencer, Outreach };
}

export type Models = ReturnType<typeof initModels>;
