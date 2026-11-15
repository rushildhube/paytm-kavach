import { handle } from "@backend/api";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return Response.json(await handle(body));
  } catch (err) {
    const message = err instanceof Error ? err.message : "request failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
