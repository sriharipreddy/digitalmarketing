import type { Sequelize } from 'sequelize';
import { defineBrandVoice } from './brand-voice.model.js';
import { defineGeneration } from './generation.model.js';
import { defineContentPiece } from './content-piece.model.js';

export function initModels(sequelize: Sequelize) {
  const BrandVoice = defineBrandVoice(sequelize);
  const Generation = defineGeneration(sequelize);
  const ContentPiece = defineContentPiece(sequelize);
  return { BrandVoice, Generation, ContentPiece };
}

export type Models = ReturnType<typeof initModels>;
