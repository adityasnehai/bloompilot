import { NextResponse } from "next/server";
import { searchLocations } from "@/lib/location";
import { requireApiSession } from "@/lib/api-session";

export async function GET(request: Request) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  try {
    const results = await searchLocations(query);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to search locations" },
      { status: 500 },
    );
  }
}
