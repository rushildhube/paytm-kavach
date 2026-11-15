"use client";

import type { CustomerSnapshot } from "@backend/api";
import { BrandLogo } from "./BrandLogo";
import { QrCode } from "./QrCode";
import { buildUpiUri } from "./upi";
import { useLive } from "./useLive";

/**
 * The shop's printable counter standee with its static UPI QR
 * (`upi://pay?pa=…&pn=…&cu=INR`, no amount). Styled after a Paytm standee,
 * clearly marked as a demo. Uses only what the buyer could see anyway.
 */
export default function ShopStandee() {
  const { state, error } = useLive<CustomerSnapshot>("customer", { intervalMs: 5000 });
  const payee = state?.payee;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-200 p-4 print:bg-white print:p-0">
      {!payee ? (
        <p className="text-slate-500">{error ?? "Loading…"}</p>
      ) : (
        <article className="w-[340px] overflow-hidden rounded-3xl bg-white shadow-xl print:shadow-none">
          <div className="flex flex-col items-center px-6 pt-6">
            <BrandLogo size={40} />
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy">Accepted here</div>
            <h1 className="mt-4 text-center text-2xl font-bold text-slate-900">{payee.shopName}</h1>
            <div className="text-sm text-slate-500">{payee.city}</div>
            <div className="mt-4 rounded-2xl border-[6px] border-brand p-2">
              <QrCode
                text={buildUpiUri({ pa: payee.vpa, pn: payee.shopName })}
                size={240}
                label={`UPI QR for ${payee.shopName}`}
              />
            </div>
            <div className="mt-3 font-mono text-sm text-slate-700">{payee.vpa}</div>
          </div>
          <div className="mt-5 bg-brand-navy px-6 py-4 text-center text-white">
            <div className="text-lg font-bold">Scan &amp; Pay with any UPI app</div>
            <div className="text-sm opacity-90">किसी भी UPI ऐप से स्कैन करके भुगतान करें</div>
          </div>
          <div className="bg-amber-100 px-4 py-1.5 text-center text-[11px] font-semibold text-amber-900">
            DEMO · Kavach hackathon prototype · not a real payment QR · no real money moves
          </div>
        </article>
      )}
      <button
        onClick={() => window.print()}
        className="no-print rounded-xl bg-brand px-6 py-3 font-semibold text-white"
      >
        Print standee
      </button>
    </div>
  );
}
