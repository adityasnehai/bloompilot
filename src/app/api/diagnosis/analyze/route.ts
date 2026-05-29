import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import {
  createDiagnosisRun,
  parseDiagnosisSymptoms,
} from "@/lib/diagnosis";

export async function GET() {
  const { response } = await requireApiSession();

  if (response) {
    return response;
  }

  return NextResponse.json({
    method: "POST",
    accepts: "multipart/form-data",
    fields: ["plantId", "photo", "symptoms[]", "observation"],
  });
}

export async function POST(request: Request) {
  const { response } = await requireApiSession();

  if (response) {
    return response;
  }

  const formData = await request.formData();
  const plantId = formData.get("plantId")?.toString() ?? "";
  const observation = formData.get("observation")?.toString().trim() ?? "";
  const photo = formData.get("photo");

  if (!plantId || !(photo instanceof File) || photo.size === 0) {
    return NextResponse.json(
      { error: "Plant id and photo are required" },
      { status: 400 },
    );
  }

  const additionalPhotos: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("photo") && key !== "photo" && value instanceof File && value.size > 0) {
      additionalPhotos.push(value);
    }
  }

  const run = await createDiagnosisRun({
    plantId,
    observation,
    photo,
    additionalPhotos: additionalPhotos.slice(0, 2),
    symptoms: parseDiagnosisSymptoms(formData),
  });

  if (!run) {
    return NextResponse.json(
      { error: "Unable to create diagnosis run" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    run,
  });
}
