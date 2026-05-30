import type { Sequelize } from 'sequelize';
import { defineAffiliateProgram } from './program.model.js';
import { defineAffiliate } from './affiliate.model.js';
import { defineTrackingLink } from './tracking-link.model.js';
import { defineCommission } from './commission.model.js';

export function initModels(sequelize: Sequelize) {
  const AffiliateProgram = defineAffiliateProgram(sequelize);
  const Affiliate = defineAffiliate(sequelize, { AffiliateProgram });
  const TrackingLink = defineTrackingLink(sequelize, { Affiliate });
  const Commission = defineCommission(sequelize, { Affiliate });

  AffiliateProgram.hasMany(Affiliate, { foreignKey: 'program_id', as: 'affiliates' });
  Affiliate.belongsTo(AffiliateProgram, { foreignKey: 'program_id', as: 'program' });
  Affiliate.hasMany(TrackingLink, { foreignKey: 'affiliate_id', as: 'tracking_links' });
  Affiliate.hasMany(Commission, { foreignKey: 'affiliate_id', as: 'commissions' });
  TrackingLink.belongsTo(Affiliate, { foreignKey: 'affiliate_id', as: 'affiliate' });
  Commission.belongsTo(Affiliate, { foreignKey: 'affiliate_id', as: 'affiliate' });

  return { AffiliateProgram, Affiliate, TrackingLink, Commission };
}

export type Models = ReturnType<typeof initModels>;
