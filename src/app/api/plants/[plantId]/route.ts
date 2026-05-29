import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import {
  coercePlantInput,
  removePlantMutation,
  updatePlantMutation,
} from "@/lib/workspace-mutations";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ plantId: string }> },
) {
  const { response } = await requireApiSession({ requireOnboarded: false });

  if (response) {
    return response;
  }

  const { plantId } = await context.params;

  if (!plantId) {
    return NextResponse.json({ error: "Missing plant id" }, { status: 400 });
  }

  const result = await removePlantMutation(plantId);

  return NextResponse.json({
    ok: true,
    garden: result.garden,
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ plantId: string }> },
) {
  const { response } = await requireApiSession({ requireOnboarded: false });

  if (response) {
    return response;
  }

  const { plantId } = await context.params;

  if (!plantId) {
    return NextResponse.json({ error: "Missing plant id" }, { status: 400 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const input = coercePlantInput(body);

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
}
