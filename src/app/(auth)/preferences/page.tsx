import { completePreferencesAction, skipOnboardingAction } from "@/app/actions";
import { GardenTypeSelector } from "@/components/forms/garden-type-selector";
import { ReminderPreferencesField } from "@/components/forms/reminder-preferences-field";
import { LocationPicker } from "@/components/location/location-picker";
import { requireSession } from "@/lib/session";
import Link from "next/link";

const gardenTypes = [
  {
    label: "Indoor",
    value: "Indoor",
    description: "Plants inside the home near windows, shelves, or corners.",
    imagePath: "/garden-types/indoor.avif",
    info: "Outdoor weather irrelevant. Care focuses on light quality and room humidity.",
  },
  {
    label: "Balcony",
    value: "Balcony",
    description: "Small outdoor setup with rail planters, pots, and compact plant groups.",
    imagePath: "/garden-types/balcony.jpg",
    info: "Partial exposure. Wind and frost can affect plants.",
  },
  {
    label: "Backyard",
    value: "Backyard",
    description: "Larger outdoor growing space with beds, open ground, or mixed planting zones.",
    imagePath: "/garden-types/backyard.jpg",
    info: "Full exposure. Ground beds hold moisture longer than pots.",
  },
  {
    label: "Terrace",
    value: "Terrace",
    description: "Open rooftop or terrace setup with stronger sun and wind exposure.",
    imagePath: "/garden-types/rooftop.jpg",
    info: "Maximum exposure. Wind dries pots very fast. Consider windbreaks.",
  },
  {
    label: "Container Garden",
    value: "Container Garden",
    description: "Movable pots and containers on a patio or ground-level surface.",
    imagePath: "/garden-types/patio-container-garden.svg",
    info: "Outdoor containers that can be moved. Rain and frost still relevant.",
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

export default async function PreferencesPage() {
  const session = await requireSession();

  return (
    <div className="landing-root px-4 py-8 lg:px-6">
      <section className="mx-auto w-full max-w-[920px] rounded-[28px] border border-[rgba(220,231,218,0.9)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(244,248,241,0.96)_100%)] px-6 py-6 shadow-[0_18px_40px_rgba(48,65,22,0.07)] sm:px-8 sm:py-8">
        <div className="flex flex-col gap-7">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Link
                href="/"
                className="font-accent inline-flex items-center gap-2 text-sm font-medium text-[#62786b] transition hover:text-[#173528]"
              >
                <span className="text-base leading-none">←</span>
                Back to home
              </Link>
              <Link
                href="/"
                className="font-accent block text-[1.15rem] font-semibold leading-none text-[#173528] sm:text-[1.25rem]"
              >
                BloomPilot
              </Link>
            </div>
            <form action={skipOnboardingAction}>
              <button type="submit" className="button-secondary min-h-[2.4rem] px-4">
                Skip
              </button>
            </form>
          </div>

          <div className="max-w-2xl space-y-2">
            <p className="eyebrow">Preferences</p>
            <h1 className="font-accent text-[2rem] font-semibold leading-[1.02] text-[#173528] sm:text-[2.3rem]">
              Set your garden context.
            </h1>
            <p className="landing-copy text-[15px]">
              Add location, garden type, and reminder timing before plant setup.
            </p>
          </div>

          <form action={completePreferencesAction} className="grid gap-5">
            <input type="hidden" name="name" value={session.name} />
            <input type="hidden" name="age" value={session.age?.toString() ?? ""} />
            <input type="hidden" name="gender" value={session.gender ?? "Prefer not to say"} />

            <div className="landing-card grid gap-4 rounded-[24px] p-5">
              <p className="font-accent text-base font-semibold text-[#173528]">Location</p>
              <LocationPicker
                defaultLocation={session.location}
                defaultLatitude={session.latitude}
                defaultLongitude={session.longitude}
              />
            </div>

            <div className="landing-card grid gap-4 rounded-[24px] p-5">
              <p className="font-accent text-base font-semibold text-[#173528]">Garden type</p>
              <GardenTypeSelector
                name="gardenType"
                defaultValue={session.gardenType}
                options={gardenTypes}
              />
            </div>

            <div className="landing-card grid gap-5 rounded-[24px] p-5">
              <p className="font-accent text-base font-semibold text-[#173528]">Reminders</p>
              <ReminderPreferencesField
                defaultSuggested={session.reminderWindow}
                defaultCustom={getCustomReminder(session.reminderWindow)}
                defaultChannels={session.channels}
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button type="submit" className="button-primary min-h-[2.6rem] rounded-full px-7">
                Continue
              </button>
              <button type="submit" formAction={skipOnboardingAction} className="button-secondary min-h-[2.6rem] rounded-full px-7">
                Skip for now
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
