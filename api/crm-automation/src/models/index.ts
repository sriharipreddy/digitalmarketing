import type { Sequelize } from 'sequelize';
import { defineContact } from './contact.model.js';
import { defineLeadForm } from './form.model.js';
import { defineSegment } from './segment.model.js';
import { defineNpsResponse } from './nps.model.js';
import { defineRfmScore } from './rfm.model.js';

export function initModels(sequelize: Sequelize) {
  const Contact = defineContact(sequelize);
  const LeadForm = defineLeadForm(sequelize);
  const Segment = defineSegment(sequelize);
  const NpsResponse = defineNpsResponse(sequelize);
  const RfmScore = defineRfmScore(sequelize);
  return { Contact, LeadForm, Segment, NpsResponse, RfmScore };
}

export type Models = ReturnType<typeof initModels>;
