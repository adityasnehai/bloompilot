import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api-session";
import { upsertPushSubscription } from "@/lib/reminders";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { withApiHandler, parseJsonBody } from "@/lib/api-handler";

const subscribeSchema = z.object({
  endpoint: z.string().trim().min(1).optional(),
  keys: z
    .object({
      p256dh: z.string().trim().min(1).optional(),
      auth: z.string().trim().min(1).optional(),
    })
    .optional(),
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

  const parsed = await parseJsonBody(request, subscribeSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const auth = body.keys?.auth?.trim();

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "endpoint, keys.p256dh, and keys.auth are required" },
      { status: 400 },
    );
  }

  const id = await upsertPushSubscription({
    userId: identity.id,
    endpoint,
    p256dh,
    auth,
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ ok: true, id });
});
