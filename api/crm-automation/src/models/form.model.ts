import { DataTypes, Model, type Sequelize } from 'sequelize';

export interface FormFieldSpec {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox';
  required?: boolean;
  options?: string[];
}

export class LeadForm extends Model {
  declare id: string;
  declare workspace_id: string;
  declare slug: string;
  declare name: string;
  declare description: string | null;
  declare fields: FormFieldSpec[];
  declare on_submit_tags: string[] | null;
  declare on_submit_lifecycle: 'subscriber' | 'lead' | 'mql' | null;
  declare success_message: string;
  declare is_active: boolean;
  declare submission_count: number;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineLeadForm(sequelize: Sequelize) {
  LeadForm.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      slug: { type: DataTypes.STRING(64), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.STRING(1000), allowNull: true },
      fields: { type: DataTypes.JSON, allowNull: false },
      on_submit_tags: { type: DataTypes.JSON, allowNull: true },
      on_submit_lifecycle: {
        type: DataTypes.ENUM('subscriber', 'lead', 'mql'),
        allowNull: true,
      },
      success_message: {
        type: DataTypes.STRING(500),
        allowNull: false,
        defaultValue: 'Thanks — we\'ll be in touch shortly.',
      },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      submission_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: 'LeadForm',
      tableName: 'crm_forms',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace_slug', unique: true, fields: ['workspace_id', 'slug'] },
        { name: 'uk_slug_global', unique: true, fields: ['slug'] },
        { name: 'idx_workspace', fields: ['workspace_id'] },
      ],
    },
  );
  return LeadForm;
}
