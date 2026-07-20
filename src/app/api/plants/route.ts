import { NextResponse } from "next/server";
import { readGardenState } from "@/lib/garden";
import { requireApiSession } from "@/lib/api-session";
import type { PlantsResponse } from "@/lib/workspace-contracts";
import {
  addPlantMutation,
  coercePlantInput,
} from "@/lib/workspace-mutations";

export async function GET() {
  const { response } = await requireApiSession({ requireOnboarded: false });

  if (response) {
    return response;
  }

  const garden = await readGardenState();

  return NextResponse.json({
    plants: garden.plants,
    garden,
  } satisfies PlantsResponse);
}

export async function POST(request: Request) {
  const { response } = await requireApiSession({ requireOnboarded: false });

  if (response) {
    return response;
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const input = coercePlantInput(body);

  if (!input) {
    return NextResponse.json({ error: "Invalid plant payload" }, { status: 400 });
  }

  const result = await addPlantMutation(input);

  return NextResponse.json({
    ok: true,
    garden: result.garden,
    plant: result.plant,
  });
}
