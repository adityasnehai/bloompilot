import { updateProfileAction } from "@/app/actions";
import { GardenTypeSelector } from "@/components/forms/garden-type-selector";
import { ReminderPreferencesField } from "@/components/forms/reminder-preferences-field";
import { LocationPicker } from "@/components/location/location-picker";
import { SelectField } from "@/components/forms/select-field";
import { TextField } from "@/components/forms/text-field";
import { PushSubscriptionCard } from "@/components/settings/push-subscription-card";
import { TelegramConnectionCard } from "@/components/settings/telegram-connection-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GARDEN_TYPE_CHOICES } from "@/lib/garden-type";
import { requireSession } from "@/lib/session";
import { createTelegramConnectLink, readTelegramChatId } from "@/lib/telegram";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { redirect } from "next/navigation";

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
  const identity = await readWorkspaceIdentityByEmail(session.email);
  const telegramConnectUrl = identity ? createTelegramConnectLink(identity.id) : null;
  const telegramChatId = identity ? await readTelegramChatId(identity.id) : null;
  const resolvedSearchParams = await searchParams;
  const saved = resolvedSearchParams?.saved === "1";

  if (!session.onboarded) {
    redirect("/onboarding");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card as="section" className="px-5 py-6 sm:px-6">
        <div className="space-y-3">
          <p className="eyebrow">Settings</p>
          <h2 className="text-2xl font-semibold leading-tight text-[var(--color-ink)] lg:text-3xl">
            Keep your setup current.
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
            Update account details, garden context, and reminder timing used across BloomPilot.
          </p>
          {saved ? (
            <p className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-[var(--color-ink)]">
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
              options={GARDEN_TYPE_CHOICES}
            />
          </div>

          <ReminderPreferencesField
            defaultSuggested={session.reminderWindow}
            defaultCustom={getCustomReminder(session.reminderWindow)}
            defaultChannels={session.channels}
            accountEmail={session.email}
          />

          <div>
            <p className="eyebrow mb-3">Email notifications</p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl border border-[var(--color-line)] bg-white/5 px-4 py-3 cursor-pointer transition-colors hover:border-white/20 hover:bg-white/8">
                <input
                  type="checkbox"
                  name="emailDailyReminder"
                  value="1"
                  defaultChecked={session.emailDailyReminder !== false}
                  className="h-4 w-4 rounded accent-white"
                />
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">Daily task reminders</p>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">Email when you have tasks due today.</p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-[var(--color-line)] bg-white/5 px-4 py-3 cursor-pointer transition-colors hover:border-white/20 hover:bg-white/8">
                <input
                  type="checkbox"
                  name="emailWeeklyDigest"
                  value="1"
                  defaultChecked={session.emailWeeklyDigest !== false}
                  className="h-4 w-4 rounded accent-white"
                />
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">Weekly digest</p>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">Sunday summary of garden health and upcoming tasks.</p>
                </div>
              </label>
            </div>
          </div>

          <Button
            type="submit"
            className="mt-2 sm:w-fit"
          >
            Save changes
          </Button>
        </form>
      </Card>

      <Card as="aside" className="px-5 py-6">
        <p className="text-sm text-[var(--color-muted)]">Account snapshot</p>
        <div className="mt-4 space-y-4 text-sm">
          <Card className="px-4 py-4">
            <p className="eyebrow">Profile</p>
            <p className="mt-2 leading-6 text-[var(--color-ink)]">
              Name, email, location, and garden context stay available across the product.
            </p>
          </Card>
          <Card className="px-4 py-4">
            <p className="eyebrow">Care preferences</p>
            <p className="mt-2 leading-6 text-[var(--color-ink)]">
              Reminder windows and delivery channels shape when BloomPilot surfaces plant care.
            </p>
          </Card>
          <PushSubscriptionCard />
          <TelegramConnectionCard
            connectUrl={telegramConnectUrl}
            connected={Boolean(telegramChatId)}
          />
        </div>
      </Card>
    </div>
  );
}
