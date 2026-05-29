import { getDatabase, withTransaction } from "@/lib/database";
import type {
  CarePlanAction,
  PlantWateringForecast,
} from "@/lib/care-plan-engine";
import { readLatestCarePlan } from "@/lib/care-plan-engine";
import { sendEmailReminder } from "@/lib/notifications/email";
import {
  sendWebPushReminder,
  type PushSubscriptionRecord,
} from "@/lib/notifications/web-push";
import { queueWhatsAppReminder } from "@/lib/notifications/whatsapp";
import type {
  ReminderChannel,
  ReminderSendPayload,
  ReminderSendResult,
} from "@/lib/notifications/types";
import { readSession, type NotificationChannel } from "@/lib/session";
import { upsertWorkspaceProfile } from "@/lib/workspace-store";

type ReminderRunRow = {
  id: string;
  trigger: string;
  created_at: string;
  payload_json: string;
};

type ReminderDeliveryRow = {
  id: string;
  run_id: string;
  user_id: number;
  task_id: string | null;
  plant_id: string | null;
  channel: string;
  status: string;
  scheduled_for: string;
  sent_at: string | null;
  provider_message_id: string | null;
  idempotency_key: string;
  error_code: string | null;
  error_message: string | null;
  payload_json: string;
  created_at: string;
};

type SubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type ReminderCandidate = {
  taskId: string;
  plantId: string | null;
  plantName: string;
  channel: ReminderChannel;
  priority: CarePlanAction["priority"];
  dueDate: string;
  isWatering: boolean;
  isEscalation: boolean;
  title: string;
  message: string;
  idempotencyKey: string;
  scheduledFor: string;
  payload: ReminderSendPayload;
};

type ReminderSuppression = {
  channel: ReminderChannel;
  task_id: string;
  plant_id: string | null;
  reason: string;
};

type ChannelStats = {
  sent: number;
  queued: number;
  failed: number;
  suppressed: number;
};

export type ReminderDelivery = {
  id: string;
  channel: NotificationChannel;
  status: "sent" | "queued" | "failed";
  title: string;
  preview: string;
  scheduledWindow: string;
  items: string[];
};

export type ReminderRunPayload = {
  headline: string;
  summary: string;
  deliveryCount: number;
  urgentCount: number;
  deliveries: ReminderDelivery[];
  notes: string[];
  sent_count: number;
  queued_count: number;
  suppressed_count: number;
  failed_count: number;
  channel_stats: Record<ReminderChannel, ChannelStats>;
  suppression_reasons: ReminderSuppression[];
};

export type StoredReminderRun = {
  id: string;
  trigger: string;
  createdAt: string;
  payload: ReminderRunPayload;
};

const DEDUPE_HOURS = 6;
const MAX_REMINDERS_PER_PLANT_PER_DAY = 2;
const MAX_ESCALATIONS_PER_PLANT_PER_DAY = 1;

function nowIso() {
  return new Date().toISOString();
}

function utcDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function parseWindow(reminderWindow: string) {
  const normalized = reminderWindow.trim();
  const split = normalized.split("-").map((part) => part.trim());
  if (split.length !== 2) {
    return { fromMin: 7 * 60, toMin: 9 * 60, label: "07:00 AM - 09:00 AM" };
  }

  const from = parseMeridian(split[0]);
  const to = parseMeridian(split[1]);
  if (from === null || to === null) {
    return { fromMin: 7 * 60, toMin: 9 * 60, label: "07:00 AM - 09:00 AM" };
  }
  return { fromMin: from, toMin: to, label: `${split[0]} - ${split[1]}` };
}

function parseMeridian(input: string) {
  const match = input.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  const rawHour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  const meridian = match[3].toUpperCase();
  if (!Number.isFinite(rawHour) || !Number.isFinite(minute)) return null;
  if (rawHour < 1 || rawHour > 12 || minute < 0 || minute > 59) return null;
  let hour24 = rawHour % 12;
  if (meridian === "PM") hour24 += 12;
  return hour24 * 60 + minute;
}

function isInsideWindow(date: Date, fromMin: number, toMin: number) {
  const mins = date.getUTCHours() * 60 + date.getUTCMinutes();
  if (fromMin <= toMin) {
    return mins >= fromMin && mins <= toMin;
  }
  return mins >= fromMin || mins <= toMin;
}

function scheduleForWindow(now: Date, fromMin: number, toMin: number) {
  const inside = isInsideWindow(now, fromMin, toMin);
  if (inside) {
    return now.toISOString();
  }
  const scheduled = new Date(now);
  const hour = Math.floor(fromMin / 60);
  const minute = fromMin % 60;
  scheduled.setUTCHours(hour, minute, 0, 0);
  if (scheduled.getTime() < now.getTime()) {
    scheduled.setUTCDate(scheduled.getUTCDate() + 1);
  }
  return scheduled.toISOString();
}

async function getCurrentWorkspaceUserId() {
  const session = await readSession();
  if (!session) return null;
  return upsertWorkspaceProfile(session);
}

function buildWateringSkipMap(
  forecasts: PlantWateringForecast[],
  targetDate: string,
) {
  const skip = new Set<string>();
  const water = new Set<string>();
  for (const forecast of forecasts) {
    const day = forecast.days.find((entry) => entry.date === targetDate);
    if (!day) continue;
    if (day.label === "skip") skip.add(forecast.plant_id);
    if (day.label === "water") water.add(forecast.plant_id);
  }
  return { skip, water };
}

function priorityOrder(priority: CarePlanAction["priority"]) {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function isOverdue(action: CarePlanAction, targetDate: string) {
  return action.due_date < targetDate;
}

function shouldSuppressWatering(
  action: CarePlanAction,
  waterState: ReturnType<typeof buildWateringSkipMap>,
) {
  if (!action.plant_id) return false;
  if (action.type === "skip_water") return true;
  if (action.type !== "water") return false;
  return waterState.skip.has(action.plant_id);
}

function makeDeliveryPayload(action: CarePlanAction): ReminderSendPayload {
  const subject = `BloomPilot: ${action.title}`;
  const title = action.plant_name
    ? `${action.title} - ${action.plant_name}`
    : action.title;
  return {
    subject,
    title,
    message: action.reason,
    items: action.evidence_refs.map((entry) => `${entry.source}: ${entry.supports}`),
  };
}

function isLowPriorityDigest(action: CarePlanAction) {
  return action.priority === "low";
}

async function readDedupKeys(userId: number, fromIso: string) {
  const database = getDatabase();
  const rows = database
    .prepare(
      `
      SELECT idempotency_key
      FROM reminder_deliveries
      WHERE user_id = ?
        AND datetime(created_at) >= datetime(?)
      `,
    )
    .all(userId, fromIso) as { idempotency_key: string }[];
  return new Set(rows.map((row) => row.idempotency_key));
}

function initChannelStats(): Record<ReminderChannel, ChannelStats> {
  return {
    email: { sent: 0, queued: 0, failed: 0, suppressed: 0 },
    push: { sent: 0, queued: 0, failed: 0, suppressed: 0 },
    whatsapp: { sent: 0, queued: 0, failed: 0, suppressed: 0 },
  };
}

export async function runReminderSweep(trigger = "manual") {
  const session = await readSession();
  if (!session) return null;

  const userId = await getCurrentWorkspaceUserId();
  if (!userId) return null;

  const plan = readLatestCarePlan(userId);
  if (!plan) return null;

  const now = new Date();
  const today = utcDate(now);
  const window = parseWindow(session.reminderWindow);
  const scheduledFor = scheduleForWindow(now, window.fromMin, window.toMin);
  const waterState = buildWateringSkipMap(plan.watering_forecast, today);
  const dedupeFrom = new Date(now.getTime() - DEDUPE_HOURS * 60 * 60 * 1000).toISOString();
  const recentKeys = await readDedupKeys(userId, dedupeFrom);

  const approved = [...plan.today_actions, ...plan.care_calendar.flatMap((g) => g.tasks)]
    .filter((action) => action.status === "approved")
    .sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));

  const channelStats = initChannelStats();
  const suppressions: ReminderSuppression[] = [];
  const remindersPerPlant = new Map<string, number>();
  const escalationsPerPlant = new Map<string, number>();
  const wateringSeenPerPlant = new Set<string>();
  const candidates: ReminderCandidate[] = [];

  const channels = session.channels.length > 0 ? session.channels : (["email"] as NotificationChannel[]);
  const reminderChannels = channels as ReminderChannel[];

  for (const action of approved) {
    const taskId = action.id;
    const plantId = action.plant_id;

    if (shouldSuppressWatering(action, waterState)) {
      for (const channel of reminderChannels) {
        suppressions.push({
          channel,
          task_id: taskId,
          plant_id: plantId,
          reason: "watering_suppressed_by_weather_or_skip_rule",
        });
        channelStats[channel].suppressed += 1;
      }
      continue;
    }

    if (plantId && action.type === "water") {
      if (wateringSeenPerPlant.has(plantId)) {
        for (const channel of reminderChannels) {
          suppressions.push({
            channel,
            task_id: taskId,
            plant_id: plantId,
            reason: "duplicate_watering_in_same_window",
          });
          channelStats[channel].suppressed += 1;
        }
        continue;
      }
      wateringSeenPerPlant.add(plantId);
    }

    if (plantId) {
      const count = remindersPerPlant.get(plantId) ?? 0;
      if (count >= MAX_REMINDERS_PER_PLANT_PER_DAY) {
        for (const channel of reminderChannels) {
          suppressions.push({
            channel,
            task_id: taskId,
            plant_id: plantId,
            reason: "max_reminders_per_plant_per_day_reached",
          });
          channelStats[channel].suppressed += 1;
        }
        continue;
      }
    }

    const escalation = action.priority === "high" && isOverdue(action, today);
    if (plantId && escalation) {
      const escalations = escalationsPerPlant.get(plantId) ?? 0;
      if (escalations >= MAX_ESCALATIONS_PER_PLANT_PER_DAY) {
        for (const channel of reminderChannels) {
          suppressions.push({
            channel,
            task_id: taskId,
            plant_id: plantId,
            reason: "max_escalations_per_plant_per_day_reached",
          });
          channelStats[channel].suppressed += 1;
        }
        continue;
      }
      escalationsPerPlant.set(plantId, escalations + 1);
    }

    if (plantId) {
      remindersPerPlant.set(plantId, (remindersPerPlant.get(plantId) ?? 0) + 1);
    }

    for (const channel of reminderChannels) {
      const idempotencyKey = [
        userId,
        taskId,
        channel,
        utcDate(scheduledFor),
        window.label,
        escalation ? "esc" : "base",
      ].join(":");

      if (recentKeys.has(idempotencyKey)) {
        suppressions.push({
          channel,
          task_id: taskId,
          plant_id: plantId,
          reason: "idempotency_duplicate_within_dedupe_window",
        });
        channelStats[channel].suppressed += 1;
        continue;
      }
      recentKeys.add(idempotencyKey);

      candidates.push({
        taskId,
        plantId,
        plantName: action.plant_name,
        channel,
        priority: action.priority,
        dueDate: action.due_date,
        isWatering: action.type === "water",
        isEscalation: escalation,
        title: action.title,
        message: action.reason,
        idempotencyKey,
        scheduledFor,
        payload: makeDeliveryPayload(action),
      });
    }
  }

  const lowPriorityDigest = approved.filter(isLowPriorityDigest);
  if (lowPriorityDigest.length > 0) {
    for (const channel of reminderChannels) {
      const digestTaskId = `digest:${today}`;
      const digestKey = `${userId}:${digestTaskId}:${channel}:${utcDate(scheduledFor)}:${window.label}`;
      if (recentKeys.has(digestKey)) {
        suppressions.push({
          channel,
          task_id: digestTaskId,
          plant_id: null,
          reason: "low_priority_digest_duplicate",
        });
        channelStats[channel].suppressed += 1;
        continue;
      }
      recentKeys.add(digestKey);
      candidates.push({
        taskId: digestTaskId,
        plantId: null,
        plantName: "Garden",
        channel,
        priority: "low",
        dueDate: today,
        isWatering: false,
        isEscalation: false,
        title: "Low-priority care digest",
        message: `${lowPriorityDigest.length} low-priority care actions grouped in one digest.`,
        idempotencyKey: digestKey,
        scheduledFor,
        payload: {
          subject: "BloomPilot: low-priority care digest",
          title: "Low-priority care digest",
          message: `${lowPriorityDigest.length} low-priority care actions are grouped for this window.`,
          items: lowPriorityDigest.map((item) => `${item.title} - ${item.plant_name}`),
        },
      });
    }
  }

  const db = getDatabase();
  const runId = crypto.randomUUID();
  const createdAt = nowIso();
  const deliveries: ReminderDelivery[] = [];
  const persistedRows: ReminderDeliveryRow[] = [];

  const pushSubscriptions = db
    .prepare(
      `
      SELECT endpoint, p256dh, auth
      FROM notification_subscriptions
      WHERE user_id = ? AND active = 1
      `,
    )
    .all(userId) as SubscriptionRow[];

  for (const candidate of candidates) {
    let result: ReminderSendResult;
    if (candidate.channel === "email") {
      result = await sendEmailReminder({
        to: session.email,
        payload: candidate.payload,
      });
    } else if (candidate.channel === "push") {
      if (pushSubscriptions.length === 0) {
        result = {
          status: "failed",
          error_code: "no_active_push_subscriptions",
          error_message: "No active browser push subscription found.",
        };
      } else {
        const pushResults = await Promise.all(
          pushSubscriptions.map((subscription) =>
            sendWebPushReminder({
              subscription: subscription as PushSubscriptionRecord,
              payload: candidate.payload,
            }),
          ),
        );
        const success = pushResults.find((entry) => entry.status === "sent");
        result = success ?? pushResults[0];
      }
    } else {
      result = await queueWhatsAppReminder({
        toNumber: session.whatsappNumber ?? null,
        payload: candidate.payload,
      });
    }

    if (result.status === "sent") channelStats[candidate.channel].sent += 1;
    if (result.status === "queued") channelStats[candidate.channel].queued += 1;
    if (result.status === "failed") channelStats[candidate.channel].failed += 1;

    const deliveryId = crypto.randomUUID();
    const status = result.status;
    deliveries.push({
      id: deliveryId,
      channel: candidate.channel,
      status,
      title: candidate.title,
      preview: candidate.message,
      scheduledWindow: window.label,
      items: candidate.payload.items,
    });

    persistedRows.push({
      id: deliveryId,
      run_id: runId,
      user_id: userId,
      task_id: candidate.taskId,
      plant_id: candidate.plantId,
      channel: candidate.channel,
      status,
      scheduled_for: candidate.scheduledFor,
      sent_at: status === "sent" ? createdAt : null,
      provider_message_id: result.provider_message_id ?? null,
      idempotency_key: candidate.idempotencyKey,
      error_code: result.error_code ?? null,
      error_message: result.error_message ?? null,
      payload_json: JSON.stringify(candidate.payload),
      created_at: createdAt,
    });
  }

  const sentCount =
    channelStats.email.sent + channelStats.push.sent + channelStats.whatsapp.sent;
  const queuedCount =
    channelStats.email.queued + channelStats.push.queued + channelStats.whatsapp.queued;
  const failedCount =
    channelStats.email.failed + channelStats.push.failed + channelStats.whatsapp.failed;
  const suppressedCount =
    channelStats.email.suppressed +
    channelStats.push.suppressed +
    channelStats.whatsapp.suppressed;

  const payload: ReminderRunPayload = {
    headline:
      deliveries.length > 0
        ? `Reminder pipeline processed ${deliveries.length} deliveries.`
        : "No eligible reminders after policy checks.",
    summary:
      sentCount > 0
        ? `${sentCount} reminder${sentCount === 1 ? "" : "s"} sent across active channels.`
        : "No reminders were sent in this run.",
    deliveryCount: deliveries.length,
    urgentCount: plan.today_actions.filter((item) => item.priority === "high").length,
    deliveries,
    notes: [
      `Window: ${window.label}`,
      `Suppressed: ${suppressedCount}`,
      `Failed: ${failedCount}`,
      `Queued (WhatsApp deferred): ${queuedCount}`,
    ],
    sent_count: sentCount,
    queued_count: queuedCount,
    suppressed_count: suppressedCount,
    failed_count: failedCount,
    channel_stats: channelStats,
    suppression_reasons: suppressions,
  };

  withTransaction((database) => {
    database
      .prepare(
        `
        INSERT INTO reminder_runs (id, user_id, trigger, created_at, payload_json)
        VALUES (?, ?, ?, ?, ?)
        `,
      )
      .run(runId, userId, trigger, createdAt, JSON.stringify(payload));

    const insertDelivery = database.prepare(
      `
      INSERT INTO reminder_deliveries (
        id, run_id, user_id, task_id, plant_id, channel, status, scheduled_for,
        sent_at, provider_message_id, idempotency_key, error_code, error_message,
        payload_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );

    for (const row of persistedRows) {
      insertDelivery.run(
        row.id,
        row.run_id,
        row.user_id,
        row.task_id,
        row.plant_id,
        row.channel,
        row.status,
        row.scheduled_for,
        row.sent_at,
        row.provider_message_id,
        row.idempotency_key,
        row.error_code,
        row.error_message,
        row.payload_json,
        row.created_at,
      );
    }
  });

  return {
    id: runId,
    trigger,
    createdAt,
    payload,
  } satisfies StoredReminderRun;
}

export async function readLatestReminderRun() {
  const userId = await getCurrentWorkspaceUserId();
  if (!userId) return null;

  const database = getDatabase();
  const row = database
    .prepare(
      `
      SELECT id, trigger, created_at, payload_json
      FROM reminder_runs
      WHERE user_id = ?
      ORDER BY datetime(created_at) DESC
      LIMIT 1
      `,
    )
    .get(userId) as ReminderRunRow | undefined;

  if (!row) return null;

  try {
    return {
      id: row.id,
      trigger: row.trigger,
      createdAt: row.created_at,
      payload: JSON.parse(row.payload_json) as ReminderRunPayload,
    } satisfies StoredReminderRun;
  } catch {
    return null;
  }
}

export async function readOrCreateLatestReminderRun() {
  const latest = await readLatestReminderRun();
  if (latest) return latest;
  return runReminderSweep("auto");
}

export async function upsertPushSubscription(params: {
  userId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) {
  const database = getDatabase();
  const now = nowIso();
  const existing = database
    .prepare(
      `SELECT id FROM notification_subscriptions WHERE endpoint = ? LIMIT 1`,
    )
    .get(params.endpoint) as { id: string } | undefined;

  if (existing) {
    database
      .prepare(
        `
        UPDATE notification_subscriptions
        SET user_id = ?, p256dh = ?, auth = ?, user_agent = ?, active = 1, updated_at = ?
        WHERE endpoint = ?
        `,
      )
      .run(
        params.userId,
        params.p256dh,
        params.auth,
        params.userAgent ?? null,
        now,
        params.endpoint,
      );
    return existing.id;
  }

  const id = crypto.randomUUID();
  database
    .prepare(
      `
      INSERT INTO notification_subscriptions (
        id, user_id, endpoint, p256dh, auth, user_agent, active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `,
    )
    .run(
      id,
      params.userId,
      params.endpoint,
      params.p256dh,
      params.auth,
      params.userAgent ?? null,
      now,
      now,
    );
  return id;
}

export async function deactivatePushSubscription(params: {
  userId: number;
  endpoint: string;
}) {
  const database = getDatabase();
  const now = nowIso();
  const result = database
    .prepare(
      `
      UPDATE notification_subscriptions
      SET active = 0, updated_at = ?
      WHERE user_id = ? AND endpoint = ?
      `,
    )
    .run(now, params.userId, params.endpoint) as { changes?: number };

  return (result.changes ?? 0) > 0;
}
