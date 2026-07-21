import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api-session";
import { deactivatePushSubscription } from "@/lib/reminders";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { withApiHandler, parseJsonBody } from "@/lib/api-handler";

const unsubscribeSchema = z.object({
  endpoint: z.string().trim().min(1).optional(),
});

export const POST = withApiHandler(async (request: Request) => {
  const { session, response } = await requireApiSession();
  if (response) return response;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identity = await readWorkspaceIdentityByEmail(session.email);
  if (!identity) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const parsed = await parseJsonBody(request, unsubscribeSchema);
  if (!parsed.ok) return parsed.response;
  const endpoint = parsed.data.endpoint?.trim();
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }

  const ok = await deactivatePushSubscription({
    userId: identity.id,
    endpoint,
  });
  return NextResponse.json({ ok });
});
