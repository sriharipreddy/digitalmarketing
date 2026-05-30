import type { Sequelize } from 'sequelize';
import { defineImageGeneration } from './image-generation.model.js';
import { defineVideo } from './video.model.js';

export function initModels(sequelize: Sequelize) {
  const ImageGeneration = defineImageGeneration(sequelize);
  const Video = defineVideo(sequelize);
  return { ImageGeneration, Video };
}

export type Models = ReturnType<typeof initModels>;
