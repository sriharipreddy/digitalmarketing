import type { Sequelize } from 'sequelize';
import { defineCampaign } from './campaign.model.js';
import { defineCampaignChannel } from './channel.model.js';
import { defineUtmLink } from './utm-link.model.js';

export function initModels(sequelize: Sequelize) {
  const Campaign = defineCampaign(sequelize);
  const CampaignChannel = defineCampaignChannel(sequelize, { Campaign });
  const UtmLink = defineUtmLink(sequelize);

  Campaign.hasMany(CampaignChannel, { foreignKey: 'campaign_id', as: 'channels' });
  CampaignChannel.belongsTo(Campaign, { foreignKey: 'campaign_id', as: 'campaign' });

  return { Campaign, CampaignChannel, UtmLink };
}

export type Models = ReturnType<typeof initModels>;
