import { handle } from "@backend/api";
import { clientKey, RateLimited, takeToken } from "@backend/ratelimit";

/** Actions that may call the drafting model on the server's Sarvam key. */
const DRAFTING = new Set(["explain", "packet", "escalation"]);

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const action = (body as { action?: unknown } | null)?.action;
    if (typeof action === "string" && DRAFTING.has(action)) {
      takeToken("draft", clientKey(request));
    }
    return Response.json(await handle(body));
  } catch (err) {
    const status = err instanceof RateLimited ? 429 : 400;
    const message = err instanceof Error ? err.message : "request failed";
    return Response.json({ error: message }, { status });
  }
}
