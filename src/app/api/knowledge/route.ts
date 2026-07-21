import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api-session";
import { enrichSpecies, enrichSpeciesBatch } from "@/lib/plant-enrichment";
import { getStaleKnowledgeKeys, getAllKnowledgeSpeciesKeys, getKnowledgeFromDB } from "@/lib/plant-knowledge-db";
import { withApiHandler, parseJsonBody, clientIp, rateLimitedResponse } from "@/lib/api-handler";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const enrichRequestSchema = z.object({
  species: z.string().trim().min(1).max(200),
});

// GET /api/knowledge?species=Monstera — get stored knowledge for a species
// GET /api/knowledge?list=1 — list all known species keys
// Public (read-only): returns cached, species-level knowledge with no user data,
// so the public Garden Studio companion hints work without login.
export const GET = withApiHandler(async (request: NextRequest) => {
  const limit = await checkRateLimit("knowledge_get", clientIp(request), 60, 60);
  if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);

  const { searchParams } = new URL(request.url);

  if (searchParams.get("list") === "1") {
    const keys = await getAllKnowledgeSpeciesKeys();
    return NextResponse.json({ count: keys.length, species: keys });
  }

  const species = searchParams.get("species")?.trim();
  if (!species) {
    return NextResponse.json({ error: "species param required" }, { status: 400 });
  }

  const stored = await getKnowledgeFromDB(species);
  if (!stored) {
    return NextResponse.json({ found: false, species, knowledge: null });
  }

  return NextResponse.json({ found: true, knowledge: stored });
});

// POST /api/knowledge/enrich — { species: string } enrich a single species
// POST /api/knowledge/refresh — refresh all stale records (up to 50)
export const POST = withApiHandler(async (request: NextRequest) => {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Each call fans out to Perenual/Trefle — real, metered external API calls.
  const limit = await checkRateLimit("knowledge_enrich", session.email, 15, 300);
  if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "enrich";

  if (action === "refresh") {
    const stale = await getStaleKnowledgeKeys(50);
    if (stale.length === 0) {
      return NextResponse.json({ refreshed: 0, message: "No stale records" });
    }
    await enrichSpeciesBatch(stale);
    return NextResponse.json({ refreshed: stale.length, species: stale });
  }

  const parsed = await parseJsonBody(request, enrichRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { species } = parsed.data;

  const result = await enrichSpecies(species);
  if (!result) {
    return NextResponse.json({ enriched: false, species, message: "No data found from APIs" });
  }

  return NextResponse.json({ enriched: true, species, confidence: result.confidence, sources: result.sources });
});
