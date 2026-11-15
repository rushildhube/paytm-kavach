import type { ProofLevel } from "@backend/proofStrength";

/**
 * Proof-strength label (docs/proof-improvements.md, item 4). It describes the
 * merchant's own records; it never says a payment is safe from a hold. Shown on
 * every payment so it never hints at a report.
 */
export const PROOF_LABEL: Record<ProofLevel, { hi: string; en: string; cls: string; dots: number }> = {
  strong: { hi: "मज़बूत सबूत", en: "Strong proof", cls: "border-emerald-300 bg-emerald-50 text-emerald-800", dots: 3 },
  good: { hi: "अच्छा सबूत", en: "Good proof", cls: "border-sky-300 bg-sky-50 text-sky-800", dots: 2 },
  basic: { hi: "कम सबूत", en: "Basic proof", cls: "border-amber-300 bg-amber-50 text-amber-800", dots: 1 },
  none: { hi: "कोई सबूत नहीं", en: "No proof", cls: "border-slate-200 bg-slate-100 text-slate-600", dots: 0 },
};

export function ProofChip({ level, english = false }: { level: ProofLevel; english?: boolean }) {
  const l = PROOF_LABEL[level];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${l.cls}`}
      title={l.en}
    >
      <span className="flex gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < l.dots ? "bg-current" : "bg-current opacity-20"}`} />
        ))}
      </span>
      {english ? l.en : `${l.hi} · ${l.en}`}
    </span>
  );
}
