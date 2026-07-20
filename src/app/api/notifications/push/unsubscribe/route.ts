import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { deactivatePushSubscription } from "@/lib/reminders";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";

type UnsubscribeBody = {
  endpoint?: string;
};

export async function POST(request: Request) {
  const { session, response } = await requireApiSession();
  if (response) return response;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null) as UnsubscribeBody | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const endpoint = body.endpoint?.trim();
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }

  const ok = await deactivatePushSubscription({
    userId: identity.id,
    endpoint,
  });
  return NextResponse.json({ ok });
}
