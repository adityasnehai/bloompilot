import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";

// Proxies iNaturalist / external plant images so Three.js can load them
// from the same origin — no CORS issues when creating WebGL textures.
export const GET = withApiHandler(async (request: Request) => {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 });

  // Only allow known image hosts
  const allowed = [
    "inaturalist-open-data.s3.amazonaws.com",
    "static.inaturalist.org",
    "inaturalist-open-data.s3.us-east-1.amazonaws.com",
  ];
  let host: string;
  let parsedUrl: URL;
  try { parsedUrl = new URL(url); host = parsedUrl.hostname; } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "https required" }, { status: 400 });
  }
  if (!allowed.some((h) => host === h || host.endsWith(`.${h}`))) {
    return NextResponse.json({ error: "host not allowed" }, { status: 403 });
  }

  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": "BloomPilot/1.0" }, signal: AbortSignal.timeout(10000) });
  } catch {
    return NextResponse.json({ error: "Image provider unavailable" }, { status: 502 });
  }
  if (!res.ok) return new NextResponse(null, { status: res.status });

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return NextResponse.json({ error: "Provider returned a non-image response" }, { status: 502 });
  }
  const contentLength = Number(res.headers.get("content-length") ?? "0");
  if (contentLength > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Image is too large" }, { status: 413 });
  }

  const blob = await res.arrayBuffer();
  const ct = contentType;
  if (blob.byteLength > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Image is too large" }, { status: 413 });
  }

  return new NextResponse(blob, {
    headers: {
      "Content-Type": ct,
      "Cache-Control": "public, max-age=86400, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
