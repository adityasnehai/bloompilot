import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { createClient, type Client, type InArgs, type InValue, type Row, type Transaction } from "@libsql/client";

// ── Thin async adapter over @libsql/client, shaped to match the sync
// node:sqlite `DatabaseSync` API this codebase was originally written
// against (`db.prepare(sql).get/all/run(...args)`), so every call site
// only needs an `await` added, not a rewrite of its SQL or logic. ────────
// Rows are explicitly re-mapped to plain objects (rather than returning
// libSQL's `Row` directly) because `Row` also exposes numeric indices and
// a `length` property, which would silently break any app code that does
// `Object.keys(row)` or `{...row}` expecting only the named columns.
export type DbRow = Record<string, unknown>;

type Executor = Client | Transaction;

function rowsToObjects(columns: string[], rows: readonly Row[]): DbRow[] {
  return rows.map((row) => {
    const obj: DbRow = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

class PreparedStatement {
  constructor(
    private executor: Executor,
    private sql: string,
  ) {}

  async get(...args: InValue[]): Promise<DbRow | undefined> {
    const result = await this.executor.execute({ sql: this.sql, args: args as InArgs });
    return rowsToObjects(result.columns, result.rows)[0];
  }

  async all(...args: InValue[]): Promise<DbRow[]> {
    const result = await this.executor.execute({ sql: this.sql, args: args as InArgs });
    return rowsToObjects(result.columns, result.rows);
  }

  async run(...args: InValue[]): Promise<{ changes: number; lastInsertRowid: number | bigint }> {
    const result = await this.executor.execute({ sql: this.sql, args: args as InArgs });
    return {
      changes: result.rowsAffected,
      lastInsertRowid: result.lastInsertRowid ?? 0,
    };
  }
}

export class DbHandle {
  constructor(private executor: Executor) {}

  prepare(sql: string): PreparedStatement {
    return new PreparedStatement(this.executor, sql);
  }

  async exec(sql: string): Promise<void> {
    await this.executor.executeMultiple(sql);
  }
}

let clientInstance: Client | null = null;
let dbHandleInstance: DbHandle | null = null;
let schemaInitPromise: Promise<void> | null = null;
const LOCAL_DEV_DATABASE_PATH = "/tmp/bloompilot.sqlite";
const LEGACY_PROJECT_DATABASE_PATH = resolve(process.cwd(), "./data/bloompilot.sqlite");

function resolveConfiguredDatabasePath() {
  const configuredPath = process.env.DATABASE_FILE_PATH?.trim();
  if (!configuredPath) {
    return null;
  }

  return isAbsolute(configuredPath)
    ? configuredPath
    : resolve(process.cwd(), configuredPath);
}

function shouldRedirectProjectDatabasePath(databasePath: string) {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  if (process.env.DATABASE_DEV_ALLOW_PROJECT_PATH === "true") {
    return false;
  }

  return databasePath.startsWith(`${process.cwd()}${sep}`);
}

function getDatabasePath() {
  const configuredPath = resolveConfiguredDatabasePath();
  if (configuredPath) {
    return shouldRedirectProjectDatabasePath(configuredPath)
      ? LOCAL_DEV_DATABASE_PATH
      : configuredPath;
  }

  if (process.env.VERCEL) {
    return LOCAL_DEV_DATABASE_PATH;
  }

  return LOCAL_DEV_DATABASE_PATH;
}

function migrateLegacyProjectDatabase(targetPath: string) {
  if (targetPath === LEGACY_PROJECT_DATABASE_PATH) {
    return;
  }

  if (!existsSync(LEGACY_PROJECT_DATABASE_PATH) || existsSync(targetPath)) {
    return;
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  copyFileSync(LEGACY_PROJECT_DATABASE_PATH, targetPath);
}

async function initializeSchema(database: DbHandle) {
  await database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      age INTEGER,
      gender TEXT,
      location TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      garden_type TEXT NOT NULL,
      reminder_window TEXT NOT NULL,
      channels_json TEXT NOT NULL,
      onboarded INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

    CREATE TABLE IF NOT EXISTS plants (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      nickname TEXT NOT NULL,
      species TEXT NOT NULL,
      placement TEXT NOT NULL,
      sunlight TEXT NOT NULL,
      watering_interval_days INTEGER NOT NULL,
      notes TEXT NOT NULL,
      added_at TEXT NOT NULL,
      last_watered_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS care_tasks (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      plant_id TEXT NOT NULL,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      due_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL,
      plant_id TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      trigger TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminder_runs (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      trigger TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notification_subscriptions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminder_deliveries (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      task_id TEXT,
      plant_id TEXT,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      scheduled_for TEXT NOT NULL,
      sent_at TEXT,
      provider_message_id TEXT,
      idempotency_key TEXT NOT NULL,
      error_code TEXT,
      error_message TEXT,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (run_id) REFERENCES reminder_runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS diagnosis_runs (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      plant_id TEXT NOT NULL,
      plant_nickname TEXT NOT NULL,
      plant_species TEXT NOT NULL,
      image_name TEXT NOT NULL,
      image_content_type TEXT NOT NULL,
      image_size INTEGER NOT NULL,
      image_blob BLOB NOT NULL,
      symptoms_json TEXT NOT NULL,
      observation TEXT NOT NULL,
      issue TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      summary TEXT NOT NULL,
      treatment_json TEXT NOT NULL,
      follow_up TEXT NOT NULL,
      diagnosis_provider TEXT NOT NULL DEFAULT 'local_rule',
      diagnosis_evidence_status TEXT NOT NULL DEFAULT 'needs_more_evidence',
      diagnosis_evidence_notes_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS garden_context_snapshots (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      context_json TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      agent_ready INTEGER NOT NULL,
      warnings_json TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS action_feedback (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      plant_id TEXT,
      plant_name TEXT NOT NULL,
      action_type TEXT NOT NULL,
      action_title TEXT NOT NULL,
      feedback TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_action_feedback_user_id ON action_feedback(user_id);
    CREATE INDEX IF NOT EXISTS idx_action_feedback_plant_id ON action_feedback(plant_id);

    CREATE TABLE IF NOT EXISTS plant_alerts (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      plant_id TEXT NOT NULL,
      plant_name TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      message TEXT NOT NULL,
      urgency TEXT NOT NULL,
      notified INTEGER NOT NULL DEFAULT 0,
      triggered_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_plant_alerts_user_id ON plant_alerts(user_id);
    CREATE INDEX IF NOT EXISTS idx_plant_alerts_triggered_at ON plant_alerts(triggered_at);
    CREATE INDEX IF NOT EXISTS idx_plant_alerts_urgency ON plant_alerts(urgency);

    CREATE TABLE IF NOT EXISTS plant_health_events (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      plant_id TEXT NOT NULL,
      plant_name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      detail TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_health_events_user_id ON plant_health_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_health_events_plant_id ON plant_health_events(plant_id);
    CREATE INDEX IF NOT EXISTS idx_health_events_created_at ON plant_health_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_health_events_event_type ON plant_health_events(event_type);

    CREATE TABLE IF NOT EXISTS plant_evidence (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      plant_id TEXT NOT NULL,
      evidence_type TEXT NOT NULL,
      source TEXT NOT NULL,
      value_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS care_plans (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      context_id TEXT NOT NULL,
      agent_run_id TEXT NOT NULL,
      status TEXT NOT NULL,
      plan_json TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_traces (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      agent_name TEXT NOT NULL,
      status TEXT NOT NULL,
      input_summary TEXT NOT NULL,
      output_summary TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_plants_user_id ON plants(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON care_tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON care_tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
    CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id ON agent_runs(user_id);
    CREATE INDEX IF NOT EXISTS idx_reminder_runs_user_id ON reminder_runs(user_id);
    CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_user_id ON notification_subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_active ON notification_subscriptions(active);
    CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_user_id ON reminder_deliveries(user_id);
    CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_run_id ON reminder_deliveries(run_id);
    CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_scheduled_for ON reminder_deliveries(scheduled_for);
    CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_status ON reminder_deliveries(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reminder_deliveries_idempotency_key ON reminder_deliveries(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_diagnosis_runs_user_id ON diagnosis_runs(user_id);
    CREATE INDEX IF NOT EXISTS idx_context_snapshots_user_id ON garden_context_snapshots(user_id);
    CREATE INDEX IF NOT EXISTS idx_context_snapshots_generated_at ON garden_context_snapshots(generated_at);
    CREATE INDEX IF NOT EXISTS idx_plant_evidence_user_id ON plant_evidence(user_id);
    CREATE INDEX IF NOT EXISTS idx_plant_evidence_plant_id ON plant_evidence(plant_id);
    CREATE INDEX IF NOT EXISTS idx_care_plans_user_id ON care_plans(user_id);
    CREATE INDEX IF NOT EXISTS idx_care_plans_generated_at ON care_plans(generated_at);
    CREATE INDEX IF NOT EXISTS idx_agent_traces_run_id ON agent_traces(run_id);
    CREATE INDEX IF NOT EXISTS idx_agent_traces_user_id ON agent_traces(user_id);

    CREATE TABLE IF NOT EXISTS plant_notes (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      plant_id TEXT NOT NULL,
      plant_name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_plant_notes_user_id ON plant_notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_plant_notes_plant_id ON plant_notes(plant_id);
    CREATE INDEX IF NOT EXISTS idx_plant_notes_created_at ON plant_notes(created_at);

    CREATE TABLE IF NOT EXISTS seasonal_recommendations (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      season TEXT NOT NULL,
      year INTEGER NOT NULL,
      advice_json TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_seasonal_recs_user_season ON seasonal_recommendations(user_id, season, year);

    CREATE TABLE IF NOT EXISTS studio_layouts (
      user_id   INTEGER NOT NULL,
      garden_type TEXT NOT NULL,
      layout_json TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      PRIMARY KEY (user_id, garden_type),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plant_milestones (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      plant_id TEXT NOT NULL,
      plant_name TEXT NOT NULL,
      stage TEXT NOT NULL,
      note TEXT,
      recorded_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_milestones_plant_id ON plant_milestones(plant_id);

    CREATE TABLE IF NOT EXISTS plant_species_knowledge (
      id TEXT PRIMARY KEY,
      species_key TEXT UNIQUE NOT NULL,
      scientific_name TEXT,
      common_names TEXT NOT NULL DEFAULT '[]',
      watering_baseline TEXT,
      watering_days_min INTEGER,
      watering_days_max INTEGER,
      sunlight_preference TEXT,
      soil_preference TEXT,
      temperature_min_c REAL,
      temperature_max_c REAL,
      humidity_min_percent REAL,
      humidity_max_percent REAL,
      ph_min REAL,
      ph_max REAL,
      pest_list TEXT NOT NULL DEFAULT '[]',
      disease_list TEXT NOT NULL DEFAULT '[]',
      toxicity TEXT,
      pruning_months TEXT,
      nutrient_requirements TEXT,
      companion_plants TEXT NOT NULL DEFAULT '[]',
      care_notes TEXT NOT NULL DEFAULT '[]',
      sources TEXT NOT NULL DEFAULT '[]',
      confidence TEXT NOT NULL DEFAULT 'low',
      fetched_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_species_key ON plant_species_knowledge(species_key);
  `);

  await ensureColumn(database, "users", "latitude", "REAL");
  await ensureColumn(database, "users", "longitude", "REAL");
  await ensureColumn(database, "users", "age", "INTEGER");
  await ensureColumn(database, "users", "gender", "TEXT");
  await ensureColumn(database, "users", "email_daily_reminder", "INTEGER DEFAULT 1");
  await ensureColumn(database, "users", "email_weekly_digest", "INTEGER DEFAULT 1");
  await ensureColumn(database, "users", "whatsapp_number", "TEXT");
  await ensureColumn(database, "users", "telegram_chat_id", "TEXT");
  await ensureColumn(database, "users", "timezone", "TEXT");
  await ensureColumn(database, "users", "country_code", "TEXT");
  await ensureColumn(database, "users", "password_hash", "TEXT");
  await ensureColumn(database, "users", "reminder_engagement_score", "REAL DEFAULT 100");
  await ensureColumn(database, "plants", "photo_blob", "BLOB");
  await ensureColumn(database, "plants", "photo_type", "TEXT");
  await ensureColumn(database, "diagnosis_runs", "diagnosis_provider", "TEXT NOT NULL DEFAULT 'local_rule'");
  ensureColumn(
    database,
    "diagnosis_runs",
    "diagnosis_evidence_status",
    "TEXT NOT NULL DEFAULT 'needs_more_evidence'",
  );
  ensureColumn(
    database,
    "diagnosis_runs",
    "diagnosis_evidence_notes_json",
    "TEXT NOT NULL DEFAULT '[]'",
  );
  ensureColumn(
    database,
    "diagnosis_runs",
    "diagnosis_findings_json",
    "TEXT NOT NULL DEFAULT '[]'",
  );

  // Seed common plant knowledge so day-1 users don't need API calls
  seedKnowledgeBaseOnce(database);
}

async function seedKnowledgeBaseOnce(database: DbHandle) {
  try {
    const row = await database
      .prepare(`SELECT COUNT(*) as n FROM plant_species_knowledge WHERE confidence = 'seeded'`)
      .get();
    const count = (row as { n: number } | undefined)?.n ?? 0;
    if (count > 0) return; // already seeded
    // Deferred import to avoid circular dependency at module load time
    const { seedKnowledgeBase } = await import("@/lib/plant-enrichment");
    await seedKnowledgeBase();
  } catch {
    // table might not exist yet in edge environments — ignore
  }
}

async function ensureColumn(
  database: DbHandle,
  table: string,
  column: string,
  definition: string,
) {
  const rows = (await database
    .prepare(`PRAGMA table_info(${table})`)
    .all()) as unknown as { name: string }[];

  if (rows.some((row) => row.name === column)) {
    return;
  }

  await database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function createLibsqlClient(): Client {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (tursoUrl) {
    return createClient({ url: tursoUrl, authToken: tursoToken });
  }

  // No Turso configured: fall back to a local SQLite file via libSQL's
  // `file:` protocol, so local dev works without a Turso account.
  const databasePath = getDatabasePath();
  migrateLegacyProjectDatabase(databasePath);
  mkdirSync(dirname(databasePath), { recursive: true });
  return createClient({ url: `file:${databasePath}` });
}

export async function getDatabase(): Promise<DbHandle> {
  if (!clientInstance) {
    clientInstance = createLibsqlClient();
  }
  if (!dbHandleInstance) {
    dbHandleInstance = new DbHandle(clientInstance);
  }
  if (!schemaInitPromise) {
    schemaInitPromise = initializeSchema(dbHandleInstance);
  }
  await schemaInitPromise;

  return dbHandleInstance;
}

export async function withTransaction<T>(
  callback: (database: DbHandle) => Promise<T> | T,
): Promise<T> {
  await getDatabase(); // ensures client + schema are ready
  const tx = await clientInstance!.transaction("write");
  const handle = new DbHandle(tx);

  try {
    const result = await callback(handle);
    await tx.commit();
    return result;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}
