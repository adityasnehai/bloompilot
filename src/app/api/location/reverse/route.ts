import { NextResponse } from "next/server";
import { reverseGeocodeLocation } from "@/lib/location";
import { requireApiSession } from "@/lib/api-session";

export async function GET(request: Request) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const latitude = Number.parseFloat(searchParams.get("latitude") ?? "");
  const longitude = Number.parseFloat(searchParams.get("longitude") ?? "");

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "Latitude and longitude are required" }, { status: 400 });
  }

  try {
    const result = await reverseGeocodeLocation(latitude, longitude);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reverse geocode location" },
      { status: 500 },
    );
  }
}
