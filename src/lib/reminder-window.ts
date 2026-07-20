type ReminderWindowProfile = {
  timezone: string | null;
  reminderWindow: string;
};

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

function zonedMinutesOfDay(date: Date, timezone: string | null) {
  const { hour, minute } = getZonedParts(date, timezone);
  return hour * 60 + minute;
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

export function parseWindow(reminderWindow: string) {
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

export function isReminderWindowActive(
  profile: ReminderWindowProfile,
  date = new Date(),
) {
  const { fromMin, toMin } = parseWindow(profile.reminderWindow);
  const current = zonedMinutesOfDay(date, profile.timezone);
  if (fromMin <= toMin) {
    return current >= fromMin && current <= toMin;
  }
  return current >= fromMin || current <= toMin;
}
