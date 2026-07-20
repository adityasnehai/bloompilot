import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { enrichSpecies, enrichSpeciesBatch } from "@/lib/plant-enrichment";
import { getStaleKnowledgeKeys, getAllKnowledgeSpeciesKeys, getKnowledgeFromDB } from "@/lib/plant-knowledge-db";

export const runtime = "nodejs";

// GET /api/knowledge?species=Monstera — get stored knowledge for a species
// GET /api/knowledge?list=1 — list all known species keys
// Public (read-only): returns cached, species-level knowledge with no user data,
// so the public Garden Studio companion hints work without login.
export async function GET(request: NextRequest) {
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
}

// POST /api/knowledge/enrich — { species: string } enrich a single species
// POST /api/knowledge/refresh — refresh all stale records (up to 50)
export async function POST(request: NextRequest) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const body = (await request.json().catch(() => ({}))) as { species?: string };
  const species = body.species?.trim();
  if (!species) {
    return NextResponse.json({ error: "species required in body" }, { status: 400 });
  }

  const result = await enrichSpecies(species);
  if (!result) {
    return NextResponse.json({ enriched: false, species, message: "No data found from APIs" });
  }

  return NextResponse.json({ enriched: true, species, confidence: result.confidence, sources: result.sources });
}
