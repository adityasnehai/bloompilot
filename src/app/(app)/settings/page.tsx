import { updateProfileAction } from "@/app/actions";
import { CheckboxChip } from "@/components/forms/checkbox-chip";
import { GardenTypeSelector } from "@/components/forms/garden-type-selector";
import { ReminderWindowField } from "@/components/forms/reminder-window-field";
import { LocationPicker } from "@/components/location/location-picker";
import { SelectField } from "@/components/forms/select-field";
import { TextField } from "@/components/forms/text-field";
import { PushSubscriptionCard } from "@/components/settings/push-subscription-card";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";

const gardenTypes = [
  {
    label: "Indoor",
    value: "Indoor",
    description: "Plants inside the home near windows and shelves.",
    imagePath: "/garden-types/indoor-collection.svg",
    info: "No outdoor weather affects your plants. Focus on light and humidity.",
  },
  {
    label: "Balcony",
    value: "Balcony",
    description: "Small outdoor setup with rail planters and compact pots.",
    imagePath: "/garden-types/balcony-garden.svg",
    info: "Partial weather exposure. Wind and frost can affect plants.",
  },
  {
    label: "Backyard",
    value: "Backyard",
    description: "Larger outdoor space with beds or open ground.",
    imagePath: "/garden-types/backyard-garden.svg",
    info: "Full weather exposure. Ground beds hold moisture longer than pots.",
  },
  {
    label: "Terrace",
    value: "Terrace",
    description: "Open rooftop or terrace with strong sun and wind.",
    imagePath: "/garden-types/terrace-rooftop-garden.svg",
    info: "Maximum exposure. Wind and UV are strongest here — pots dry very fast.",
  },
  {
    label: "Container Garden",
    value: "Container Garden",
    description: "Movable pots and containers on a patio or hard surface.",
    imagePath: "/garden-types/patio-container-garden.svg",
    info: "Outdoor pots that can be moved. Rain and frost still relevant.",
  },
];

function getCustomReminder(defaultValue: string) {
  return [
    "07:00 AM - 09:00 AM",
    "12:00 PM - 02:00 PM",
    "06:00 PM - 08:00 PM",
  ].includes(defaultValue)
    ? ""
    : defaultValue;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const session = await requireSession();
  const resolvedSearchParams = await searchParams;
  const saved = resolvedSearchParams?.saved === "1";

  if (!session.onboarded) {
    redirect("/onboarding");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="surface-panel px-5 py-6 sm:px-6">
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-muted)]">Settings</p>
          <h2 className="text-3xl font-semibold leading-tight text-[var(--color-ink)]">
            Keep your setup current.
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
            Update the account details, garden setup, and reminder timing BloomPilot uses across the product.
          </p>
          {saved ? (
            <p className="inline-flex rounded-full border border-[rgba(76,121,97,0.24)] bg-[rgba(76,121,97,0.08)] px-3 py-1 text-sm text-[var(--color-moss)]">
              Settings saved.
            </p>
          ) : null}
        </div>

        <form action={updateProfileAction} className="mt-8 grid gap-5">
          <div className="grid gap-5 lg:grid-cols-3">
            <TextField
              label="Full name"
              name="name"
              defaultValue={session.name}
              required
            />
            <TextField
              label="Age"
              name="age"
              type="number"
              min="1"
              max="120"
              defaultValue={session.age?.toString()}
              hint="Optional"
            />
            <SelectField
              label="Gender"
              name="gender"
              defaultValue={session.gender ?? "Prefer not to say"}
              options={[
                { label: "Woman", value: "Woman" },
                { label: "Man", value: "Man" },
                { label: "Non-binary", value: "Non-binary" },
                { label: "Prefer not to say", value: "Prefer not to say" },
              ]}
            />
          </div>

          <div className="grid gap-5">
            <TextField
              label="Email"
              name="email"
              type="email"
              defaultValue={session.email}
              required
            />
          </div>

          <div className="grid gap-5">
            <LocationPicker
              defaultLocation={session.location}
              defaultLatitude={session.latitude}
              defaultLongitude={session.longitude}
              required
            />
            <GardenTypeSelector
              name="gardenType"
              defaultValue={session.gardenType}
              options={gardenTypes}
            />
          </div>

          <ReminderWindowField
            defaultSuggested={session.reminderWindow}
            defaultCustom={getCustomReminder(session.reminderWindow)}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <CheckboxChip
              name="channels"
              value="email"
              label="Email reminders"
              description="Preferred for weekly care summaries and task digests."
              defaultChecked={session.channels.includes("email")}
            />
            <CheckboxChip
              name="channels"
              value="push"
              label="Push notifications"
              description="Ideal for urgent care nudges on mobile."
              defaultChecked={session.channels.includes("push")}
            />
            <CheckboxChip
              name="channels"
              value="whatsapp"
              label="WhatsApp reminders"
              description="Daily care digest via Twilio WhatsApp. Requires phone number below."
              defaultChecked={session.channels.includes("whatsapp")}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-[var(--color-ink)] mb-3">WhatsApp number</p>
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-4 py-3">
              <label className="block text-xs text-[var(--color-muted)] mb-1.5">
                Phone number with country code (e.g. +919876543210)
              </label>
              <input
                type="tel"
                name="whatsappNumber"
                defaultValue={session.whatsappNumber ?? ""}
                placeholder="+91XXXXXXXXXX"
                className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-moss)] focus:outline-none"
              />
              <p className="mt-1.5 text-[11px] text-[var(--color-muted)]">
                Must first send &ldquo;join&rdquo; code to the sandbox number. Leave blank to disable.
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-[var(--color-ink)] mb-3">Email notifications</p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-4 py-3 cursor-pointer hover:border-[var(--color-canopy)]/40 transition-colors">
                <input
                  type="checkbox"
                  name="emailDailyReminder"
                  value="1"
                  defaultChecked={session.emailDailyReminder !== false}
                  className="h-4 w-4 rounded accent-[var(--color-canopy)]"
                />
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">Daily task reminders</p>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">Email when you have tasks due today.</p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-4 py-3 cursor-pointer hover:border-[var(--color-canopy)]/40 transition-colors">
                <input
                  type="checkbox"
                  name="emailWeeklyDigest"
                  value="1"
                  defaultChecked={session.emailWeeklyDigest !== false}
                  className="h-4 w-4 rounded accent-[var(--color-canopy)]"
                />
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">Weekly digest</p>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">Sunday summary of garden health and upcoming tasks.</p>
                </div>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="button-primary mt-2 sm:w-fit"
          >
            Save changes
          </button>
        </form>
      </section>

      <aside className="surface-panel px-5 py-6">
        <p className="text-sm text-[var(--color-muted)]">Account snapshot</p>
        <div className="mt-4 space-y-4 text-sm">
          <div className="surface-card px-4 py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Profile
            </p>
            <p className="mt-2 leading-6 text-[var(--color-ink)]">
              Your name, email, location, and garden type stay available across
              the product so setup does not need to be repeated.
            </p>
          </div>
          <div className="surface-card px-4 py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Care preferences
            </p>
            <p className="mt-2 leading-6 text-[var(--color-ink)]">
              Reminder windows and delivery channels shape when BloomPilot
              surfaces plant care throughout the week.
            </p>
          </div>
          <PushSubscriptionCard />
        </div>
      </aside>
    </div>
  );
}
