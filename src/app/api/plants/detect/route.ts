import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { identifyPlantPhotoCandidates } from "@/lib/plantnet";

export async function POST(request: Request) {
  const { response } = await requireApiSession({ requireOnboarded: false });

  if (response) {
    return response;
  }

  const formData = await request.formData();
  const photo = formData.get("photo");

  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "Missing photo" }, { status: 400 });
  }

  const candidates = await identifyPlantPhotoCandidates(photo);
  return NextResponse.json({ candidates });
}
