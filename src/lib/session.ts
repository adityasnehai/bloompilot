import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { appConfig } from "@/lib/app-config";

export type NotificationChannel = "email" | "push" | "whatsapp";
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
  whatsappNumber?: string;
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
  whatsappNumber?: string;
  timezone?: string;
  countryCode?: string;
};

const DEFAULT_LOCATION = "";
const DEFAULT_GARDEN_TYPE = "";
const DEFAULT_REMINDER_WINDOW = "07:00 AM - 09:00 AM";
const DEFAULT_CHANNELS: NotificationChannel[] = ["email"];

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
    channels:
      input.channels && input.channels.length > 0
        ? input.channels
        : DEFAULT_CHANNELS,
    emailDailyReminder: input.emailDailyReminder !== false,
    emailWeeklyDigest: input.emailWeeklyDigest !== false,
    whatsappNumber: input.whatsappNumber?.trim() || undefined,
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
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<DemoSession>;

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
      channels: Array.isArray(parsed.channels)
        ? parsed.channels.filter(
            (channel): channel is NotificationChannel =>
              channel === "email" || channel === "push" || channel === "whatsapp",
          )
        : DEFAULT_CHANNELS,
      emailDailyReminder: parsed.emailDailyReminder !== false,
      emailWeeklyDigest: parsed.emailWeeklyDigest !== false,
      whatsappNumber: typeof parsed.whatsappNumber === "string" ? parsed.whatsappNumber : undefined,
      timezone: typeof parsed.timezone === "string" ? parsed.timezone : undefined,
      countryCode: typeof parsed.countryCode === "string" ? parsed.countryCode : undefined,
    });
  } catch {
    return null;
  }
}

function serializeSession(session: DemoSession) {
  return encodeURIComponent(JSON.stringify(session));
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
