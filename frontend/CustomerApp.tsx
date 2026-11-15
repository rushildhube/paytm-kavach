"use client";

import { useCallback, useEffect, useState } from "react";
import type { CustomerSnapshot } from "@backend/api";
import { DEMO_PAYER_VPA, DEMO_PAYMENT } from "@data/seed";
import { inr, when } from "./parts";
import { useLive } from "./useLive";

type Step = "home" | "scan" | "amount" | "pin" | "paying" | "done";
type Paid = { id: string; amountInr: number; at: string };

/**
 * The buyer's phone: a Paytm-style scan-and-pay flow. In the story this
 * buyer is paying with money from a hacked account; the shopkeeper has no
 * way to know that.
 */
export default function CustomerApp() {
  const [step, setStep] = useState<Step>("home");
  const [amount, setAmount] = useState(String(DEMO_PAYMENT.amountInr));
  const [pin, setPin] = useState("");
  const [paid, setPaid] = useState<Paid | null>(null);

  const restart = useCallback(() => {
    setStep("home");
    setAmount(String(DEMO_PAYMENT.amountInr));
    setPin("");
    setPaid(null);
  }, []);
  const { state, error, call } = useLive<CustomerSnapshot>("customer", {
    intervalMs: 2000,
    onReset: restart,
  });

  // The "camera" finds the shop's QR after a moment.
  useEffect(() => {
    if (step !== "scan") return;
    const t = setTimeout(() => setStep("amount"), 1400);
    return () => clearTimeout(t);
  }, [step]);

  const pay = useCallback(async () => {
    setStep("paying");
    const reply = await call<{ txn: Paid }>({
      action: "pay",
      amountInr: Number(amount),
      payerVpa: DEMO_PAYER_VPA,
    });
    if (reply) {
      setPaid(reply.result.txn);
      setStep("done");
    } else {
      setPin("");
      setStep("amount");
    }
  }, [amount, call]);

  const press = (k: string) => {
    if (k === "⌫") return setPin((p) => p.slice(0, -1));
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) void pay();
  };

  const payee = state?.payee;
  const amountOk = Number(amount) > 0 && Number(amount) <= 100000;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-white">
      {step === "home" && (
        <>
          <header className="bg-[#00BAF2] px-5 pb-6 pt-8 text-white">
            <div className="text-sm opacity-90">Paytm · demo</div>
            <div className="mt-1 text-2xl font-bold">Hi, Vikram</div>
          </header>
          <main className="flex-1 p-5">
            <button
              onClick={() => setStep("scan")}
              className="flex w-full flex-col items-center gap-2 rounded-2xl bg-[#002E6E] py-8 text-white shadow-lg active:scale-[0.98]"
            >
              <QrIcon />
              <span className="text-lg font-semibold">Scan &amp; Pay</span>
            </button>
            <div className="mt-6 grid grid-cols-4 gap-3 text-center text-xs text-slate-600">
              {["To Mobile", "To Bank", "Balance", "History"].map((l) => (
                <div key={l} className="rounded-xl bg-slate-100 py-4">{l}</div>
              ))}
            </div>
            <p className="mt-8 text-center text-xs text-slate-400">
              Demo app. Synthetic accounts only. No real money moves.
            </p>
          </main>
        </>
      )}

      {step === "scan" && (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-black text-white">
          <div className="relative h-64 w-64 rounded-3xl border-4 border-[#00BAF2]">
            <div className="absolute inset-x-4 top-1/2 h-0.5 animate-pulse bg-[#00BAF2]" />
          </div>
          <p className="mt-6 text-sm opacity-80">Point at the shop&apos;s QR code…</p>
          <button onClick={() => setStep("home")} className="mt-8 text-sm underline opacity-70">
            Cancel
          </button>
        </div>
      )}

      {(step === "amount" || step === "pin" || step === "paying") && payee && (
        <>
          <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <button onClick={restart} className="text-xl text-slate-500" aria-label="Back">←</button>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-lg font-bold text-amber-800">
              {payee.shopName[0]}
            </div>
            <div>
              <div className="font-semibold text-slate-900">{payee.shopName}</div>
              <div className="text-xs text-slate-500">{payee.vpa}</div>
            </div>
          </header>

          {step === "amount" && (
            <main className="flex flex-1 flex-col items-center p-6">
              <div className="mt-10 flex items-baseline text-5xl font-bold text-slate-900">
                <span className="mr-1 text-3xl">₹</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  className="w-44 bg-transparent text-center outline-none"
                  aria-label="Amount"
                />
              </div>
              <p className="mt-2 text-sm text-slate-500">Paying {payee.shopName}, {payee.city}</p>
              {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button
                disabled={!amountOk}
                onClick={() => setStep("pin")}
                className="mt-auto w-full rounded-xl bg-[#00BAF2] py-4 text-lg font-semibold text-white disabled:opacity-40"
              >
                Pay {amountOk ? inr(Number(amount)) : ""}
              </button>
            </main>
          )}

          {(step === "pin" || step === "paying") && (
            <main className="flex flex-1 flex-col bg-slate-50">
              <div className="p-6 text-center">
                <div className="text-sm text-slate-500">Demo Bank •••• 0042</div>
                <div className="mt-1 text-3xl font-bold">{inr(Number(amount))}</div>
                <div className="mt-6 text-sm font-medium text-slate-700">
                  {step === "paying" ? "Paying…" : "Enter UPI PIN (any 4 digits)"}
                </div>
                <div className="mt-3 flex justify-center gap-4">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-4 w-4 rounded-full ${i < pin.length ? "bg-slate-900" : "border-2 border-slate-400"}`}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-auto grid grid-cols-3 gap-px bg-slate-200">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) => (
                  <button
                    key={i}
                    disabled={!k || step === "paying"}
                    onClick={() => press(k)}
                    className="bg-white py-5 text-2xl font-medium text-slate-900 active:bg-slate-100"
                  >
                    {k}
                  </button>
                ))}
              </div>
            </main>
          )}
        </>
      )}

      {step === "done" && paid && payee && (
        <main className="flex min-h-dvh flex-col items-center bg-[#00B9F1] p-6 text-white">
          <div className="mt-20 flex h-24 w-24 items-center justify-center rounded-full bg-white text-5xl text-[#00B9F1]">
            ✓
          </div>
          <div className="mt-6 text-lg">Paid to {payee.shopName}</div>
          <div className="mt-1 text-5xl font-bold">{inr(paid.amountInr)}</div>
          <div className="mt-4 text-sm opacity-90">{when(paid.at)} · Ref {paid.id}</div>
          <button
            onClick={restart}
            className="mt-auto w-full rounded-xl bg-white py-4 font-semibold text-[#002E6E]"
          >
            Done
          </button>
        </main>
      )}

      {!state && <p className="p-6 text-slate-500">{error ?? "Loading…"}</p>}
    </div>
  );
}

function QrIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2" />
    </svg>
  );
}
