import { BRAND } from "./brand";

/**
 * The demo brand's logo, drawn inline: a shield (Kavach) holding an eye
 * (Saakshi, the witness) with a saffron pupil, beside a one-colour wordmark.
 * Original artwork; the name and colours come from brand.ts.
 *
 * - "full": mark and wordmark, for light backgrounds
 * - "mark": the shield alone
 * - "white": mark and wordmark for dark backgrounds
 */
export function BrandLogo({
  size = 28,
  variant = "full",
  className = "",
}: {
  /** Height of the mark in pixels; the wordmark scales with it. */
  size?: number;
  variant?: "full" | "mark" | "white";
  className?: string;
}) {
  const white = variant === "white";
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      role="img"
      aria-label={BRAND.name}
    >
      <BrandMark size={size} inverted={white} />
      {variant !== "mark" && (
        <span
          aria-hidden
          className="font-bold leading-none tracking-tight"
          style={{ fontSize: size * 0.72, color: white ? "#fff" : BRAND.navy }}
        >
          {BRAND.name}
        </span>
      )}
    </span>
  );
}

/** The shield-and-eye mark. Also the favicon shape (src/app/icon.svg). */
export function BrandMark({ size = 28, inverted = false }: { size?: number; inverted?: boolean }) {
  const shield = inverted ? "#fff" : BRAND.primary;
  const eye = inverted ? BRAND.primary : "#fff";
  return (
    <svg width={size * (40 / 44)} height={size} viewBox="0 0 40 44" aria-hidden>
      <path d="M20 2 36 8v12c0 11-7 18.5-16 22C11 38.5 4 31 4 20V8Z" fill={shield} />
      <path d="M9 21.5Q20 10 31 21.5 20 33 9 21.5Z" fill={eye} />
      <circle cx="20" cy="21.5" r="5" fill={BRAND.accent} />
      <circle cx="20" cy="21.5" r="2" fill={BRAND.navy} />
    </svg>
  );
}
