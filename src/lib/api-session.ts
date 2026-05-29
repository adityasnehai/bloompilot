import { NextResponse } from "next/server";
import { readSession, type DemoSession } from "@/lib/session";

type ApiSessionResult = {
  session: DemoSession | null;
  response: NextResponse | null;
};

export async function requireApiSession(options?: {
  requireOnboarded?: boolean;
}): Promise<ApiSessionResult> {
  const session = await readSession();

  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (options?.requireOnboarded !== false && !session.onboarded) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Onboarding required" },
        { status: 403 },
      ),
    };
  }

  return {
    session,
    response: null,
  };
}
