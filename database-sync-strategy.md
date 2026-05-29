# 🔄 Database Sync Strategy
## How Sequelize Auto-Creates Tables, Indexes, FKs, ENUMs

> [database-schema.md](database-schema.md) shows the target schema. **This doc shows how it gets there at runtime.** Models are the source of truth; SQL is generated.

---

## 📋 Table of Contents

1. [The Auto-Create Approach](#the-auto-create-approach)
2. [Sequelize Sync Modes](#sequelize-sync-modes)
3. [When Each Mode Runs](#when-each-mode-runs)
4. [Sample Sequelize Model (with prefix)](#sample-sequelize-model)
5. [Models Index Pattern](#models-index-pattern)
6. [Bootstrap on Service Start](#bootstrap-on-service-start)
7. [Production Safety](#production-safety)
8. [Migrations for Things Sequelize Can't Sync](#migrations-for-things-sequelize-cant-sync)
9. [Seeding Initial Data](#seeding-initial-data)
10. [Troubleshooting](#troubleshooting)

---

## The Auto-Create Approach

**Rule:** Sequelize models are the source of truth. SQL DDL in [database-schema.md](database-schema.md) is for reference only.

### What Sequelize creates automatically via `sync()`:

✅ Tables (CREATE TABLE)
✅ Columns + types (`STRING`, `INTEGER`, `JSON`, etc.)
✅ Default values (`defaultValue: DataTypes.UUIDV4`)
✅ NULL / NOT NULL constraints (`allowNull: false`)
✅ Primary keys (`primaryKey: true`)
✅ ENUMs (`DataTypes.ENUM('a','b','c')`)
✅ Indexes (single-column, composite, `unique`, `where` partial)
✅ Foreign keys (with `references` + `onDelete`)
✅ Timestamps + soft-delete (`timestamps: true, paranoid: true`)

### What Sequelize does NOT create automatically:

❌ Partitioning (`PARTITION BY RANGE`)
❌ FULLTEXT indexes (limited; use raw query in migration)
❌ Database-level triggers
❌ Stored procedures
❌ Materialized views
❌ Cross-database FOREIGN KEYs

These go through manual migrations (see **[Migrations for Things Sequelize Can't Sync](#migrations-for-things-sequelize-cant-sync)** below).

---

## Sequelize Sync Modes

```javascript
sequelize.sync()                      // Create tables ONLY if they don't exist. Safe.
sequelize.sync({ alter: true })       // Compare model to table, ALTER to match. Safe in dev/staging; risky in prod.
sequelize.sync({ force: true })       // DROP TABLE + CREATE TABLE. DESTRUCTIVE. Tests only.
```

| Mode | Local Dev | Staging | Production |
|---|---|---|---|
| `sync()` | ✅ used | ✅ used (first boot) | ✅ used (read-only — verifies tables exist) |
| `sync({ alter: true })` | ✅ default | ✅ default | ❌ **NEVER** — use migrations |
| `sync({ force: true })` | ❌ only with `RESET_DB=true` flag | ❌ | ❌ |

---

## When Each Mode Runs

The behaviour is controlled by env vars + `NODE_ENV`:

```javascript
// shared-db/src/sync.ts
export async function syncDatabase(sequelize: Sequelize) {
  const env = process.env.NODE_ENV;
  const allowForce = process.env.RESET_DB === 'true';

  if (env === 'test') {
    await sequelize.sync({ force: true });    // every test starts clean
    return;
  }

  if (env === 'development' || env === 'staging') {
    if (allowForce) {
      console.warn('⚠️  RESET_DB=true — dropping all tables');
      await sequelize.sync({ force: true });
    } else {
      await sequelize.sync({ alter: true });  // auto-adjust to model
    }
    return;
  }

  if (env === 'production') {
    // Production: no auto-alter. Verify tables exist; fail fast if drift.
    await sequelize.sync();                   // CREATE IF NOT EXISTS only
    await verifyProductionSchema(sequelize);  // throw if model ≠ table
    return;
  }
}
```

**`verifyProductionSchema()`** compares model definitions to actual DB tables. If a column is missing or a type differs, it **refuses to start the service** — forces engineers to write a migration.

---

## Sample Sequelize Model (with prefix)

Every model follows this exact template. The **`tableName`** is the prefix from [database-schema.md](database-schema.md).

```typescript
// services/seo-engine/src/models/keyword.model.ts
import { DataTypes, Model, Sequelize } from 'sequelize';

export interface KeywordAttrs {
  id: string;
  workspace_id: string;
  keyword: string;
  search_volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational' | null;
  country: string | null;
  language: string | null;
  source: 'manual' | 'ai_suggested' | 'competitor_stolen' | 'keyword_research' | null;
  cluster_id: string | null;
  status: 'tracking' | 'paused' | 'archived';
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export class Keyword extends Model<KeywordAttrs> {}

export function defineKeyword(sequelize: Sequelize) {
  Keyword.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      workspace_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        comment: 'FK to core_workspaces (soft ref — not enforced)',
      },
      keyword: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      search_volume: { type: DataTypes.INTEGER, allowNull: true },
      difficulty: { type: DataTypes.TINYINT, allowNull: true },
      cpc: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
      intent: {
        type: DataTypes.ENUM('informational', 'commercial', 'transactional', 'navigational'),
        allowNull: true,
      },
      country: { type: DataTypes.CHAR(2), allowNull: true },
      language: { type: DataTypes.CHAR(5), allowNull: true },
      source: {
        type: DataTypes.ENUM('manual', 'ai_suggested', 'competitor_stolen', 'keyword_research'),
        allowNull: true,
      },
      cluster_id: { type: DataTypes.CHAR(36), allowNull: true },
      status: {
        type: DataTypes.ENUM('tracking', 'paused', 'archived'),
        allowNull: false,
        defaultValue: 'tracking',
      },
    },
    {
      sequelize,
      modelName: 'Keyword',
      tableName: 'seo_keywords',          // ← service-prefixed name
      timestamps: true,                        // adds created_at + updated_at
      paranoid: true,                          // adds deleted_at; queries auto-filter
      underscored: true,                       // snake_case columns
      indexes: [
        { fields: ['workspace_id'] },
        { fields: ['cluster_id'] },
        { fields: ['status'] },
        // Composite unique index per (workspace_id, keyword, country, language)
        {
          name: 'uk_workspace_keyword',
          unique: true,
          fields: ['workspace_id', { name: 'keyword', length: 255 }, 'country', 'language'],
        },
        // FULLTEXT — Sequelize supports type: 'FULLTEXT'
        {
          name: 'ft_keyword',
          type: 'FULLTEXT',
          fields: ['keyword'],
        },
      ],
    },
  );

  return Keyword;
}
```

### Sample model with FK (cascade delete within same service)

```typescript
// services/seo-engine/src/models/serp-snapshot.model.ts
export function defineSerpSnapshot(sequelize: Sequelize, models: AllModels) {
  SerpSnapshot.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      keyword_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        references: { model: models.Keyword, key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'RESTRICT',
      },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      results: { type: DataTypes.JSON, allowNull: true },
      featured_snippet: { type: DataTypes.JSON, allowNull: true },
      people_also_ask: { type: DataTypes.JSON, allowNull: true },
    },
    {
      sequelize,
      tableName: 'seo_serp_snapshots',
      timestamps: false,
      indexes: [
        { fields: ['keyword_id', 'date'] },
      ],
    },
  );
  return SerpSnapshot;
}
```

### Sample model — soft cross-service reference (NO FK constraint)

```typescript
// services/crm-automation/src/models/contact.model.ts
export function defineContact(sequelize: Sequelize) {
  Contact.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        // ❌ NO `references` — cross-service FK is soft (validated in app layer)
        comment: 'Soft FK to core_workspaces.id (validated in service code)',
      },
      // ... other fields
    },
    {
      sequelize,
      tableName: 'crm_contacts',
      timestamps: true,
      paranoid: true,
      underscored: true,
    },
  );
  return Contact;
}
```

**Rule:** Foreign keys to **another service's table** never use Sequelize `references`. They're soft references — application code validates them. This lets us split services to separate databases later without breaking constraints.

---

## Models Index Pattern

Each service has a `models/index.ts` that registers all its models with a Sequelize instance:

```typescript
// services/seo-engine/src/models/index.ts
import { Sequelize } from 'sequelize';
import { defineKeyword } from './keyword.model';
import { defineCluster } from './cluster.model';
import { defineRanking } from './ranking.model';
import { defineAudit } from './audit.model';
import { defineAuditIssue } from './audit-issue.model';
import { defineBacklink } from './backlink.model';
import { defineSerpSnapshot } from './serp-snapshot.model';
import { defineLocalListing } from './local-listing.model';
import { defineAppListing } from './app-listing.model';

export function initModels(sequelize: Sequelize) {
  // Order matters: parent tables before children
  const Cluster = defineCluster(sequelize);
  const Keyword = defineKeyword(sequelize, { Cluster });
  const Ranking = defineRanking(sequelize, { Keyword });
  const SerpSnapshot = defineSerpSnapshot(sequelize, { Keyword });
  const Audit = defineAudit(sequelize);
  const AuditIssue = defineAuditIssue(sequelize, { Audit });
  const Backlink = defineBacklink(sequelize);
  const LocalListing = defineLocalListing(sequelize);
  const AppListing = defineAppListing(sequelize);

  return {
    Cluster, Keyword, Ranking, SerpSnapshot,
    Audit, AuditIssue, Backlink, LocalListing, AppListing,
  };
}

export type Models = ReturnType<typeof initModels>;
```

---

## Bootstrap on Service Start

```typescript
// services/seo-engine/src/app.ts
import express from 'express';
import { Sequelize } from 'sequelize';
import { initModels } from './models';
import { syncDatabase } from '@marketing/shared-db';
import { runManualMigrations } from './migrations/runner';
import { logger } from './lib/logger';

async function bootstrap() {
  // 1. Connect to MySQL (dev) or PostgreSQL (prod) — controlled by DB_DIALECT
  const sequelize = new Sequelize(process.env.DATABASE_URL!, {
    dialect: (process.env.DB_DIALECT as 'mysql' | 'postgres') ?? 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: { max: 10, min: 2 },
    define: { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
  });

  await sequelize.authenticate();
  logger.info('database_connected');

  // 2. Initialise all models
  const models = initModels(sequelize);
  logger.info({ models: Object.keys(models) }, 'models_registered');

  // 3. Sync (creates / alters tables per NODE_ENV)
  await syncDatabase(sequelize);
  logger.info('database_synced');

  // 4. Run manual migrations (partitioning, FULLTEXT extensions, seed data)
  await runManualMigrations(sequelize);
  logger.info('manual_migrations_complete');

  // 5. Start Express
  const app = express();
  // ... routes
  app.listen(process.env.PORT, () => logger.info({ port: process.env.PORT }, 'service_started'));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'bootstrap_failed');
  process.exit(1);
});
```

### Boot order (first-time dev startup)

```
1. marketing-core starts first        → creates core_* tables
2. All other services start in any order → create their mkt_<svc>_* tables
3. Each service runs its own manual migrations (partitioning, seed data, etc.)
```

Why marketing-core first? It owns `core_workspaces`, which other services soft-reference. Even though no DB FK enforces this, the seed data (default plans, the platform admin user) must exist before workspaces can be created.

In **Docker Compose**, this is handled by `depends_on` with `service_healthy` health checks.

---

## Production Safety

### Why `sync({ alter: true })` is BANNED in production

`alter: true` runs `ALTER TABLE` statements derived from comparing the model to the live table. Risks:

- **Data loss:** dropping a column you forgot to remove from the model
- **Long locks:** `ALTER TABLE` on a 100M-row table can lock for hours
- **Type changes:** changing a column type can rewrite the entire table
- **Race conditions:** multiple service instances all trying to alter the same table simultaneously
- **No rollback:** no migration history; can't revert cleanly

### Production startup flow

```javascript
// In production, sync() runs in safe mode:
// 1. Creates tables that don't exist (idempotent CREATE IF NOT EXISTS)
// 2. Then verifyProductionSchema() compares actual table to model
// 3. If mismatch detected: log error, refuse to start, alert SRE

// services/_shared/db/verify-schema.ts
export async function verifyProductionSchema(sequelize: Sequelize) {
  const models = sequelize.models;
  const issues: string[] = [];

  for (const [name, model] of Object.entries(models)) {
    const tableName = model.tableName;
    const [columns] = await sequelize.query(
      `SHOW COLUMNS FROM \`${tableName}\``
    ) as [Array<{ Field: string; Type: string; Null: string; Default: any }>, unknown];

    const dbColumns = new Map(columns.map(c => [c.Field, c]));
    const modelAttrs = model.rawAttributes;

    // Check every model attribute has a matching DB column
    for (const [attrName, attr] of Object.entries(modelAttrs)) {
      const dbCol = dbColumns.get(attrName);
      if (!dbCol) {
        issues.push(`Table ${tableName} missing column ${attrName}`);
      }
      // (additional type / nullability checks omitted for brevity)
    }
  }

  if (issues.length) {
    throw new Error(`Schema drift detected:\n${issues.join('\n')}`);
  }
}
```

### Production schema changes flow

```
1. Engineer changes a Sequelize model in their service
2. CI runs against staging → sync({ alter: true }) applies the change automatically
3. Migration also written manually for production (e.g., gh-ost / pt-online-schema-change)
4. PR review approves both:
   - Model change (TypeScript)
   - Migration script (SQL)
5. Deploy to staging — sync verifies
6. Run migration script in production (zero-downtime tooling)
7. Deploy service code to production
8. verifyProductionSchema() passes; service starts
```

See [infrastructure-prod.md](infrastructure-prod.md) "Zero-Downtime Database Migrations" for `gh-ost` usage.

---

## Migrations for Things Sequelize Can't Sync

Each service has a `src/migrations/` folder for things `sync()` can't handle. These run **after** `sync()` on every boot.

```typescript
// services/analytics-engine/src/migrations/runner.ts
export async function runManualMigrations(sequelize: Sequelize) {
  await ensurePartitioning(sequelize);
  await ensureFulltextIndexes(sequelize);
  await seedDefaultConversionGoals(sequelize);
}

async function ensurePartitioning(sequelize: Sequelize) {
  const [rows] = await sequelize.query(`
    SELECT 1 FROM INFORMATION_SCHEMA.PARTITIONS
    WHERE TABLE_NAME = 'analytics_events' AND PARTITION_NAME IS NOT NULL
    LIMIT 1
  `);
  if (rows.length > 0) return; // already partitioned

  // Apply weekly partitioning for analytics events
  await sequelize.query(`
    ALTER TABLE analytics_events
    PARTITION BY RANGE (TO_DAYS(created_at)) (
      PARTITION p_2026_w22 VALUES LESS THAN (TO_DAYS('2026-06-01')),
      PARTITION p_2026_w23 VALUES LESS THAN (TO_DAYS('2026-06-08')),
      -- ...
      PARTITION p_future VALUES LESS THAN MAXVALUE
    )
  `);
}

async function ensureFulltextIndexes(sequelize: Sequelize) {
  // FULLTEXT indexes on existing columns
  const [indexes] = await sequelize.query(`
    SHOW INDEX FROM seo_keywords WHERE Key_name = 'ft_keyword'
  `);
  if (indexes.length > 0) return;

  await sequelize.query(`
    ALTER TABLE seo_keywords ADD FULLTEXT INDEX ft_keyword (keyword)
  `);
}
```

### When to use a manual migration vs Sequelize model

| Change | Approach |
|---|---|
| Add a column | Model change → `sync({ alter: true })` |
| Add an index | Model change → `sync({ alter: true })` |
| Change column type (compatible) | Model change → `sync({ alter: true })` |
| Change column type (rewrite) | Manual migration with `gh-ost` |
| Add FULLTEXT index | Manual migration (Sequelize support is patchy) |
| Add partitioning | Manual migration always |
| Backfill data into new column | Manual migration (separate from schema change) |
| Drop a column | Manual: expand → migrate → contract pattern |
| Rename a column | Manual: add new + dual-write + migrate reads + drop old |

---

## Seeding Initial Data

Initial data (default plans, default roles, platform admin) lives in service seed files:

```typescript
// services/marketing-core/src/seeds/index.ts
export async function seedInitialData(sequelize: Sequelize) {
  await sequelize.transaction(async (t) => {
    await seedPlans(sequelize, t);
    await seedDefaultRoles(sequelize, t);
    if (process.env.NODE_ENV === 'development') {
      await seedPlatformAdmin(sequelize, t);
      await seedTestWorkspaces(sequelize, t);
    }
  });
}

async function seedPlans(sequelize: Sequelize, transaction: Transaction) {
  const { Plan } = sequelize.models;

  const plans = [
    {
      slug: 'free',
      name: 'Free',
      price_monthly_gbp: 0,
      price_yearly_gbp: 0,
      features: { /* ... */ },
      limits: { keywords: 25, campaigns: 1, team_members: 1, /* ... */ },
      max_team_members: 1,
      max_clients: 0,
      is_agency_plan: false,
      display_order: 1,
    },
    {
      slug: 'starter',
      name: 'Starter',
      price_monthly_gbp: 29,
      price_yearly_gbp: 278,
      stripe_price_id_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
      stripe_price_id_yearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
      // ...
    },
    // pro, agency, enterprise...
  ];

  for (const plan of plans) {
    await Plan.findOrCreate({ where: { slug: plan.slug }, defaults: plan, transaction });
  }
}
```

Seeding runs after `sync()` on every boot but is **idempotent** (uses `findOrCreate`). Safe to run repeatedly.

---

## Troubleshooting

### "Too many keys specified; max 64 keys allowed" (MySQL)

A table has too many indexes. Audit the model — remove unused single-column indexes covered by composite ones.

### "Specified key was too long; max key length is 3072 bytes" (utf8mb4)

`utf8mb4` uses 4 bytes per char; a `VARCHAR(1000)` index = 4000 bytes — exceeds the limit. Fix by specifying index prefix:

```typescript
indexes: [
  { fields: [{ name: 'long_text_column', length: 191 }] }   // 191 × 4 = 764 bytes
]
```

### "Cannot drop table; referenced by FK"

Within-service tables use `ON DELETE CASCADE`. If you see this in production, an orphaned FK references a table that shouldn't exist. Investigate before manually dropping.

### Schema drift detected on production startup

`verifyProductionSchema()` refused to start. Means a model change was deployed without the matching migration.
1. Roll back the deploy
2. Write the migration
3. Apply migration via `gh-ost`
4. Re-deploy

### Sequelize creates indexes with random names

Always specify `name: 'idx_...'` in the index definition. Without it, Sequelize generates names like `keyword_search_volume`, and re-running `sync({ alter: true })` may try to drop+recreate them needlessly.

### Multiple services trying to create the same shared table

Only **marketing-core** creates `core_*` tables. Other services that need to read those tables do **not** define them — they go through the marketing-core API.

If you need a Sequelize-friendly query for read access (rare), define a **read-only model** with `freezeTableName: true` and never include it in `sync()`.

---

## Summary

```
Source of truth:          Sequelize model files (TypeScript)
Reference doc:            database-schema.md (MySQL DDL)
Dev / staging sync:       sync({ alter: true }) — automatic
Production sync:          sync() + verifyProductionSchema()
Production migrations:    manual via gh-ost
Partitioning + FULLTEXT:  manual via runManualMigrations()
Seed data:                idempotent via findOrCreate()
```

Engineers never write `CREATE TABLE` SQL by hand. They write Sequelize models. The DDL in [database-schema.md](database-schema.md) is generated from those models and kept up to date as a human-readable reference.
