import { NextResponse } from "next/server";
import { readWeatherSnapshot } from "@/lib/weather";
import { requireApiSession } from "@/lib/api-session";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(async (request: Request) => {
  const { session, response } = await requireApiSession({ requireOnboarded: false });
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const latitude = Number.parseFloat(searchParams.get("latitude") ?? "");
  const longitude = Number.parseFloat(searchParams.get("longitude") ?? "");

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "Latitude and longitude are required" }, { status: 400 });
  }

  try {
    const weather = await readWeatherSnapshot(latitude, longitude);
    return NextResponse.json(weather);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to read weather" },
      { status: 500 },
    );
  }
});
