import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { createDiagnosisRun } from "@/lib/diagnosis";
import { withApiHandler, rateLimitedResponse } from "@/lib/api-handler";
import { checkRateLimit } from "@/lib/rate-limit";

export const GET = withApiHandler(async () => {
  const { response } = await requireApiSession();

  if (response) {
    return response;
  }

  return NextResponse.json({
    method: "POST",
    accepts: "multipart/form-data",
    fields: ["plantId", "photo", "observation"],
  });
});

export const POST = withApiHandler(async (request: Request) => {
  const { session, response } = await requireApiSession();

  if (response) {
    return response;
  }
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Each call is a metered Kindwise disease-diagnosis API call plus a real photo upload.
  const limit = await checkRateLimit("diagnosis_analyze", session.email, 10, 300);
  if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);

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
});
