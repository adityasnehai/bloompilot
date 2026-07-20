"use client";

import { useState } from "react";
import { completePreferencesAction, skipOnboardingAction } from "@/app/actions";
import { GardenTypeSelector } from "@/components/forms/garden-type-selector";
import { ReminderPreferencesField } from "@/components/forms/reminder-preferences-field";
import { LocationPicker } from "@/components/location/location-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GARDEN_TYPE_CHOICES } from "@/lib/garden-type";
import type { DemoSession } from "@/lib/session";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

function getCustomReminder(defaultValue: string) {
  return [
    "07:00 AM - 09:00 AM",
    "12:00 PM - 02:00 PM",
    "06:00 PM - 08:00 PM",
  ].includes(defaultValue)
    ? ""
    : defaultValue;
}

const steps = [
  { label: "Location", title: "Where is your garden?" },
  { label: "Garden context", title: "What kind of space do you have?" },
  { label: "Reminders", title: "When should BloomPilot reach you?" },
] as const;

export function PreferencesWizard({ session }: { session: DemoSession }) {
  const [step, setStep] = useState(0);
  const currentStep = steps[step];

  return (
    <div className="auth-onboarding min-h-screen px-4 py-6 sm:py-10 lg:px-6">
      <Card as="section" className="auth-onboarding-shell mx-auto w-full max-w-[720px] px-5 py-5 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between gap-4">
            {step > 0 ? (
              <button
                type="button"
                aria-label="Go to previous step"
                onClick={() => setStep((value) => value - 1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <Link
                href="/"
                aria-label="Back to home"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            )}

            <form action={skipOnboardingAction}>
              <Button type="submit" variant="ghost" className="h-9 px-2 text-xs text-white/55 hover:text-white">
                Skip setup
              </Button>
            </form>
          </div>

          <div className="grid gap-5">
            <div className="flex items-center justify-between gap-4">
              <p className="eyebrow">Garden setup</p>
              <span className="text-xs font-medium tracking-[0.14em] text-white/45">STEP {step + 1} OF {steps.length}</span>
            </div>
            <div className="grid grid-cols-3 gap-2" aria-label={`Step ${step + 1} of ${steps.length}`}>
              {steps.map((item, index) => (
                <div key={item.label} className="grid gap-2">
                  <span className={`h-1 rounded-full ${index <= step ? "bg-white" : "bg-white/10"}`} />
                  <span className={`text-[10px] font-medium uppercase tracking-[0.12em] ${index === step ? "text-white" : "text-white/40"}`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="max-w-2xl space-y-2">
              <h1 className="text-[2rem] font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-[2.5rem]">
                {currentStep.title}
              </h1>
            </div>
          </div>

          <form action={completePreferencesAction} className="grid gap-6">
            <input type="hidden" name="name" value={session.name} />
            <input type="hidden" name="age" value={session.age?.toString() ?? ""} />
            <input type="hidden" name="gender" value={session.gender ?? "Prefer not to say"} />

            <div className={step === 0 ? "" : "hidden"}>
              <Card className="auth-onboarding-section grid gap-4 rounded-[22px] p-4 sm:p-6">
                <LocationPicker
                  defaultLocation={session.location}
                  defaultLatitude={session.latitude}
                  defaultLongitude={session.longitude}
                />
              </Card>
            </div>

            <div className={step === 1 ? "" : "hidden"}>
              <Card className="auth-onboarding-section grid gap-4 rounded-[22px] p-4 sm:p-6">
                <GardenTypeSelector
                  name="gardenType"
                  defaultValue={session.gardenType}
                  options={GARDEN_TYPE_CHOICES}
                />
              </Card>
            </div>

            <div className={step === 2 ? "" : "hidden"}>
              <Card className="auth-onboarding-section grid gap-5 rounded-[22px] p-4 sm:p-6">
                <ReminderPreferencesField
                  defaultSuggested={session.reminderWindow}
                  defaultCustom={getCustomReminder(session.reminderWindow)}
                  defaultChannels={session.channels}
                  accountEmail={session.email}
                />
              </Card>
            </div>

            <div className="flex justify-end border-t border-white/10 pt-5">
              {step < steps.length - 1 ? (
                <Button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setStep((value) => value + 1);
                  }}
                  className="w-full px-8 sm:w-auto"
                >
                  Continue
                </Button>
              ) : (
                <Button type="submit" formNoValidate className="w-full px-8 sm:w-auto">
                  Finish setup
                </Button>
              )}
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
