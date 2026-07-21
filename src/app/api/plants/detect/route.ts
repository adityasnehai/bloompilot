import { NextResponse } from "next/server";
import { identifyPlantPhotoCandidates } from "@/lib/plantnet";
import { withApiHandler, clientIp, rateLimitedResponse } from "@/lib/api-handler";
import { checkRateLimit } from "@/lib/rate-limit";

// Public endpoint — only calls the external PlantNet vision API, no user data.
// Open so the public Garden Studio photo-identify works without login. Being
// unauthenticated makes this the single highest bill-risk route in the app, so
// it's rate limited by IP even though there's no account to key on.
export const POST = withApiHandler(async (request: Request) => {
  const limit = await checkRateLimit("plants_detect", clientIp(request), 10, 300);
  if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form" }, { status: 400 });
  }
  const photo = formData.get("photo");

  if (!(photo instanceof File) || photo.size === 0 || !photo.type.startsWith("image/")) {
    return NextResponse.json({ error: "Missing photo" }, { status: 400 });
  }
  if (photo.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "Photo must be 4 MB or smaller" }, { status: 413 });
  }

  try {
    const candidates = await identifyPlantPhotoCandidates(photo);
    return NextResponse.json({ candidates });
  } catch {
    return NextResponse.json({ error: "Plant identification service unavailable" }, { status: 502 });
  }
});
