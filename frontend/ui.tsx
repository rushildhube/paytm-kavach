import { BrandLogo } from "./BrandLogo";

/**
 * The shared look for every screen (customer, Soundbox, merchant, bank), so
 * the demo reads as one product. Colours come only from brand.ts through the
 * Tailwind `brand-*` colours; nothing here hard-codes the brand.
 */

/** Page background behind the cards on every screen. */
export const PAGE = "bg-slate-100";

/** White card, used for every panel. */
export const CARD = "rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";

/** Button styles. Size defaults to medium; add `w-full` or padding as needed. */
export const BTN = {
  primary: `${BASE} bg-brand px-5 py-2.5 text-sm text-white shadow-sm hover:brightness-95`,
  navy: `${BASE} bg-brand-navy px-5 py-2.5 text-sm text-white hover:brightness-110`,
  outline: `${BASE} border-2 border-brand bg-white px-5 py-2 text-sm text-brand-navy hover:bg-brand-tint`,
  quiet: `${BASE} border border-slate-300 bg-white px-5 py-2 text-sm text-slate-700 hover:bg-slate-50`,
  /** Only for actions that restrict money (the bank's hold). */
  danger: `${BASE} bg-red-600 px-5 py-2.5 text-sm text-white hover:bg-red-700`,
};

/** "Demo" label. Every branded screen shows it so nothing is mistaken for a real app. */
export function DemoPill({ label = "Demo" }: { label?: string }) {
  return (
    <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
      {label}
    </span>
  );
}

/**
 * The same top bar on every screen: logo, screen title, Demo label and an
 * optional slot on the right.
 */
export function ScreenHeader({
  title,
  subtitle,
  right,
  className = "",
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={`flex items-center gap-3 bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.06)] ${className}`}>
      <BrandLogo size={24} />
      {(title || subtitle) && (
        <div className="min-w-0 border-l border-slate-200 pl-3">
          {title && <div className="truncate text-sm font-semibold text-brand-navy">{title}</div>}
          {subtitle && <div className="truncate text-[11px] text-slate-500">{subtitle}</div>}
        </div>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {right}
        <DemoPill />
      </div>
    </header>
  );
}

/** Numbered step chip (bank console, guides). */
export function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-navy text-sm font-semibold text-white">
      {n}
    </span>
  );
}

/** Icons drawn as SVG, so they render on every phone (Android fonts lack ⏻). */
export function PowerIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
      <path d="M12 3v8" />
      <path d="M6.6 6.6a8 8 0 1 0 10.8 0" />
    </svg>
  );
}

export function MinusIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden>
      <path d="M5 12h14" />
    </svg>
  );
}

export function PlusIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden>
      <path d="M5 12h14M12 5v14" />
    </svg>
  );
}
