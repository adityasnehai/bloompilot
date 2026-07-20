import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { appConfig } from "@/lib/app-config";
import {
  extractReminderChannels,
  normalizeReminderChannels,
  type ReminderChannel,
} from "@/lib/reminder-channels";

export type NotificationChannel = ReminderChannel;
export type Gender = "Woman" | "Man" | "Non-binary" | "Prefer not to say";

export type DemoSession = {
  name: string;
  age?: number;
  gender?: Gender;
  email: string;
  location: string;
  latitude?: number;
  longitude?: number;
  gardenType: string;
  reminderWindow: string;
  channels: NotificationChannel[];
  emailDailyReminder: boolean;
  emailWeeklyDigest: boolean;
  telegramChatId?: string;
  timezone?: string;
  countryCode?: string;
  onboarded: boolean;
  joinedAt: string;
};

type SessionInput = {
  email: string;
  name: string;
  age?: number;
  gender?: Gender;
  onboarded: boolean;
  location?: string;
  latitude?: number;
  longitude?: number;
  gardenType?: string;
  reminderWindow?: string;
  channels?: NotificationChannel[];
  emailDailyReminder?: boolean;
  emailWeeklyDigest?: boolean;
  telegramChatId?: string;
  timezone?: string;
  countryCode?: string;
};

const DEFAULT_LOCATION = "";
const DEFAULT_GARDEN_TYPE = "";
const DEFAULT_REMINDER_WINDOW = "07:00 AM - 09:00 AM";
const DEFAULT_CHANNELS: NotificationChannel[] = ["email"];

function sessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be configured in production");
  return "bloompilot-development-session-secret";
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, encoded: string | null | undefined) {
  if (!encoded?.startsWith("scrypt:")) return false;
  const [, salt, expectedHex] = encoded.split(":");
  if (!salt || !expectedHex || !/^[0-9a-f]+$/i.test(expectedHex)) return false;
  try {
    const expected = Buffer.from(expectedHex, "hex");
    const actual = scryptSync(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function deriveNameFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? "gardener";
  return localPart
    .split(/[._-]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function createDemoSession(input: SessionInput): DemoSession {
  const age =
    typeof input.age === "number" && Number.isFinite(input.age) && input.age > 0
      ? Math.floor(input.age)
      : undefined;
  const latitude =
    typeof input.latitude === "number" && Number.isFinite(input.latitude)
      ? input.latitude
      : undefined;
  const longitude =
    typeof input.longitude === "number" && Number.isFinite(input.longitude)
      ? input.longitude
      : undefined;

  return {
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    age,
    gender: input.gender,
    location: input.location?.trim() || DEFAULT_LOCATION,
    latitude,
    longitude,
    gardenType: input.gardenType?.trim() || DEFAULT_GARDEN_TYPE,
    reminderWindow: input.reminderWindow?.trim() || DEFAULT_REMINDER_WINDOW,
    channels: normalizeReminderChannels(
      input.channels && input.channels.length > 0 ? input.channels : DEFAULT_CHANNELS,
      DEFAULT_CHANNELS,
    ),
    emailDailyReminder: input.emailDailyReminder !== false,
    emailWeeklyDigest: input.emailWeeklyDigest !== false,
    telegramChatId: input.telegramChatId?.trim() || undefined,
    timezone: input.timezone?.trim() || undefined,
    countryCode: input.countryCode?.trim().toLowerCase() || undefined,
    onboarded: input.onboarded,
    joinedAt: new Date().toISOString(),
  };
}

export function parseSessionValue(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    const separator = value.lastIndexOf(".");
    if (separator <= 0) return null;
    const payload = value.slice(0, separator);
    const signature = value.slice(separator + 1);
    const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const parsed = JSON.parse(payload) as Partial<DemoSession>;

    if (!parsed.email || !parsed.name) {
      return null;
    }

    return createDemoSession({
      email: parsed.email,
      name: parsed.name,
      age: typeof parsed.age === "number" ? parsed.age : undefined,
      gender:
        parsed.gender === "Woman" ||
        parsed.gender === "Man" ||
        parsed.gender === "Non-binary" ||
        parsed.gender === "Prefer not to say"
          ? parsed.gender
          : undefined,
      onboarded: Boolean(parsed.onboarded),
      location: parsed.location,
      latitude:
        typeof parsed.latitude === "number" ? parsed.latitude : undefined,
      longitude:
        typeof parsed.longitude === "number" ? parsed.longitude : undefined,
      gardenType: parsed.gardenType,
      reminderWindow: parsed.reminderWindow,
      channels: normalizeReminderChannels(
        extractReminderChannels(parsed.channels),
        DEFAULT_CHANNELS,
      ),
      emailDailyReminder: parsed.emailDailyReminder !== false,
      emailWeeklyDigest: parsed.emailWeeklyDigest !== false,
      telegramChatId: typeof parsed.telegramChatId === "string" ? parsed.telegramChatId : undefined,
      timezone: typeof parsed.timezone === "string" ? parsed.timezone : undefined,
      countryCode: typeof parsed.countryCode === "string" ? parsed.countryCode : undefined,
    });
  } catch {
    return null;
  }
}

function serializeSession(session: DemoSession) {
  const payload = JSON.stringify(session);
  const signature = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export async function readSession() {
  const store = await cookies();
  const raw = store.get(appConfig.sessionCookieName)?.value ?? null;
  return parseSessionValue(raw);
}

export async function requireSession() {
  const session = await readSession();

  if (!session) {
    redirect("/sign-in");
  }

  return session;
}

export async function writeSession(session: DemoSession) {
  const store = await cookies();

  store.set(appConfig.sessionCookieName, serializeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(appConfig.sessionCookieName);
}
