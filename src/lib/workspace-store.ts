import { getDatabase } from "@/lib/database";
import type { DemoSession, Gender, NotificationChannel } from "@/lib/session";

type UserRow = {
  id: number;
  email: string;
  name: string;
  age: number | null;
  gender: string | null;
  location: string;
  latitude: number | null;
  longitude: number | null;
  garden_type: string;
  reminder_window: string;
  channels_json: string;
  email_daily_reminder: number | null;
  email_weekly_digest: number | null;
  whatsapp_number: string | null;
  timezone: string | null;
  country_code: string | null;
  onboarded: number;
  joined_at: string;
  updated_at: string;
};

function parseChannels(raw: string): NotificationChannel[] {
  try {
    const parsed = JSON.parse(raw) as string[];
    const channels = parsed.filter(
      (value): value is NotificationChannel =>
        value === "email" || value === "push" || value === "whatsapp",
    );

    return channels.length > 0 ? channels : ["email"];
  } catch {
    return ["email"];
  }
}

function parseGender(raw: string | null): Gender | undefined {
  if (
    raw === "Woman" ||
    raw === "Man" ||
    raw === "Non-binary" ||
    raw === "Prefer not to say"
  ) {
    return raw;
  }

  return undefined;
}

function mapRowToSession(row: UserRow): DemoSession {
  return {
    email: row.email,
    name: row.name,
    age: row.age ?? undefined,
    gender: parseGender(row.gender),
    location: row.location,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    gardenType: row.garden_type,
    reminderWindow: row.reminder_window,
    channels: parseChannels(row.channels_json),
    emailDailyReminder: row.email_daily_reminder !== 0,
    emailWeeklyDigest: row.email_weekly_digest !== 0,
    whatsappNumber: row.whatsapp_number ?? undefined,
    timezone: row.timezone ?? undefined,
    countryCode: row.country_code ?? undefined,
    onboarded: Boolean(row.onboarded),
    joinedAt: row.joined_at,
  };
}

export function readWorkspaceProfileByEmail(email: string) {
  const database = getDatabase();
  const row = database
    .prepare(
      `
        SELECT id, email, name, location, garden_type, reminder_window,
               age, gender, latitude, longitude, channels_json,
               email_daily_reminder, email_weekly_digest, whatsapp_number, timezone, country_code, onboarded, joined_at, updated_at
        FROM users
        WHERE email = ?
      `,
    )
    .get(email.trim().toLowerCase()) as UserRow | undefined;

  return row ? mapRowToSession(row) : null;
}

export function upsertWorkspaceProfile(
  session: DemoSession,
  previousEmail?: string,
) {
  const database = getDatabase();
  const targetEmail = previousEmail?.trim().toLowerCase() || session.email;
  const timestamp = new Date().toISOString();
  const existing = database
    .prepare(
      `
        SELECT id, email, name, location, garden_type, reminder_window,
               age, gender, latitude, longitude, channels_json,
               email_daily_reminder, email_weekly_digest, whatsapp_number, timezone, country_code, onboarded, joined_at, updated_at
        FROM users
        WHERE email = ?
      `,
    )
    .get(targetEmail) as UserRow | undefined;

  if (existing) {
    database
      .prepare(
        `
          UPDATE users
          SET email = ?, name = ?, age = ?, gender = ?, location = ?, latitude = ?, longitude = ?,
              garden_type = ?, reminder_window = ?, channels_json = ?,
              email_daily_reminder = ?, email_weekly_digest = ?, whatsapp_number = ?,
              timezone = ?, country_code = ?,
              onboarded = ?, updated_at = ?
          WHERE id = ?
`,
      )
      .run(
        session.email,
        session.name,
        session.age ?? null,
        session.gender ?? null,
        session.location,
        session.latitude ?? null,
        session.longitude ?? null,
        session.gardenType,
        session.reminderWindow,
        JSON.stringify(session.channels),
        session.emailDailyReminder ? 1 : 0,
        session.emailWeeklyDigest ? 1 : 0,
        session.whatsappNumber ?? null,
        session.timezone ?? null,
        session.countryCode ?? null,
        session.onboarded ? 1 : 0,
        timestamp,
        existing.id,
      );

    return existing.id;
  }

  database
    .prepare(
      `
        INSERT INTO users (
          email, name, age, gender, location, latitude, longitude, garden_type,
          reminder_window, channels_json, email_daily_reminder, email_weekly_digest,
          whatsapp_number, timezone, country_code, onboarded, joined_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      session.email,
      session.name,
      session.age ?? null,
      session.gender ?? null,
      session.location,
      session.latitude ?? null,
      session.longitude ?? null,
      session.gardenType,
      session.reminderWindow,
      JSON.stringify(session.channels),
      session.emailDailyReminder ? 1 : 0,
      session.emailWeeklyDigest ? 1 : 0,
      session.whatsappNumber ?? null,
      session.timezone ?? null,
      session.countryCode ?? null,
      session.onboarded ? 1 : 0,
      session.joinedAt,
      timestamp,
    );

  const inserted = database
    .prepare(`SELECT id FROM users WHERE email = ?`)
    .get(session.email) as { id: number };

  return inserted.id;
}

export function readWorkspaceIdentityByEmail(email: string) {
  const database = getDatabase();
  const row = database
    .prepare(`SELECT id FROM users WHERE email = ?`)
    .get(email.trim().toLowerCase()) as { id: number } | undefined;

  return row ?? null;
}

export function readAllActiveUsers(): { id: number; email: string }[] {
  const database = getDatabase();
  return database
    .prepare(`SELECT id, email FROM users WHERE onboarded = 1`)
    .all() as { id: number; email: string }[];
}

export function clearWorkspaceDerivedCareData(userId: number) {
  const database = getDatabase();

  database.prepare(`DELETE FROM care_plans WHERE user_id = ?`).run(userId);
  database.prepare(`DELETE FROM agent_traces WHERE user_id = ?`).run(userId);
  database.prepare(`DELETE FROM garden_context_snapshots WHERE user_id = ?`).run(userId);
  database.prepare(`DELETE FROM plant_evidence WHERE user_id = ?`).run(userId);
  database
    .prepare(`DELETE FROM agent_runs WHERE user_id = ? AND trigger = ?`)
    .run(userId, "care_plan_graph");
}
