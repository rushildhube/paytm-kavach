"use client";

import { useMemo } from "react";
import QRCode from "qrcode";

/**
 * A QR code drawn as inline SVG, computed synchronously from the text.
 * Crisp at any size and prints cleanly. Error correction M, quiet zone of 2.
 */
export function QrCode({
  text,
  size = 240,
  className,
  label = "QR code",
}: {
  text: string;
  size?: number;
  className?: string;
  label?: string;
}) {
  const { n, d } = useMemo(() => {
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
    const count = qr.modules.size;
    let path = "";
    for (let y = 0; y < count; y++) {
      for (let x = 0; x < count; x++) {
        if (qr.modules.get(y, x)) path += `M${x + 2} ${y + 2}h1v1h-1z`;
      }
    }
    return { n: count + 4, d: path };
  }, [text]);

  return (
    <svg
      viewBox={`0 0 ${n} ${n}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
