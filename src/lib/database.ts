import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

let databaseInstance: DatabaseSync | null = null;

function getDatabasePath() {
  if (process.env.DATABASE_FILE_PATH) {
    return resolve(process.cwd(), process.env.DATABASE_FILE_PATH);
  }

  if (process.env.VERCEL) {
    return "/tmp/bloompilot.sqlite";
  }

  return resolve(process.cwd(), "./data/bloompilot.sqlite");
}

function initializeSchema(database: DatabaseSync) {
  database.exec(`
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

  ensureColumn(database, "users", "latitude", "REAL");
  ensureColumn(database, "users", "longitude", "REAL");
  ensureColumn(database, "users", "age", "INTEGER");
  ensureColumn(database, "users", "gender", "TEXT");
  ensureColumn(database, "users", "email_daily_reminder", "INTEGER DEFAULT 1");
  ensureColumn(database, "users", "email_weekly_digest", "INTEGER DEFAULT 1");
  ensureColumn(database, "users", "whatsapp_number", "TEXT");
  ensureColumn(database, "users", "timezone", "TEXT");
  ensureColumn(database, "users", "country_code", "TEXT");
  ensureColumn(database, "plants", "photo_blob", "BLOB");
  ensureColumn(database, "plants", "photo_type", "TEXT");

  // Seed common plant knowledge so day-1 users don't need API calls
  seedKnowledgeBaseOnce(database);
}

function seedKnowledgeBaseOnce(database: DatabaseSync) {
  try {
    const count = (
      database.prepare(`SELECT COUNT(*) as n FROM plant_species_knowledge WHERE confidence = 'seeded'`).get() as { n: number }
    ).n;
    if (count > 0) return; // already seeded
    // Deferred import to avoid circular dependency at module load time
    import("@/lib/plant-enrichment").then(({ seedKnowledgeBase }) => {
      seedKnowledgeBase();
    }).catch(() => {/* non-critical */});
  } catch {
    // table might not exist yet in edge environments — ignore
  }
}

function ensureColumn(
  database: DatabaseSync,
  table: string,
  column: string,
  definition: string,
) {
  const rows = database
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];

  if (rows.some((row) => row.name === column)) {
    return;
  }

  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function getDatabase() {
  if (databaseInstance) {
    return databaseInstance;
  }

  const databasePath = getDatabasePath();
  mkdirSync(dirname(databasePath), { recursive: true });
  databaseInstance = new DatabaseSync(databasePath);
  initializeSchema(databaseInstance);

  return databaseInstance;
}

export function withTransaction<T>(callback: (database: DatabaseSync) => T) {
  const database = getDatabase();

  database.exec("BEGIN");

  try {
    const result = callback(database);
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
