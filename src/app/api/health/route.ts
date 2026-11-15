/**
 * `GET /api/health`: the commit this server was built from, so CI can wait
 * until Render serves a new deploy before running the live smoke test.
 * Render sets RENDER_GIT_COMMIT; locally it is null. No state, no secrets.
 */
export function GET() {
  return Response.json({ ok: true, commit: process.env.RENDER_GIT_COMMIT ?? null });
}
