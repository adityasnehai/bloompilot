"use server";

import { redirect } from "next/navigation";
import {
  clearSession,
  createDemoSession,
  deriveNameFromEmail,
  type Gender,
  readSession,
  writeSession,
  type NotificationChannel,
} from "@/lib/session";
import {
  clearWorkspaceDerivedCareData,
  readWorkspaceProfileByEmail,
  upsertWorkspaceProfile,
} from "@/lib/workspace-store";

function getChannels(formData: FormData): NotificationChannel[] {
  const channels = formData
    .getAll("channels")
    .map((value) => value.toString())
    .filter(
      (value): value is NotificationChannel =>
        value === "email" || value === "push" || value === "whatsapp",
    );

  return channels.length > 0 ? channels : ["email"];
}

function parseCoordinate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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
  const name = formData.get("name")?.toString().trim() ?? "";
  const email = formData.get("email")?.toString().trim() ?? "";

  if (!name || !email) {
    redirect("/sign-up");
  }

  const nextSession = createDemoSession({
    name,
    age: parseAge(formData.get("age")),
    gender: parseGender(formData.get("gender")),
    email,
    onboarded: false,
  });

  await writeSession(nextSession);
  upsertWorkspaceProfile(nextSession);

  redirect("/preferences");
}

export async function signInAction(formData: FormData) {
  const email = formData.get("email")?.toString().trim() ?? "";

  if (!email) {
    redirect("/sign-in");
  }

  const rememberedSession = await readSession();
  const storedProfile = readWorkspaceProfileByEmail(email);

  const nextSession = createDemoSession({
    name:
      storedProfile?.name ??
      (rememberedSession?.email === email
        ? rememberedSession.name
        : deriveNameFromEmail(email)),
    age: storedProfile?.age ?? rememberedSession?.age,
    gender: storedProfile?.gender ?? rememberedSession?.gender,
    email,
    onboarded: storedProfile?.onboarded ?? false,
    location: storedProfile?.location ?? rememberedSession?.location,
    latitude: storedProfile?.latitude ?? rememberedSession?.latitude,
    longitude: storedProfile?.longitude ?? rememberedSession?.longitude,
    gardenType: storedProfile?.gardenType ?? rememberedSession?.gardenType,
    reminderWindow:
      storedProfile?.reminderWindow ?? rememberedSession?.reminderWindow,
    channels: storedProfile?.channels ?? rememberedSession?.channels,
  });

  await writeSession(nextSession);
  upsertWorkspaceProfile(nextSession);

  redirect(nextSession.onboarded ? "/dashboard" : "/preferences");
}

export async function completePreferencesAction(formData: FormData) {
  const session = await readSession();

  if (!session) {
    redirect("/sign-in");
  }

  const location = formData.get("location")?.toString().trim() ?? "";
  const latitude = parseCoordinate(formData.get("latitude"));
  const longitude = parseCoordinate(formData.get("longitude"));
  const timezone = formData.get("timezone")?.toString().trim() || undefined;
  const countryCode = formData.get("countryCode")?.toString().trim().toLowerCase() || undefined;
  const name = formData.get("name")?.toString().trim() || session.name;
  const age = parseAge(formData.get("age")) ?? session.age;
  const gender = parseGender(formData.get("gender")) ?? session.gender;
  const gardenType = formData.get("gardenType")?.toString().trim() ?? "";
  const reminderWindow = parseReminderWindow(formData, session.reminderWindow);

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
    channels: getChannels(formData),
    onboarded: false,
  });

  await writeSession(nextSession);
  const userId = upsertWorkspaceProfile(nextSession, session.email);
  clearWorkspaceDerivedCareData(userId);

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
  const userId = upsertWorkspaceProfile(nextSession, session.email);
  clearWorkspaceDerivedCareData(userId);

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
  const userId = upsertWorkspaceProfile(nextSession, session.email);
  clearWorkspaceDerivedCareData(userId);

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
  const latitude = parseCoordinate(formData.get("latitude")) ?? session.latitude;
  const longitude = parseCoordinate(formData.get("longitude")) ?? session.longitude;
  const gardenType =
    formData.get("gardenType")?.toString().trim() ?? session.gardenType;
  const reminderWindow = parseReminderWindow(formData, session.reminderWindow);

  const emailDailyReminder = formData.get("emailDailyReminder") === "1";
  const emailWeeklyDigest = formData.get("emailWeeklyDigest") === "1";
  const whatsappNumber = formData.get("whatsappNumber")?.toString().trim() || undefined;
  const timezone = formData.get("timezone")?.toString().trim() || session.timezone;
  const countryCode = formData.get("countryCode")?.toString().trim().toLowerCase() || session.countryCode;

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
    channels: getChannels(formData),
    emailDailyReminder,
    emailWeeklyDigest,
    whatsappNumber,
    timezone,
    countryCode,
    onboarded: true,
  });

  await writeSession(nextSession);
  upsertWorkspaceProfile(nextSession, session.email);

  redirect("/settings?saved=1");
}

export async function signOutAction() {
  await clearSession();
  redirect("/");
}
