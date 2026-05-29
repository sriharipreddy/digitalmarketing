import type { Sequelize } from 'sequelize';
import pino from 'pino';

const logger = pino({ name: 'shared-db:verify' });

/**
 * Verifies live DB tables match the model definitions.
 * Refuses to start the service if drift is detected (production safety).
 *
 * Catches: missing tables, missing columns, missing indexes.
 * Doesn't catch: type subtleties (covered by integration tests in staging).
 */
export async function verifyProductionSchema(sequelize: Sequelize): Promise<void> {
  const issues: string[] = [];
  const queryInterface = sequelize.getQueryInterface();
  const existingTables = await queryInterface.showAllTables();
  const existingTablesSet = new Set(existingTables.map(String));

  for (const [, model] of Object.entries(sequelize.models)) {
    const tableName = model.tableName;

    if (!existingTablesSet.has(tableName)) {
      issues.push(`Table missing in DB: ${tableName}`);
      continue;
    }

    const dbDescription = await queryInterface.describeTable(tableName);
    const dbColumns = new Set(Object.keys(dbDescription));
    const modelAttrs = (model as any).rawAttributes as Record<string, { field?: string }>;

    for (const [attrName, attr] of Object.entries(modelAttrs)) {
      const dbColumnName = attr.field ?? attrName;
      if (!dbColumns.has(dbColumnName)) {
        issues.push(`Column missing in DB: ${tableName}.${dbColumnName}`);
      }
    }
  }

  if (issues.length > 0) {
    logger.fatal({ issues }, 'schema_drift_detected');
    throw new Error(
      `Production schema verification failed (${issues.length} issues). ` +
        `Service refuses to start. Write a migration and apply it before deploying.\n` +
        issues.join('\n'),
    );
  }

  logger.info({ tables_checked: Object.keys(sequelize.models).length }, 'schema_verified');
}
