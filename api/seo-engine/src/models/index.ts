import type { Sequelize } from 'sequelize';
import { defineKeyword } from './keyword.model.js';
import { defineLocalListing } from './local-listing.model.js';
import { defineLocalReview } from './review.model.js';
import { defineLocalCitation } from './citation.model.js';
import { defineAppListing } from './app-listing.model.js';

export function initModels(sequelize: Sequelize) {
  const Keyword = defineKeyword(sequelize);
  const LocalListing = defineLocalListing(sequelize);
  const LocalReview = defineLocalReview(sequelize);
  const LocalCitation = defineLocalCitation(sequelize);
  const AppListing = defineAppListing(sequelize);

  LocalListing.hasMany(LocalReview, { foreignKey: 'listing_id', as: 'reviews' });
  LocalReview.belongsTo(LocalListing, { foreignKey: 'listing_id', as: 'listing' });
  LocalListing.hasMany(LocalCitation, { foreignKey: 'listing_id', as: 'citations' });
  LocalCitation.belongsTo(LocalListing, { foreignKey: 'listing_id', as: 'listing' });

  return { Keyword, LocalListing, LocalReview, LocalCitation, AppListing };
}

export type Models = ReturnType<typeof initModels>;
