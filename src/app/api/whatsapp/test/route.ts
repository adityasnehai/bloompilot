import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireApiSession();
    if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as { to?: string };
    const to = body.to?.trim();
    if (!to) return NextResponse.json({ error: "to number required" }, { status: 400 });

    const { sendWhatsApp } = await import("@/lib/whatsapp");

    const result = await sendWhatsApp(
      to,
      `🌿 *BloomPilot test*\nHello from BloomPilot! Your WhatsApp reminders are working perfectly.`,
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[whatsapp/test]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
