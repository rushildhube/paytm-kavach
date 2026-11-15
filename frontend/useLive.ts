"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Role } from "@backend/api";

type Reply<S, T> = { result: T; state: S };

/**
 * Keeps one screen in sync with the shared demo state by polling the API.
 * Every request names the screen's role, so the server returns only what
 * that screen is allowed to see. `onReset` fires when the demo is reset
 * from any device.
 */
export function useLive<S extends { epoch: number }>(
  role: Role,
  { intervalMs = 1000, onReset }: { intervalMs?: number; onReset?: () => void } = {},
) {
  const [state, setState] = useState<S | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const epoch = useRef<number | null>(null);
  const resetRef = useRef(onReset);
  useEffect(() => {
    resetRef.current = onReset;
  }, [onReset]);

  const accept = useCallback((next: S) => {
    if (epoch.current !== null && next.epoch !== epoch.current) resetRef.current?.();
    epoch.current = next.epoch;
    setState(next);
  }, []);

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch("/api/kavach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      return json;
    },
    [role],
  );

  /** Run an action. Returns null on failure and shows the error. */
  const call = useCallback(
    async <T,>(body: Record<string, unknown>): Promise<Reply<S, T> | null> => {
      setBusy(String(body.action));
      setError(null);
      try {
        const json = (await post(body)) as Reply<S, T>;
        accept(json.state);
        return json;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        return null;
      } finally {
        setBusy(null);
      }
    },
    [post, accept],
  );

  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        const json = await post({ action: "state" });
        if (live) accept(json.state);
      } catch {
        // A missed poll is fine; the next one catches up.
      }
    };
    void tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [post, accept, intervalMs]);

  return { state, error, setError, busy, call };
}
