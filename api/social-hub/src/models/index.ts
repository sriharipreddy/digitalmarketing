import type { Sequelize } from 'sequelize';
import { defineSocialAccount } from './account.model.js';
import { defineSocialPost } from './post.model.js';

export function initModels(sequelize: Sequelize) {
  const SocialAccount = defineSocialAccount(sequelize);
  const SocialPost = defineSocialPost(sequelize, { SocialAccount });

  SocialAccount.hasMany(SocialPost, { foreignKey: 'account_id', as: 'posts' });
  SocialPost.belongsTo(SocialAccount, { foreignKey: 'account_id', as: 'account' });

  return { SocialAccount, SocialPost };
}

export type Models = ReturnType<typeof initModels>;
