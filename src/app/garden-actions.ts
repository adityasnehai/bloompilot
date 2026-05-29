"use server";

import { redirect } from "next/navigation";
import {
  generatePlantProfileSuggestion,
  suggestSpeciesFromPlantName,
} from "@/lib/plant-intelligence";
import { identifyPlantPhoto } from "@/lib/plantnet";
import { readSession } from "@/lib/session";
import {
  addPlantMutation,
  coercePlantInput,
  removePlantMutation,
  toggleTaskMutation,
} from "@/lib/workspace-mutations";

async function requireActiveSession(options?: { allowIncompleteOnboarding?: boolean }) {
  const session = await readSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (!session.onboarded && !options?.allowIncompleteOnboarding) {
    redirect("/plant-setup");
  }

  return session;
}

export async function addPlantAction(formData: FormData) {
  const returnTo = formData.get("returnTo")?.toString() ?? "/garden";
  const session = await requireActiveSession({
    allowIncompleteOnboarding: returnTo === "/plant-setup",
  });
  const nickname = formData.get("nickname")?.toString().trim() ?? "";
  const rawSpecies = formData.get("species")?.toString().trim() ?? "";

  const species =
    rawSpecies ||
    (await suggestSpeciesFromPlantName({
      plantName: nickname,
      location: session.location,
      gardenType: session.gardenType,
    }));

  const input = coercePlantInput({
    nickname,
    species,
    placement: formData.get("placement")?.toString() ?? "",
    sunlight: formData.get("sunlight")?.toString() ?? "",
    wateringIntervalDays: formData.get("wateringIntervalDays")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
  });

  if (!input) {
    redirect(returnTo);
  }

  await addPlantMutation(input);
  redirect(returnTo);
}

export async function detectPlantAction(formData: FormData) {
  const returnTo = formData.get("returnTo")?.toString() ?? "/garden";
  const session = await requireActiveSession({
    allowIncompleteOnboarding: returnTo === "/plant-setup",
  });
  const photo = formData.get("photo");
  const nickname = formData.get("nickname")?.toString().trim() ?? "";
  const placementOverride = formData.get("placement")?.toString() ?? "";
  const wateringOverride = formData.get("wateringIntervalDays")?.toString() ?? "";

  if (!(photo instanceof File) || photo.size === 0) {
    redirect(returnTo);
  }

  const detection = await identifyPlantPhoto(photo);
  if (!detection.scientificName) {
    redirect(returnTo);
  }

  const suggestion = await generatePlantProfileSuggestion({
    species: detection.scientificName,
    commonName: detection.commonName,
    gardenType: session.gardenType,
    location: session.location,
  });

  const input = coercePlantInput({
    nickname: nickname || detection.commonName || suggestion.nickname,
    species: detection.scientificName,
    placement: placementOverride || suggestion.placement,
    sunlight: suggestion.sunlight,
    wateringIntervalDays: wateringOverride || suggestion.wateringIntervalDays,
    notes: `${suggestion.notes} Photo ID confidence ${detection.confidence}%.`,
  });

  if (!input) {
    redirect(returnTo);
  }

  await addPlantMutation(input);
  redirect(returnTo);
}

export async function removePlantAction(formData: FormData) {
  const plantId = formData.get("plantId")?.toString() ?? "";
  const returnTo = formData.get("returnTo")?.toString() ?? "/garden";
  await requireActiveSession({
    allowIncompleteOnboarding: returnTo === "/plant-setup",
  });

  if (!plantId) {
    redirect(returnTo);
  }

  await removePlantMutation(plantId);
  redirect(returnTo);
}

export async function toggleTaskAction(formData: FormData) {
  await requireActiveSession();
  const taskId = formData.get("taskId")?.toString() ?? "";
  const returnTo = formData.get("returnTo")?.toString() ?? "/tasks";

  if (!taskId) {
    redirect(returnTo);
  }

  await toggleTaskMutation(taskId);
  redirect(returnTo);
}
