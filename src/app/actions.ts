"use server";

import { redirect } from "next/navigation";
import {
  clearSession,
  createDemoSession,
  deriveNameFromEmail,
  hashPassword,
  type Gender,
  readSession,
  verifyPassword,
  writeSession,
  type NotificationChannel,
} from "@/lib/session";
import {
  extractReminderChannels,
  normalizeReminderChannels,
} from "@/lib/reminder-channels";
import { normalizeGardenTypeValue } from "@/lib/garden-type";
import {
  clearWorkspaceDerivedCareData,
  readWorkspaceProfileByEmail,
  upsertWorkspaceProfile,
} from "@/lib/workspace-store";
import { issuePasswordResetToken, resetPassword, sendPasswordResetEmail } from "@/lib/password-reset";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/api-handler";

function getChannels(
  formData: FormData,
  fallback: NotificationChannel[] = ["push"],
): NotificationChannel[] {
  const channels = formData
    .getAll("channels")
    .map((value) => value.toString())
    .filter(
      (value): value is NotificationChannel =>
        value === "email" || value === "push" || value === "telegram",
    );

  return normalizeReminderChannels(
    extractReminderChannels(channels),
    fallback,
  );
}

function normalizeChannelsForAvailability(channels: NotificationChannel[]) {
  return normalizeReminderChannels(channels, ["email"]);
}

function parseCoordinate(value: FormDataEntryValue | null, min: number, max: number) {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

function parseAge(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseGender(value: FormDataEntryValue | null): Gender | undefined {
  if (
    value === "Woman" ||
    value === "Man" ||
    value === "Non-binary" ||
    value === "Prefer not to say"
  ) {
    return value;
  }

  return undefined;
}

function parseReminderWindow(formData: FormData, fallback = "") {
  const suggested = formData.get("reminderWindow")?.toString().trim() ?? "";
  const custom = formData.get("customReminderWindow")?.toString().trim() ?? "";

  return custom || suggested || fallback;
}

export async function signUpAction(formData: FormData) {
  const ip = await clientIpFromHeaders();
  if ((await checkRateLimit("sign_up", ip, 5, 3600)).limited) {
    redirect("/sign-up?error=rate_limited");
  }

  const firstName = formData.get("firstName")?.toString().trim() ?? "";
  const lastName = formData.get("lastName")?.toString().trim() ?? "";
  const legacyName = formData.get("name")?.toString().trim() ?? "";
  const name = [firstName, lastName].filter(Boolean).join(" ").trim() || legacyName;
  const email = formData.get("email")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128) {
    redirect("/sign-up?error=invalid");
  }
  if (await readWorkspaceProfileByEmail(email)) {
    redirect("/sign-in?error=exists");
  }

  const nextSession = createDemoSession({
    name,
    age: parseAge(formData.get("age")),
    gender: parseGender(formData.get("gender")),
    email,
    onboarded: false,
  });

  const userId = await upsertWorkspaceProfile(nextSession);
  const { getDatabase } = await import("@/lib/database");
  const db = await getDatabase();
  await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), userId);
  await writeSession(nextSession);

  redirect("/preferences");
}

export async function signInAction(formData: FormData) {
  const email = formData.get("email")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (!email || !password) {
    redirect("/sign-in?error=invalid");
  }

  const ip = await clientIpFromHeaders();
  const [ipLimit, emailLimit] = await Promise.all([
    checkRateLimit("sign_in_ip", ip, 20, 900),
    checkRateLimit("sign_in_email", email.toLowerCase(), 10, 900),
  ]);
  if (ipLimit.limited || emailLimit.limited) {
    redirect("/sign-in?error=rate_limited");
  }

  const { getDatabase } = await import("@/lib/database");
  const storedProfile = await readWorkspaceProfileByEmail(email);
  const db = await getDatabase();
  const storedIdentity = await db.prepare("SELECT password_hash FROM users WHERE email = ?").get(email.toLowerCase()) as { password_hash: string | null } | undefined;
  if (storedProfile && !storedIdentity?.password_hash) {
    redirect("/sign-in?error=password_reset_required");
  }
  if (!storedProfile || !verifyPassword(password, storedIdentity?.password_hash)) {
    redirect("/sign-in?error=invalid");
  }

  const nextSession = createDemoSession({
    name: storedProfile.name || deriveNameFromEmail(email),
    age: storedProfile.age,
    gender: storedProfile.gender,
    email,
    onboarded: storedProfile?.onboarded ?? false,
    location: storedProfile.location,
    latitude: storedProfile.latitude,
    longitude: storedProfile.longitude,
    gardenType: storedProfile.gardenType,
    reminderWindow: storedProfile.reminderWindow,
    channels: storedProfile.channels,
    emailDailyReminder: storedProfile.emailDailyReminder,
    emailWeeklyDigest: storedProfile.emailWeeklyDigest,
    telegramChatId: storedProfile.telegramChatId,
    timezone: storedProfile.timezone,
    countryCode: storedProfile.countryCode,
  });

  await writeSession(nextSession);
  await upsertWorkspaceProfile(nextSession);

  redirect(nextSession.onboarded ? "/dashboard" : "/preferences");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    // Rate limit by email, not IP: keeps the response identical (still "sent=1")
    // whether the account exists, was just reset, or doesn't exist at all, so the
    // account-existence privacy property below isn't undermined by a distinguishable
    // rate-limit response.
    const limited = (await checkRateLimit("password_reset", email, 3, 3600)).limited;
    if (!limited) {
      const request = await issuePasswordResetToken(email);
      if (request) await sendPasswordResetEmail({ to: request.email, name: request.name, token: request.token });
    }
  }

  // Keep account existence private. The same confirmation is shown for every valid request.
  redirect("/forgot-password?sent=1");
}

export async function completePasswordResetAction(formData: FormData) {
  const token = formData.get("token")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const confirmation = formData.get("confirmation")?.toString() ?? "";

  if (!token || password.length < 8 || password.length > 128 || password !== confirmation) {
    redirect(`/reset-password?error=invalid&token=${encodeURIComponent(token)}`);
  }

  if (!(await resetPassword(token, password))) {
    redirect("/reset-password?error=expired");
  }

  redirect("/sign-in?reset=1");
}

export async function completePreferencesAction(formData: FormData) {
  const session = await readSession();

  if (!session) {
    redirect("/sign-in");
  }

  const location = formData.get("location")?.toString().trim() ?? "";
  const latitude = parseCoordinate(formData.get("latitude"), -90, 90);
  const longitude = parseCoordinate(formData.get("longitude"), -180, 180);
  const timezone = formData.get("timezone")?.toString().trim() || undefined;
  const countryCode = formData.get("countryCode")?.toString().trim().toLowerCase() || undefined;
  const name = formData.get("name")?.toString().trim() || session.name;
  const age = parseAge(formData.get("age")) ?? session.age;
  const gender = parseGender(formData.get("gender")) ?? session.gender;
  const gardenType = normalizeGardenTypeValue(formData.get("gardenType")?.toString().trim() ?? session.gardenType);
  const reminderWindow = parseReminderWindow(formData, session.reminderWindow);
  const channels = normalizeChannelsForAvailability(
    getChannels(formData, session.channels.length > 0 ? session.channels : ["push"]),
  );

  const nextSession = createDemoSession({
    name,
    age,
    gender,
    email: session.email,
    location,
    latitude,
    longitude,
    timezone,
    countryCode,
    gardenType,
    reminderWindow,
    channels,
    telegramChatId: session.telegramChatId,
    onboarded: false,
  });

  await writeSession(nextSession);
  const userId = await upsertWorkspaceProfile(nextSession, session.email);
  await clearWorkspaceDerivedCareData(userId);

  redirect("/plant-setup");
}

export async function completeOnboardingAction(formData: FormData) {
  return completePreferencesAction(formData);
}

export async function skipOnboardingAction() {
  const session = await readSession();

  if (!session) {
    redirect("/sign-in");
  }

  const nextSession = createDemoSession({
    ...session,
    onboarded: true,
  });

  await writeSession(nextSession);
  const userId = await upsertWorkspaceProfile(nextSession, session.email);
  await clearWorkspaceDerivedCareData(userId);

  redirect("/dashboard");
}

export async function completePlantSetupAction() {
  const session = await readSession();

  if (!session) {
    redirect("/sign-in");
  }

  const nextSession = createDemoSession({
    ...session,
    onboarded: true,
  });

  await writeSession(nextSession);
  const userId = await upsertWorkspaceProfile(nextSession, session.email);
  await clearWorkspaceDerivedCareData(userId);

  redirect("/agent");
}

export async function updateProfileAction(formData: FormData) {
  const session = await readSession();

  if (!session) {
    redirect("/sign-in");
  }

  const name = formData.get("name")?.toString().trim() ?? session.name;
  const age = parseAge(formData.get("age")) ?? session.age;
  const gender = parseGender(formData.get("gender")) ?? session.gender;
  const email = formData.get("email")?.toString().trim() ?? session.email;
  const location =
    formData.get("location")?.toString().trim() ?? session.location;
  const latitude = parseCoordinate(formData.get("latitude"), -90, 90) ?? session.latitude;
  const longitude = parseCoordinate(formData.get("longitude"), -180, 180) ?? session.longitude;
  const gardenType = normalizeGardenTypeValue(
    formData.get("gardenType")?.toString().trim() ?? session.gardenType,
  );
  const reminderWindow = parseReminderWindow(formData, session.reminderWindow);

  const emailDailyReminder = formData.get("emailDailyReminder") === "1";
  const emailWeeklyDigest = formData.get("emailWeeklyDigest") === "1";
  const channels = normalizeChannelsForAvailability(
    getChannels(formData, session.channels.length > 0 ? session.channels : ["push"]),
  );
  const timezone = formData.get("timezone")?.toString().trim() || session.timezone;
  const countryCode = formData.get("countryCode")?.toString().trim().toLowerCase() || session.countryCode;

  if (email.toLowerCase() !== session.email.toLowerCase() && await readWorkspaceProfileByEmail(email)) {
    redirect("/settings?error=email_exists");
  }

  const nextSession = createDemoSession({
    name,
    age,
    gender,
    email,
    location,
    latitude,
    longitude,
    gardenType,
    reminderWindow,
    channels,
    emailDailyReminder,
    emailWeeklyDigest,
    telegramChatId: session.telegramChatId,
    timezone,
    countryCode,
    onboarded: true,
  });

  await writeSession(nextSession);
  await upsertWorkspaceProfile(nextSession, session.email);

  redirect("/settings?saved=1");
}

export async function signOutAction() {
  await clearSession();
  redirect("/");
}
