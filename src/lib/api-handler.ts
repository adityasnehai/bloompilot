import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { logger } from "@/lib/logger";

/**
 * Wraps a Next.js route handler so any thrown/rejected error is logged with
 * request context and turned into a consistent JSON 500, instead of bubbling
 * into Next's default (unlogged, generic) error response.
 */
export function withApiHandler<Req extends Request, Args extends unknown[]>(
  handler: (request: Req, ...args: Args) => Promise<Response>,
) {
  return async (request: Req, ...args: Args): Promise<Response> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      const url = new URL(request.url);
      logger.error("api_route_unhandled_error", {
        path: url.pathname,
        method: request.method,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

/**
 * Parses and validates a JSON request body against a zod schema. Returns either
 * the typed, validated data or a ready-to-return 400 Response describing what
 * was wrong — callers just `return` the response on failure.
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Invalid request body",
          details: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: result.data };
}

/** Best-effort caller IP for rate-limiting unauthenticated routes. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Same as clientIp, but for Server Actions, which have no Request object to read. */
export async function clientIpFromHeaders(): Promise<string> {
  const { headers } = await import("next/headers");
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return store.get("x-real-ip")?.trim() || "unknown";
}

/** Standard 429 response for a rate-limited request. */
export function rateLimitedResponse(retryAfterSeconds: number): Response {
  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
