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
import { sendTelegramNotification } from "@/lib/notifications/telegram";
import {
  extractReminderChannels,
  formatReminderChannelSequence,
  normalizeReminderChannels,
  describeReminderMode,
} from "@/lib/reminder-channels";
import type {
  ReminderChannel,
  ReminderSendPayload,
  ReminderSendResult,
} from "@/lib/notifications/types";
import { isReminderWindowActive, parseWindow } from "@/lib/reminder-window";
import { readSession, type NotificationChannel } from "@/lib/session";
import { upsertWorkspaceProfile } from "@/lib/workspace-store";

export { isReminderWindowActive, parseWindow } from "@/lib/reminder-window";

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
  isEscalation: boolean;
  title: string;
  message: string;
  idempotencyKey: string;
  scheduledFor: string;
  payload: ReminderSendPayload;
};

type ReminderSuppression = {
  channel: ReminderChannel | "all";
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

type ReminderHistoryRow = {
  task_id: string | null;
  plant_id: string | null;
  status: string;
  created_at: string;
  idempotency_key: string;
};

type ReminderHistoryState = {
  recentKeys: Set<string>;
  existingEventCount: number;
  perPlantEventCounts: Map<string, number>;
  escalationCounts: Map<string, number>;
  lastLiveEventAt: Date | null;
};

export type ReminderDelivery = {
  id: string;
  channel: NotificationChannel;
  status: "sent" | "queued" | "failed";
  title: string;
  preview: string;
  scheduledWindow: string;
  items: string[];
  errorCode?: string | null;
  errorMessage?: string | null;
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

export type ReminderUserProfile = {
  userId: number;
  email: string;
  reminderWindow: string;
  channels: NotificationChannel[];
  telegramChatId: string | null;
  timezone: string | null;
  onboarded: boolean;
};

export type ReminderChannelReadiness = {
  inApp: true;
  email: boolean;
  pushSelected: boolean;
  pushReady: boolean;
  pushSubscriptionCount: number;
  telegramSelected: boolean;
  telegramReady: boolean;
  telegramChatId: string | null;
  reminderWindow: string;
};

const DEDUPE_HOURS = 6;
const MAX_REMINDERS_PER_PLANT_PER_DAY = 2;
const MAX_ESCALATIONS_PER_PLANT_PER_DAY = 1;
const MAX_REMINDER_EVENTS_PER_USER_PER_DAY = 5;
const MIN_MINUTES_BETWEEN_LIVE_EVENTS = 75;

function nowIso() {
  return new Date().toISOString();
}

function parseChannels(raw: string): NotificationChannel[] {
  try {
    return normalizeReminderChannels(extractReminderChannels(JSON.parse(raw)), ["email"]);
  } catch {
    return ["email"];
  }
}

async function readReminderUserProfile(userId: number) {
  const database = await getDatabase();
  const row = await database
    .prepare(
      `
      SELECT id, email, reminder_window, channels_json, telegram_chat_id, timezone, onboarded
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
    )
    .get(userId) as
      | {
          id: number;
          email: string;
          reminder_window: string;
          channels_json: string;
          telegram_chat_id: string | null;
          timezone: string | null;
          onboarded: number;
        }
      | undefined;

  if (!row) return null;

  return {
    userId: row.id,
    email: row.email,
    reminderWindow: row.reminder_window,
    channels: parseChannels(row.channels_json),
    telegramChatId: row.telegram_chat_id,
    timezone: row.timezone,
    onboarded: Boolean(row.onboarded),
  } satisfies ReminderUserProfile;
}

export async function readAllReminderUserProfiles() {
  const database = await getDatabase();
  const rows = await database
    .prepare(
      `
      SELECT id, email, reminder_window, channels_json, telegram_chat_id, timezone, onboarded
      FROM users
      WHERE onboarded = 1
      `,
    )
    .all() as Array<{
      id: number;
      email: string;
      reminder_window: string;
      channels_json: string;
      telegram_chat_id: string | null;
      timezone: string | null;
      onboarded: number;
    }>;

  return rows.map(
    (row) =>
      ({
        userId: row.id,
        email: row.email,
        reminderWindow: row.reminder_window,
        channels: parseChannels(row.channels_json),
        telegramChatId: row.telegram_chat_id,
        timezone: row.timezone,
        onboarded: Boolean(row.onboarded),
      }) satisfies ReminderUserProfile,
  );
}

export async function readCurrentReminderChannelReadiness() {
  const session = await readSession();
  if (!session) return null;

  const userId = await getCurrentWorkspaceUserId();
  if (!userId) return null;

  const profile = await readReminderUserProfile(userId);
  if (!profile) return null;

  const database = await getDatabase();
  const pushSubscriptionCount = await database
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM notification_subscriptions
      WHERE user_id = ? AND active = 1
      `,
    )
    .get(userId) as { count: number };

  return {
    inApp: true,
    email: profile.channels.includes("email"),
    pushSelected: profile.channels.includes("push"),
    pushReady:
      profile.channels.includes("push") && (pushSubscriptionCount.count ?? 0) > 0,
    pushSubscriptionCount: pushSubscriptionCount.count ?? 0,
    telegramSelected: profile.channels.includes("telegram"),
    telegramReady:
      profile.channels.includes("telegram") && Boolean(profile.telegramChatId),
    telegramChatId: profile.telegramChatId,
    reminderWindow: profile.reminderWindow,
  } satisfies ReminderChannelReadiness;
}

function getZonedParts(date: Date, timezone: string | null) {
  const timeZone = timezone || "UTC";

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const read = (type: string, fallback: string) =>
      parts.find((part) => part.type === type)?.value ?? fallback;

    const year = Number.parseInt(read("year", "1970"), 10);
    const month = Number.parseInt(read("month", "01"), 10);
    const day = Number.parseInt(read("day", "01"), 10);
    let hour = Number.parseInt(read("hour", "00"), 10);
    if (hour === 24) hour = 0;
    const minute = Number.parseInt(read("minute", "00"), 10);

    return { year, month, day, hour, minute };
  } catch {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
    };
  }
}

function zonedDateLabel(date: Date | string, timezone: string | null) {
  const source = typeof date === "string" ? new Date(date) : date;
  const { year, month, day } = getZonedParts(source, timezone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function zonedMinutesOfDay(date: Date, timezone: string | null) {
  const { hour, minute } = getZonedParts(date, timezone);
  return hour * 60 + minute;
}

function normalizeWindowRange(fromMin: number, toMin: number) {
  if (fromMin <= toMin) {
    return { start: fromMin, end: toMin };
  }
  return { start: fromMin, end: toMin + 24 * 60 };
}

function normalizeCurrentMinutes(
  currentMinutes: number,
  fromMin: number,
  toMin: number,
) {
  if (fromMin <= toMin) return currentMinutes;
  return currentMinutes < fromMin ? currentMinutes + 24 * 60 : currentMinutes;
}

function getSlotMinute(
  action: Pick<CarePlanAction, "priority">,
  isEscalation: boolean,
  fromMin: number,
  toMin: number,
) {
  const { start, end } = normalizeWindowRange(fromMin, toMin);
  const span = end - start;
  if (isEscalation) return Math.max(start, end - 30);
  if (action.priority === "high") return start;
  if (action.priority === "medium") return start + Math.floor(span / 2);
  return start + Math.floor((span * 3) / 4);
}

function isSlotDueNow(
  date: Date,
  timezone: string | null,
  fromMin: number,
  toMin: number,
  slotMinute: number,
) {
  const current = normalizeCurrentMinutes(
    zonedMinutesOfDay(date, timezone),
    fromMin,
    toMin,
  );
  return current >= slotMinute;
}

function minutesSince(date: Date, previous: Date | null) {
  if (!previous) return Number.POSITIVE_INFINITY;
  return Math.floor((date.getTime() - previous.getTime()) / (60 * 1000));
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
  for (const forecast of forecasts) {
    const day = forecast.days.find((entry) => entry.date === targetDate);
    if (day?.label === "skip") skip.add(forecast.plant_id);
  }
  return { skip };
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

function buildIdempotencyKey(params: {
  userId: number;
  taskId: string;
  channel: ReminderChannel;
  localDate: string;
  windowLabel: string;
  phase: "base" | "esc" | "digest";
}) {
  return [
    "bp",
    params.userId,
    params.taskId,
    params.channel,
    params.localDate,
    params.windowLabel.replaceAll("|", "/"),
    params.phase,
  ].join("|");
}

function initChannelStats(): Record<ReminderChannel, ChannelStats> {
  return {
    email: { sent: 0, queued: 0, failed: 0, suppressed: 0 },
    push: { sent: 0, queued: 0, failed: 0, suppressed: 0 },
    telegram: { sent: 0, queued: 0, failed: 0, suppressed: 0 },
  };
}

async function readReminderHistoryState(params: {
  userId: number;
  fromIso: string;
  localDate: string;
  timezone: string | null;
}) {
  const database = await getDatabase();
  const rows = await database
    .prepare(
      `
      SELECT task_id, plant_id, status, created_at, idempotency_key
      FROM reminder_deliveries
      WHERE user_id = ?
        AND datetime(created_at) >= datetime(?)
      `,
    )
    .all(params.userId, params.fromIso) as ReminderHistoryRow[];

  const recentKeys = new Set<string>();
  const perPlantEventCounts = new Map<string, number>();
  const escalationCounts = new Map<string, number>();
  const seenDailyTasks = new Set<string>();
  let lastLiveEventAt: Date | null = null;

  for (const row of rows) {
    recentKeys.add(row.idempotency_key);

    if (row.status !== "sent" && row.status !== "queued") continue;

    const createdAt = new Date(row.created_at);
    if (Number.isNaN(createdAt.getTime())) continue;

    if (!lastLiveEventAt || createdAt.getTime() > lastLiveEventAt.getTime()) {
      lastLiveEventAt = createdAt;
    }

    if (zonedDateLabel(createdAt, params.timezone) !== params.localDate) continue;
    if (!row.task_id) continue;
    if (seenDailyTasks.has(row.task_id)) continue;
    seenDailyTasks.add(row.task_id);

    if (row.plant_id) {
      perPlantEventCounts.set(
        row.plant_id,
        (perPlantEventCounts.get(row.plant_id) ?? 0) + 1,
      );
      if (row.idempotency_key.endsWith("|esc")) {
        escalationCounts.set(
          row.plant_id,
          (escalationCounts.get(row.plant_id) ?? 0) + 1,
        );
      }
    }
  }

  return {
    recentKeys,
    existingEventCount: seenDailyTasks.size,
    perPlantEventCounts,
    escalationCounts,
    lastLiveEventAt,
  } satisfies ReminderHistoryState;
}

function isLowPriorityDigest(action: CarePlanAction) {
  return action.priority === "low";
}

async function runReminderSweepForProfile(
  profile: ReminderUserProfile,
  trigger: string,
) {
  if (!profile.onboarded) return null;

  const plan = await readLatestCarePlan(profile.userId);
  if (!plan) return null;

  const now = new Date();
  const timezone = profile.timezone || "UTC";
  const localDate = zonedDateLabel(now, timezone);
  const window = parseWindow(profile.reminderWindow);
  const activeWindow = isReminderWindowActive(profile, now);
  const waterState = buildWateringSkipMap(plan.watering_forecast, localDate);
  const dedupeFrom = new Date(now.getTime() - DEDUPE_HOURS * 60 * 60 * 1000).toISOString();
  const history = await readReminderHistoryState({
    userId: profile.userId,
    fromIso: dedupeFrom,
    localDate,
    timezone,
  });

  const approved = Array.from(
    new Map(
      [...plan.today_actions, ...plan.care_calendar.flatMap((group) => group.tasks)]
        .filter((action) => action.status === "approved")
        .map((action) => [action.id, action] as const),
    ).values(),
  ).sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));

  const channels =
    profile.channels.length > 0 ? profile.channels : (["email"] as NotificationChannel[]);
  const reminderChannels = normalizeReminderChannels(channels as ReminderChannel[], ["email"]);
  const reminderMode = describeReminderMode(reminderChannels);
  const reminderOrder = formatReminderChannelSequence(reminderChannels);
  const channelStats = initChannelStats();
  const suppressions: ReminderSuppression[] = [];
  const perPlantCounts = new Map(history.perPlantEventCounts);
  const escalationsPerPlant = new Map(history.escalationCounts);
  const wateringSeenPerPlant = new Set<string>();
  const candidates: ReminderCandidate[] = [];
  let dailyEventCount = history.existingEventCount;
  let lastLiveEventAt = history.lastLiveEventAt;

  const liveActions = approved.filter((action) => !isLowPriorityDigest(action));
  const lowPriorityActions = approved.filter(isLowPriorityDigest);

  for (const action of liveActions) {
    const taskId = action.id;
    const plantId = action.plant_id;

    if (!activeWindow) {
      suppressions.push({
        channel: "all",
        task_id: taskId,
        plant_id: plantId,
        reason: "outside_reminder_window",
      });
      for (const channel of reminderChannels) channelStats[channel].suppressed += 1;
      continue;
    }

    const escalation = action.priority === "high" && isOverdue(action, localDate);
    const slotMinute = getSlotMinute(action, escalation, window.fromMin, window.toMin);

    if (!isSlotDueNow(now, timezone, window.fromMin, window.toMin, slotMinute)) {
      suppressions.push({
        channel: "all",
        task_id: taskId,
        plant_id: plantId,
        reason: "not_due_in_window_yet",
      });
      for (const channel of reminderChannels) channelStats[channel].suppressed += 1;
      continue;
    }

    if (shouldSuppressWatering(action, waterState)) {
      suppressions.push({
        channel: "all",
        task_id: taskId,
        plant_id: plantId,
        reason: "watering_suppressed_by_weather_or_skip_rule",
      });
      for (const channel of reminderChannels) channelStats[channel].suppressed += 1;
      continue;
    }

    if (plantId && action.type === "water") {
      if (wateringSeenPerPlant.has(plantId)) {
        suppressions.push({
          channel: "all",
          task_id: taskId,
          plant_id: plantId,
          reason: "duplicate_watering_in_same_window",
        });
        for (const channel of reminderChannels) channelStats[channel].suppressed += 1;
        continue;
      }
      wateringSeenPerPlant.add(plantId);
    }

    if (dailyEventCount >= MAX_REMINDER_EVENTS_PER_USER_PER_DAY) {
      suppressions.push({
        channel: "all",
        task_id: taskId,
        plant_id: plantId,
        reason: "max_reminder_events_per_user_per_day_reached",
      });
      for (const channel of reminderChannels) channelStats[channel].suppressed += 1;
      continue;
    }

    if (minutesSince(now, lastLiveEventAt) < MIN_MINUTES_BETWEEN_LIVE_EVENTS) {
      suppressions.push({
        channel: "all",
        task_id: taskId,
        plant_id: plantId,
        reason: "minimum_spacing_between_live_reminders_not_elapsed",
      });
      for (const channel of reminderChannels) channelStats[channel].suppressed += 1;
      continue;
    }

    if (plantId) {
      const existingPlantCount = perPlantCounts.get(plantId) ?? 0;
      if (existingPlantCount >= MAX_REMINDERS_PER_PLANT_PER_DAY) {
        suppressions.push({
          channel: "all",
          task_id: taskId,
          plant_id: plantId,
          reason: "max_reminders_per_plant_per_day_reached",
        });
        for (const channel of reminderChannels) channelStats[channel].suppressed += 1;
        continue;
      }
    }

    if (plantId && escalation) {
      const existingEscalations = escalationsPerPlant.get(plantId) ?? 0;
      if (existingEscalations >= MAX_ESCALATIONS_PER_PLANT_PER_DAY) {
        suppressions.push({
          channel: "all",
          task_id: taskId,
          plant_id: plantId,
          reason: "max_escalations_per_plant_per_day_reached",
        });
        for (const channel of reminderChannels) channelStats[channel].suppressed += 1;
        continue;
      }
    }

    let eventAccepted = false;

    for (const channel of reminderChannels) {
      const idempotencyKey = buildIdempotencyKey({
        userId: profile.userId,
        taskId,
        channel,
        localDate,
        windowLabel: window.label,
        phase: escalation ? "esc" : "base",
      });

      if (history.recentKeys.has(idempotencyKey)) {
        suppressions.push({
          channel,
          task_id: taskId,
          plant_id: plantId,
          reason: "idempotency_duplicate_within_dedupe_window",
        });
        channelStats[channel].suppressed += 1;
        continue;
      }

      history.recentKeys.add(idempotencyKey);
      eventAccepted = true;

      candidates.push({
        taskId,
        plantId,
        plantName: action.plant_name,
        channel,
        priority: action.priority,
        dueDate: action.due_date,
        isEscalation: escalation,
        title: action.title,
        message: action.reason,
        idempotencyKey,
        scheduledFor: now.toISOString(),
        payload: makeDeliveryPayload(action),
      });
    }

    if (eventAccepted) {
      dailyEventCount += 1;
      lastLiveEventAt = now;
      if (plantId) {
        perPlantCounts.set(plantId, (perPlantCounts.get(plantId) ?? 0) + 1);
        if (escalation) {
          escalationsPerPlant.set(
            plantId,
            (escalationsPerPlant.get(plantId) ?? 0) + 1,
          );
        }
      }
    }
  }

  if (lowPriorityActions.length > 0) {
    const digestTaskId = `digest-${localDate}`;
    const digestSlotMinute = getSlotMinute(
      { priority: "low" },
      false,
      window.fromMin,
      window.toMin,
    );
    const digestChannels = reminderChannels.filter(
      (channel) => channel === "email" || channel === "push",
    );

    if (!activeWindow) {
      suppressions.push({
        channel: "all",
        task_id: digestTaskId,
        plant_id: null,
        reason: "outside_reminder_window",
      });
      for (const channel of digestChannels) channelStats[channel].suppressed += 1;
    } else if (!isSlotDueNow(now, timezone, window.fromMin, window.toMin, digestSlotMinute)) {
      suppressions.push({
        channel: "all",
        task_id: digestTaskId,
        plant_id: null,
        reason: "digest_not_due_in_window_yet",
      });
      for (const channel of digestChannels) channelStats[channel].suppressed += 1;
    } else if (dailyEventCount >= MAX_REMINDER_EVENTS_PER_USER_PER_DAY) {
      suppressions.push({
        channel: "all",
        task_id: digestTaskId,
        plant_id: null,
        reason: "max_reminder_events_per_user_per_day_reached",
      });
      for (const channel of digestChannels) channelStats[channel].suppressed += 1;
    } else if (minutesSince(now, lastLiveEventAt) < MIN_MINUTES_BETWEEN_LIVE_EVENTS) {
      suppressions.push({
        channel: "all",
        task_id: digestTaskId,
        plant_id: null,
        reason: "minimum_spacing_between_live_reminders_not_elapsed",
      });
      for (const channel of digestChannels) channelStats[channel].suppressed += 1;
    } else {
      let digestAccepted = false;

      for (const channel of digestChannels) {
        const idempotencyKey = buildIdempotencyKey({
          userId: profile.userId,
          taskId: digestTaskId,
          channel,
          localDate,
          windowLabel: window.label,
          phase: "digest",
        });

        if (history.recentKeys.has(idempotencyKey)) {
          suppressions.push({
            channel,
            task_id: digestTaskId,
            plant_id: null,
            reason: "idempotency_duplicate_within_dedupe_window",
          });
          channelStats[channel].suppressed += 1;
          continue;
        }

        history.recentKeys.add(idempotencyKey);
        digestAccepted = true;

        candidates.push({
          taskId: digestTaskId,
          plantId: null,
          plantName: "Garden",
          channel,
          priority: "low",
          dueDate: localDate,
          isEscalation: false,
          title: "Low-priority care digest",
          message: `${lowPriorityActions.length} low-priority care actions grouped into one digest.`,
          idempotencyKey,
          scheduledFor: now.toISOString(),
          payload: {
            subject: "BloomPilot: low-priority care digest",
            title: "Low-priority care digest",
            message: `${lowPriorityActions.length} low-priority care actions are grouped for this window.`,
            items: lowPriorityActions.map(
              (item) => `${item.title} - ${item.plant_name}`,
            ),
          },
        });
      }

      if (digestAccepted) {
        dailyEventCount += 1;
        lastLiveEventAt = now;
      }
    }
  }

  const database = await getDatabase();
  const runId = crypto.randomUUID();
  const createdAt = nowIso();
  const deliveries: ReminderDelivery[] = [];
  const persistedRows: ReminderDeliveryRow[] = [];

  const pushSubscriptions = await database
    .prepare(
      `
      SELECT endpoint, p256dh, auth
      FROM notification_subscriptions
      WHERE user_id = ? AND active = 1
      `,
    )
    .all(profile.userId) as SubscriptionRow[];

  for (const candidate of candidates) {
    if (candidate.channel === "push" && pushSubscriptions.length === 0) {
      channelStats.push.suppressed += 1;
      suppressions.push({
        channel: "push",
        task_id: candidate.taskId,
        plant_id: candidate.plantId,
        reason: "no_active_push_subscription",
      });
      continue;
    }

    if (candidate.channel === "telegram" && !profile.telegramChatId) {
      channelStats.telegram.suppressed += 1;
      suppressions.push({
        channel: "telegram",
        task_id: candidate.taskId,
        plant_id: candidate.plantId,
        reason: "missing_telegram_connection",
      });
      continue;
    }

    let result: ReminderSendResult;

    if (candidate.channel === "email") {
      result = await sendEmailReminder({
        to: profile.email,
        payload: candidate.payload,
      });
    } else if (candidate.channel === "push") {
      const pushResults = await Promise.all(
        pushSubscriptions.map(async (subscription) => ({
          subscription,
          result: await sendWebPushReminder({
            subscription: subscription as PushSubscriptionRecord,
            payload: candidate.payload,
          }),
        })),
      );
      for (const entry of pushResults) {
        if (entry.result.error_code === "push_subscription_expired") {
          await deactivatePushSubscription({
            userId: profile.userId,
            endpoint: entry.subscription.endpoint,
          });
        }
      }
      const success = pushResults.find((entry) => entry.result.status === "sent");
      result = (success ?? pushResults[0]).result;
    } else {
      result = await sendTelegramNotification({
        chatId: profile.telegramChatId,
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
      errorCode: result.error_code ?? null,
      errorMessage: result.error_message ?? null,
    });

    persistedRows.push({
      id: deliveryId,
      run_id: runId,
      user_id: profile.userId,
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
    channelStats.email.sent + channelStats.push.sent + channelStats.telegram.sent;
  const queuedCount =
    channelStats.email.queued + channelStats.push.queued + channelStats.telegram.queued;
  const failedCount =
    channelStats.email.failed + channelStats.push.failed + channelStats.telegram.failed;
  const suppressedCount =
    channelStats.email.suppressed +
    channelStats.push.suppressed +
    channelStats.telegram.suppressed;

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
      `Timezone: ${timezone}`,
      `Window: ${window.label}`,
      `Window active now: ${activeWindow ? "yes" : "no"}`,
      `Reminder mode: ${reminderMode}`,
      `Channel order: ${reminderOrder}`,
      `Caps: ${MAX_REMINDERS_PER_PLANT_PER_DAY}/plant/day, ${MAX_ESCALATIONS_PER_PLANT_PER_DAY} escalation/plant/day, ${MAX_REMINDER_EVENTS_PER_USER_PER_DAY} events/user/day`,
      `Minimum spacing: ${MIN_MINUTES_BETWEEN_LIVE_EVENTS} minutes`,
      `Suppressed: ${suppressedCount}`,
      `Failed: ${failedCount}`,
      `Queued: ${queuedCount}`,
    ],
    sent_count: sentCount,
    queued_count: queuedCount,
    suppressed_count: suppressedCount,
    failed_count: failedCount,
    channel_stats: channelStats,
    suppression_reasons: suppressions,
  };

  await withTransaction(async (db) => {
    await db.prepare(
      `
      INSERT INTO reminder_runs (id, user_id, trigger, created_at, payload_json)
      VALUES (?, ?, ?, ?, ?)
      `,
    ).run(runId, profile.userId, trigger, createdAt, JSON.stringify(payload));

    const insertDelivery = await db.prepare(
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
      await insertDelivery.run(
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

export async function runReminderSweep(trigger = "manual") {
  const session = await readSession();
  if (!session) return null;

  const userId = await getCurrentWorkspaceUserId();
  if (!userId) return null;

  const profile =
    (await readReminderUserProfile(userId)) ??
    ({
      userId,
      email: session.email,
      reminderWindow: session.reminderWindow,
      channels: session.channels,
      telegramChatId: session.telegramChatId ?? null,
      timezone: session.timezone ?? null,
      onboarded: session.onboarded,
    } satisfies ReminderUserProfile);

  return runReminderSweepForProfile(profile, trigger);
}

export async function runReminderSweepForUserId(
  userId: number,
  trigger = "cron",
) {
  const profile = await readReminderUserProfile(userId);
  if (!profile) return null;
  return runReminderSweepForProfile(profile, trigger);
}

export async function readLatestReminderRun() {
  const userId = await getCurrentWorkspaceUserId();
  if (!userId) return null;

  const database = await getDatabase();
  const row = await database
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
    const raw = JSON.parse(row.payload_json) as Record<string, unknown>;
    const rawDeliveries = Array.isArray(raw.deliveries) ? raw.deliveries : [];
    const deliveries: ReminderDelivery[] = rawDeliveries
      .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
      .map((delivery) => ({
        id: typeof delivery.id === "string" ? delivery.id : crypto.randomUUID(),
        channel:
          delivery.channel === "push" || delivery.channel === "telegram"
            ? delivery.channel
            : "email",
        status:
          delivery.status === "failed" || delivery.status === "queued"
            ? delivery.status
            : "sent",
        title: typeof delivery.title === "string" ? delivery.title : "Plant care reminder",
        preview: typeof delivery.preview === "string" ? delivery.preview : "A plant-care task needs attention.",
        scheduledWindow:
          typeof delivery.scheduledWindow === "string" ? delivery.scheduledWindow : "Your reminder window",
        items: Array.isArray(delivery.items)
          ? delivery.items.filter((item): item is string => typeof item === "string")
          : [],
        errorCode: typeof delivery.errorCode === "string" ? delivery.errorCode : null,
        errorMessage: typeof delivery.errorMessage === "string" ? delivery.errorMessage : null,
      }));

    const rawChannelStats = raw.channel_stats && typeof raw.channel_stats === "object"
      ? raw.channel_stats as Partial<Record<ReminderChannel, Partial<ChannelStats>>>
      : {};
    const channelStats = initChannelStats();
    for (const channel of ["email", "push", "telegram"] as const) {
      const stats = rawChannelStats[channel];
      if (!stats) continue;
      channelStats[channel] = {
        sent: typeof stats.sent === "number" ? stats.sent : 0,
        queued: typeof stats.queued === "number" ? stats.queued : 0,
        failed: typeof stats.failed === "number" ? stats.failed : 0,
        suppressed: typeof stats.suppressed === "number" ? stats.suppressed : 0,
      };
    }

    return {
      id: row.id,
      trigger: row.trigger,
      createdAt: row.created_at,
      payload: {
        headline: typeof raw.headline === "string" ? raw.headline : "Reminder check completed.",
        summary: typeof raw.summary === "string" ? raw.summary : "No reminder summary is available.",
        deliveryCount: typeof raw.deliveryCount === "number" ? raw.deliveryCount : deliveries.length,
        urgentCount: typeof raw.urgentCount === "number" ? raw.urgentCount : 0,
        deliveries,
        notes: Array.isArray(raw.notes)
          ? raw.notes.filter((note): note is string => typeof note === "string")
          : [],
        sent_count: typeof raw.sent_count === "number" ? raw.sent_count : 0,
        queued_count: typeof raw.queued_count === "number" ? raw.queued_count : 0,
        suppressed_count: typeof raw.suppressed_count === "number" ? raw.suppressed_count : 0,
        failed_count: typeof raw.failed_count === "number" ? raw.failed_count : 0,
        channel_stats: channelStats,
        suppression_reasons: Array.isArray(raw.suppression_reasons)
          ? raw.suppression_reasons.filter(
              (item): item is ReminderSuppression =>
                Boolean(item) &&
                typeof item === "object" &&
                typeof (item as Record<string, unknown>).channel === "string" &&
                typeof (item as Record<string, unknown>).task_id === "string" &&
                typeof (item as Record<string, unknown>).reason === "string",
            )
          : [],
      },
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
  const database = await getDatabase();
  const now = nowIso();
  const existing = await database
    .prepare(
      `SELECT id FROM notification_subscriptions WHERE endpoint = ? LIMIT 1`,
    )
    .get(params.endpoint) as { id: string } | undefined;

  if (existing) {
    await database
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
  await database
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
  const database = await getDatabase();
  const now = nowIso();
  const result = await database
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
