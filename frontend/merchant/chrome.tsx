import { BRAND } from "../brand";
import { BrandLogo } from "../BrandLogo";
import type { Snapshot } from "@backend/api";
import type { SaleTag } from "@backend/types";
import { inr } from "../parts";
import { DemoPill } from "../ui";

/** Brand palette for inline styles; the values live in ../brand.ts. */
export const PRIMARY = BRAND.primary;
export const NAVY = BRAND.navy;
export const TINT = BRAND.tint;
export const DEEP = BRAND.deep;

export type Tab = "home" | "payments" | "proofs" | "bills" | "soundbox";

type Merchant = Snapshot["merchant"];
type Hold = NonNullable<Snapshot["hold"]>;

/**
 * Top bar in the style of the Paytm for Business app. The "Demo" label stays
 * in every state so the screen is never mistaken for the real app.
 */
export function AppBar({
  merchant,
  simulatedDays,
  hold,
  onHoldTap,
}: {
  merchant: Merchant;
  simulatedDays: number;
  hold: Hold | null;
  onHoldTap: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-2 px-4 pt-3">
        <BrandLogo size={24} />
        <span className="text-[13px] font-semibold" style={{ color: NAVY }}>
          for Business
        </span>
        <span className="ml-auto">
          <DemoPill />
        </span>
      </div>
      <div className="flex items-center gap-3 px-4 pt-2 pb-3">
        <div
          className="grid size-10 shrink-0 place-items-center rounded-full text-base font-bold text-white"
          style={{ background: NAVY }}
          aria-hidden
        >
          {merchant.shopName.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-slate-900">{merchant.shopName}</div>
          <div className="text-xs text-slate-500">
            {merchant.city} · {merchant.bankName} •••• {merchant.accountLast4}
            {simulatedDays > 0 && (
              <span className="ml-1 font-medium text-slate-700">· simulated day {simulatedDays}</span>
            )}
          </div>
        </div>
      </div>
      {hold && (
        <button
          onClick={onHoldTap}
          className="flex w-full items-center gap-2 bg-red-600 px-4 py-2 text-left text-sm font-semibold text-white"
        >
          <span aria-hidden>⚠</span>
          <span className="flex-1">
            {hold.scope === "debit_freeze"
              ? `खाते से निकासी पर रोक · शिकायत ${inr(hold.heldAmountInr)} की`
              : `${inr(hold.heldAmountInr)} पर रोक · सिर्फ़ एक पेमेंट`}
          </span>
          <span className="text-xs font-medium opacity-90">देखिए ›</span>
        </button>
      )}
    </header>
  );
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "होम", icon: "⌂" },
  { id: "payments", label: "पेमेंट", icon: "₹" },
  { id: "proofs", label: "सबूत", icon: "🛡" },
  { id: "bills", label: "बिल", icon: "▤" },
  { id: "soundbox", label: "साउंडबॉक्स", icon: "🔊" },
];

/** Bottom tabs. Sticky inside the phone frame, so it also works on `/`. */
export function BottomNav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="sticky bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white">
      {TABS.map((t) => {
        const active = t.id === tab;
        return (
          <button
            key={t.id}
            onClick={() => onTab(t.id)}
            aria-current={active ? "page" : undefined}
            className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium"
            style={{ color: active ? NAVY : "#64748b" }}
          >
            <span
              className="grid h-7 w-11 place-items-center rounded-full text-base"
              style={{ background: active ? TINT : "transparent" }}
              aria-hidden
            >
              {t.icon}
            </span>
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-white p-4 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {title && <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

type BoundBy = NonNullable<SaleTag["boundBy"]>;

const BOUND_BY: Record<BoundBy, string> = {
  bill: "matched by bill made before payment",
  tap: "matched by merchant's tap",
  only_open: "matched as the only open payment",
  amount: "matched by spoken amount",
  amount_and_name: "matched by spoken amount and payer name",
};

/** How a tag was tied to its payment. Nothing is shown when the server did not say. */
export function BoundByChip({ boundBy }: { boundBy?: SaleTag["boundBy"] }) {
  if (!boundBy) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-900">
      🔗 {BOUND_BY[boundBy] ?? `matched by ${boundBy}`}
    </span>
  );
}
