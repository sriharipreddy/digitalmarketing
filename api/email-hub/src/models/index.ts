import type { Sequelize } from 'sequelize';
import { defineEmailList } from './list.model.js';
import { defineEmailSend } from './send.model.js';
import { defineEmailEvent } from './event.model.js';
import { defineMessage, defineMessagingSuppression } from './messaging.model.js';

export function initModels(sequelize: Sequelize) {
  const EmailList = defineEmailList(sequelize);
  const EmailSend = defineEmailSend(sequelize);
  const EmailEvent = defineEmailEvent(sequelize);
  const Message = defineMessage(sequelize);
  const MessagingSuppression = defineMessagingSuppression(sequelize);

  EmailSend.hasMany(EmailEvent, { foreignKey: 'send_id', as: 'events' });
  EmailEvent.belongsTo(EmailSend, { foreignKey: 'send_id', as: 'send' });

  return { EmailList, EmailSend, EmailEvent, Message, MessagingSuppression };
}

export type Models = ReturnType<typeof initModels>;
