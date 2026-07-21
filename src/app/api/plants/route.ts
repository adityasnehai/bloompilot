import { NextResponse } from "next/server";
import { z } from "zod";
import { readGardenState } from "@/lib/garden";
import { requireApiSession } from "@/lib/api-session";
import type { PlantsResponse } from "@/lib/workspace-contracts";
import {
  addPlantMutation,
  coercePlantInput,
} from "@/lib/workspace-mutations";
import { withApiHandler, parseJsonBody } from "@/lib/api-handler";

const plantInputSchema = z.record(z.string(), z.unknown());

export const GET = withApiHandler(async () => {
  const { response } = await requireApiSession({ requireOnboarded: false });

  if (response) {
    return response;
  }

  const garden = await readGardenState();

  return NextResponse.json({
    plants: garden.plants,
    garden,
  } satisfies PlantsResponse);
});

export const POST = withApiHandler(async (request: Request) => {
  const { response } = await requireApiSession({ requireOnboarded: false });

  if (response) {
    return response;
  }

  const parsed = await parseJsonBody(request, plantInputSchema);
  if (!parsed.ok) return parsed.response;
  const input = coercePlantInput(parsed.data);

  if (!input) {
    return NextResponse.json({ error: "Invalid plant payload" }, { status: 400 });
  }

  const result = await addPlantMutation(input);

  return NextResponse.json({
    ok: true,
    garden: result.garden,
    plant: result.plant,
  });
});
