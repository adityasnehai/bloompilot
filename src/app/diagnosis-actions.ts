"use server";

import { redirect } from "next/navigation";
import { createDiagnosisRun, parseDiagnosisSymptoms } from "@/lib/diagnosis";
import { readSession } from "@/lib/session";

export async function createDiagnosisAction(formData: FormData) {
  const session = await readSession();
  const returnTo = formData.get("returnTo")?.toString() ?? "/diagnosis";

  if (!session) {
    redirect("/sign-in");
  }

  if (!session.onboarded) {
    redirect("/onboarding");
  }

  const plantId = formData.get("plantId")?.toString() ?? "";
  const observation = formData.get("observation")?.toString().trim() ?? "";
  const photo = formData.get("photo");

  if (!plantId || !(photo instanceof File) || photo.size === 0) {
    redirect(returnTo);
  }

  const additionalPhotos: File[] = [];
  for (const key of ["photo2", "photo3"]) {
    const extra = formData.get(key);
    if (extra instanceof File && extra.size > 0) additionalPhotos.push(extra);
  }

  await createDiagnosisRun({
    plantId,
    observation,
    photo,
    additionalPhotos,
    symptoms: parseDiagnosisSymptoms(formData),
  });

  redirect(returnTo);
}
