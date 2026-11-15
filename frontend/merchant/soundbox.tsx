import type { Snapshot } from "@backend/api";
import { inr } from "../parts";
import { Card, NAVY } from "./chrome";

/**
 * Soundbox settings: the language the Soundbox announces payments in and
 * listens for sale tags in. Languages come from the snapshot, not from here.
 */
export function SoundboxTab({
  state,
  busy,
  onLanguage,
}: {
  state: Snapshot;
  busy: string | null;
  onLanguage: (code: string) => void;
}) {
  const current = state.settings.language;
  return (
    <div className="space-y-3">
      <Card title="Soundbox voice language · साउंडबॉक्स की भाषा">
        <p className="mb-3 text-xs text-slate-500">
          The Soundbox announces payments and asks “क्या बेचा?” in this language.
        </p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Soundbox voice language">
          {state.voiceLanguages.map((l) => {
            const selected = l.code === current;
            return (
              <button
                key={l.code}
                role="radio"
                aria-checked={selected}
                onClick={() => !selected && onLanguage(l.code)}
                disabled={busy !== null && !selected}
                className="rounded-xl border-2 px-3 py-2.5 text-left disabled:opacity-60"
                style={{
                  borderColor: selected ? "#00BAF2" : "#e2e8f0",
                  background: selected ? "#E5F8FE" : "white",
                }}
              >
                <div className="text-base font-semibold" style={{ color: NAVY }}>
                  {l.native}
                </div>
                <div className="text-xs text-slate-500">
                  {l.name}
                  {selected && " · ✓ selected"}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Kavach on your Soundbox">
        <ul className="space-y-1.5 text-sm text-slate-700">
          <li>
            🛡 Payments of {inr(state.thresholdInr)} and above: the Soundbox asks what was sold.
          </li>
          <li>⏱ You have {state.tagWindowSeconds} seconds to answer. It cannot be added later.</li>
          <li>🔒 Only the last four digits of your account and a masked buyer handle are kept.</li>
        </ul>
      </Card>
    </div>
  );
}
