import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { createDiagnosisRun } from "@/lib/diagnosis";

export async function GET() {
  const { response } = await requireApiSession();

  if (response) {
    return response;
  }

  return NextResponse.json({
    method: "POST",
    accepts: "multipart/form-data",
    fields: ["plantId", "photo", "observation"],
  });
}

export async function POST(request: Request) {
  const { response } = await requireApiSession();

  if (response) {
    return response;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form" }, { status: 400 });
  }
  const plantId = formData.get("plantId")?.toString() ?? "";
  const observation = formData.get("observation")?.toString().trim() ?? "";
  const photo = formData.get("photo");

  if (!plantId || !(photo instanceof File) || photo.size === 0) {
    return NextResponse.json(
      { error: "Plant id and photo are required" },
      { status: 400 },
    );
  }

  let run;
  try {
    run = await createDiagnosisRun({
      plantId,
      observation,
      photo,
    });
  } catch {
    return NextResponse.json({ error: "Diagnosis service unavailable" }, { status: 503 });
  }

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
