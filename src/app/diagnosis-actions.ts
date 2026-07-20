"use server";

import { redirect } from "next/navigation";
import { createDiagnosisRun } from "@/lib/diagnosis";
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
    redirect(`${returnTo}?diagnosisError=missing_input`);
  }

  if (!photo.type.startsWith("image/")) {
    redirect(`${returnTo}?diagnosisError=invalid_file`);
  }

  if (photo.size > 4 * 1024 * 1024) {
    redirect(`${returnTo}?diagnosisError=file_too_large`);
  }

  let run;
  try {
    run = await createDiagnosisRun({ plantId, observation, photo });
  } catch {
    redirect(`${returnTo}?diagnosisError=service_unavailable`);
  }

  if (!run) {
    redirect(`${returnTo}?diagnosisError=unable_to_create`);
  }

  redirect(`${returnTo}?diagnosis=complete`);
}
