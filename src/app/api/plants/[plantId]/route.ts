import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api-session";
import {
  coercePlantInput,
  removePlantMutation,
  updatePlantMutation,
} from "@/lib/workspace-mutations";
import { withApiHandler, parseJsonBody } from "@/lib/api-handler";

const plantInputSchema = z.record(z.string(), z.unknown());

export const DELETE = withApiHandler(async (
  _request: Request,
  context: { params: Promise<{ plantId: string }> },
) => {
  const { response } = await requireApiSession({ requireOnboarded: false });

  if (response) {
    return response;
  }

  const { plantId } = await context.params;

  if (!plantId) {
    return NextResponse.json({ error: "Missing plant id" }, { status: 400 });
  }

  const result = await removePlantMutation(plantId);

  if (!result.plant) {
    return NextResponse.json({ error: "Plant not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    garden: result.garden,
  });
});

export const PUT = withApiHandler(async (
  request: Request,
  context: { params: Promise<{ plantId: string }> },
) => {
  const { response } = await requireApiSession({ requireOnboarded: false });

  if (response) {
    return response;
  }

  const { plantId } = await context.params;

  if (!plantId) {
    return NextResponse.json({ error: "Missing plant id" }, { status: 400 });
  }

  const parsed = await parseJsonBody(request, plantInputSchema);
  if (!parsed.ok) return parsed.response;
  const input = coercePlantInput(parsed.data);

  if (!input) {
    return NextResponse.json({ error: "Invalid plant payload" }, { status: 400 });
  }

  const result = await updatePlantMutation(plantId, input);

  if (!result.plant) {
    return NextResponse.json({ error: "Plant not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    garden: result.garden,
    plant: result.plant,
  });
});
