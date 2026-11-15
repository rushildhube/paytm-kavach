"use client";

import { useCallback, useState } from "react";
import type { CustomerSnapshot } from "@backend/api";
import { DEMO_PAYER_VPA, DEMO_PAYMENT } from "@data/seed";
import { inr, when } from "./parts";
import { BrandLogo } from "./BrandLogo";
import { BRAND } from "./brand";
import { QrScanner } from "./QrScanner";
import { parseUpiUri, UPI_REJECT_TEXT } from "./upi";
import { DemoPill } from "./ui";
import { useLive } from "./useLive";

type Step = "home" | "scan" | "lookup" | "amount" | "pin" | "paying" | "done" | "refused";
type Paid = { id: string; amountInr: number; at: string };
/** What `bill-lookup` lets a buyer's phone see: nothing beyond shop, amount and status. */
type BillView = { id: string; amountInr: number; status: "open" | "paid" | "cancelled"; shopName: string };

const PRIMARY = BRAND.primary;
const NAVY = BRAND.navy;

/**
 * The buyer's phone: Paytm-style Scan & Pay. The camera reads a real UPI QR
 * (the shop's standee at /qr, or a bill QR from /merchant/bill). In the story
 * this buyer is paying with money from a hacked account; the shopkeeper has
 * no way to know that. Shows nothing about the merchant's account or holds.
 */
export default function CustomerApp() {
  const [step, setStep] = useState<Step>("home");
  const [amount, setAmount] = useState("");
  const [bill, setBill] = useState<BillView | null>(null);
  const [pin, setPin] = useState("");
  const [paid, setPaid] = useState<Paid | null>(null);
  const [refusal, setRefusal] = useState("");

  const restart = useCallback(() => {
    setStep("home");
    setAmount("");
    setBill(null);
    setPin("");
    setPaid(null);
    setRefusal("");
  }, []);
  const { state, error, setError, call } = useLive<CustomerSnapshot>("customer", {
    intervalMs: 2000,
    onReset: restart,
  });
  const payee = state?.payee;

  const refuse = useCallback((why: string) => {
    setRefusal(why);
    setStep("refused");
  }, []);

  /** A bill QR: the server, not the QR, says what is owed and whether it can be paid. */
  const openBill = useCallback(
    async (billId: string, qrAmount: number | undefined) => {
      setStep("lookup");
      const reply = await call<BillView>({ action: "bill-lookup", billId });
      if (!reply) return refuse("This bill could not be found. Ask the shop for a new QR.");
      const b = reply.result;
      if (b.status === "paid") return refuse(`Bill ${b.id} is already paid.`);
      if (b.status !== "open") return refuse(`Bill ${b.id} was cancelled by the shop.`);
      if (qrAmount !== undefined && Math.abs(qrAmount - b.amountInr) > 0.001) {
        return refuse("The amount on this QR does not match the shop's bill. Do not pay; ask the shop.");
      }
      setBill(b);
      setAmount(String(b.amountInr));
      setStep("amount");
    },
    [call, refuse],
  );

  const onDecode = useCallback(
    (text: string): string | null => {
      if (!payee) return "Still loading, hold the QR steady";
      const parsed = parseUpiUri(text, payee.vpa);
      if (!parsed.ok) return UPI_REJECT_TEXT[parsed.reason];
      const { am, tr } = parsed.payment;
      setError(null);
      if (tr) {
        void openBill(tr, am);
      } else {
        setBill(null);
        setAmount(am !== undefined ? String(am) : "");
        setStep("amount");
      }
      return null;
    },
    [payee, openBill, setError],
  );

  /** Clear any error left from an earlier refused payment before a new scan. */
  const startScan = useCallback(() => {
    setError(null);
    setStep("scan");
  }, [setError]);

  /** Demo fallback when no camera works: the shop's static QR, ₹826 prefilled. */
  const pickShop = useCallback(() => {
    setError(null);
    setBill(null);
    setAmount(String(DEMO_PAYMENT.amountInr));
    setStep("amount");
  }, [setError]);

  const pay = useCallback(async () => {
    setStep("paying");
    const body = bill
      ? { action: "pay", billId: bill.id, amountInr: bill.amountInr, payerVpa: DEMO_PAYER_VPA }
      : { action: "pay", amountInr: Number(amount), payerVpa: DEMO_PAYER_VPA };
    const reply = await call<{ txn: Paid }>(body);
    if (reply) {
      setPaid(reply.result.txn);
      setStep("done");
    } else if (bill) {
      // A bill can be paid or cancelled between scan and PIN: never fall back to a free amount.
      refuse("Payment failed: this bill is no longer open. No money was taken.");
    } else {
      setPin("");
      setStep("amount");
    }
  }, [amount, bill, call, refuse]);

  const press = (k: string) => {
    if (k === "⌫") return setPin((p) => p.slice(0, -1));
    if (k === "✓") {
      if (pin.length === 4) void pay();
      return;
    }
    if (pin.length >= 4) return;
    setPin(pin + k);
  };

  const n = Number(amount);
  const amountOk = /^\d+(\.\d{1,2})?$/.test(amount) && n > 0 && n <= 100000;

  if (step === "scan") {
    return (
      <div className="mx-auto w-full max-w-md">
        <QrScanner onDecode={onDecode} onCancel={restart} onFallback={pickShop} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-white">
      {step === "home" && (
        <>
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-tint text-sm font-bold text-brand-navy">
              V
            </div>
            <BrandLogo size={24} />
            <DemoBadge />
          </header>
          <main className="flex-1 bg-slate-100 p-4">
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-brand-navy">UPI Money Transfer</h2>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[11px] leading-tight text-slate-700">
                <button onClick={startScan} className="flex flex-col items-center gap-1.5">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-navy text-white shadow">
                    <QrIcon />
                  </span>
                  <span className="font-semibold text-brand-navy">Scan &amp; Pay</span>
                </button>
                {["To Mobile or Contact", "To Bank A/c or UPI ID", "To Self A/c"].map((l) => (
                  <div key={l} className="flex flex-col items-center gap-1.5 opacity-50">
                    <span className="h-14 w-14 rounded-2xl bg-brand-tint" />
                    <span>{l}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-brand">
                <span className="opacity-50">Balance &amp; History</span>
                <span className="opacity-50">Receive Money</span>
              </div>
            </section>
            <p className="mt-8 text-center text-xs text-slate-400">
              Demo app for the Kavach hackathon. Synthetic accounts only. No real money moves.
            </p>
          </main>
          <div className="sticky bottom-0 flex justify-center bg-gradient-to-t from-white pb-5 pt-3">
            <button
              onClick={startScan}
              className="flex items-center gap-2 rounded-full px-7 py-3.5 font-semibold text-white shadow-lg active:scale-95"
              style={{ background: PRIMARY }}
            >
              <QrIcon size={22} /> Scan
            </button>
          </div>
        </>
      )}

      {step === "lookup" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          Fetching bill…
        </div>
      )}

      {step === "refused" && (
        <main className="flex flex-1 flex-col items-center p-6 text-center">
          <div className="mt-20 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-4xl text-red-600">
            !
          </div>
          <p className="mt-6 text-lg font-semibold text-slate-900">Can&apos;t pay this QR</p>
          <p className="mt-2 text-slate-600">{refusal}</p>
          <button
            onClick={restart}
            className="mt-auto w-full rounded-xl py-4 text-lg font-semibold text-white"
            style={{ background: NAVY }}
          >
            Back to home
          </button>
        </main>
      )}

      {(step === "amount" || step === "pin" || step === "paying") && payee && (
        <>
          {step === "amount" && (
            <>
              <header className="flex items-center gap-3 px-4 py-3">
                <button onClick={restart} className="text-2xl text-slate-600" aria-label="Back">
                  ←
                </button>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-lg font-bold text-amber-800">
                  {payee.shopName[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-900">{payee.shopName}</div>
                  <div className="truncate text-xs text-slate-500">UPI ID: {payee.vpa}</div>
                </div>
                <DemoBadge />
              </header>
              <main className="flex flex-1 flex-col items-center px-6 pb-6">
                <p className="mt-6 text-sm text-slate-500">
                  {bill ? `Bill ${bill.id} from the shop` : `Paying ${payee.shopName}, ${payee.city}`}
                </p>
                <div className="mt-3 flex items-baseline text-5xl font-bold text-slate-900">
                  <span className="mr-1 text-3xl">₹</span>
                  {bill ? (
                    <span aria-label="Amount">{bill.amountInr.toLocaleString("en-IN")}</span>
                  ) : (
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, "").slice(0, 9))}
                      inputMode="decimal"
                      placeholder="0"
                      autoFocus
                      className="w-48 bg-transparent text-center outline-none placeholder:text-slate-300"
                      aria-label="Amount"
                    />
                  )}
                </div>
                {bill && (
                  <p className="mt-2 rounded-full bg-brand-tint px-3 py-1 text-xs font-medium text-brand-navy">
                    Amount fixed by the shop&apos;s bill
                  </p>
                )}
                {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <div className="mt-auto w-full">
                  <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
                    <span className="text-slate-500">Pay from</span>
                    <span className="font-semibold text-slate-800">Demo Bank •••• 0042</span>
                  </div>
                  <button
                    disabled={!amountOk}
                    onClick={() => {
                      setPin("");
                      setStep("pin");
                    }}
                    className="w-full rounded-xl py-4 text-lg font-semibold text-white disabled:opacity-40"
                    style={{ background: PRIMARY }}
                  >
                    Pay {amountOk ? inr(n) : ""}
                  </button>
                </div>
              </main>
            </>
          )}

          {(step === "pin" || step === "paying") && (
            <main className="flex min-h-dvh flex-col bg-slate-100">
              <div className="flex items-center justify-between bg-white px-4 py-3 text-sm">
                <span className="font-semibold text-slate-800">Demo Bank</span>
                <DemoBadge />
                <span className="text-slate-500">XXXX0042</span>
              </div>
              <div className="flex items-center justify-between bg-brand-tint px-4 py-3 text-sm">
                <div>
                  <div className="text-slate-500">To:</div>
                  <div className="font-semibold text-slate-900">{payee.shopName}</div>
                </div>
                <div className="text-right">
                  <div className="text-slate-500">Sending:</div>
                  <div className="font-semibold text-slate-900">₹{n.toFixed(2)}</div>
                </div>
              </div>
              <div className="flex flex-col items-center p-6">
                <div className="text-xs font-semibold tracking-widest text-slate-600">
                  {step === "paying" ? "PROCESSING…" : "ENTER 4-DIGIT UPI PIN"}
                </div>
                <div className="mt-5 flex gap-5">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="flex h-8 w-8 items-end justify-center border-b-2 border-slate-700 text-2xl">
                      {i < pin.length ? "●" : ""}
                    </span>
                  ))}
                </div>
                <p className="mt-6 text-center text-xs text-slate-500">
                  Demo: any 4 digits. Never share a real UPI PIN with anyone.
                </p>
              </div>
              <div className="mt-auto grid grid-cols-3 bg-white">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].map((k) => (
                  <button
                    key={k}
                    disabled={step === "paying" || (k === "✓" && pin.length < 4)}
                    onClick={() => press(k)}
                    className={`py-5 text-2xl font-medium active:bg-slate-100 ${
                      k === "✓" ? "text-white disabled:opacity-40" : "text-slate-900"
                    }`}
                    style={k === "✓" ? { background: NAVY } : undefined}
                    aria-label={k === "⌫" ? "Delete" : k === "✓" ? "Submit PIN" : k}
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
        <main className="flex min-h-dvh flex-col items-center bg-white p-6">
          <div className="flex w-full justify-end">
            <DemoBadge />
          </div>
          <div className="kavach-pop mt-14 flex h-24 w-24 items-center justify-center rounded-full bg-[#21C17A] shadow-lg shadow-green-200">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="mt-6 text-5xl font-bold text-slate-900">{inr(paid.amountInr)}</div>
          <div className="mt-2 text-lg font-semibold text-[#21C17A]">Paid Successfully</div>
          <div className="mt-1 text-slate-700">to {payee.shopName}</div>
          <div className="mt-6 w-full rounded-xl bg-slate-100 p-4 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>Date &amp; time</span>
              <span className="font-medium text-slate-800">{when(paid.at)}</span>
            </div>
            <div className="mt-2 flex justify-between">
              <span>Ref No.</span>
              <span className="font-medium text-slate-800">{paid.id}</span>
            </div>
            {bill && (
              <div className="mt-2 flex justify-between">
                <span>Bill</span>
                <span className="font-medium text-slate-800">{bill.id}</span>
              </div>
            )}
            <div className="mt-2 flex justify-between">
              <span>From</span>
              <span className="font-medium text-slate-800">Demo Bank •••• 0042</span>
            </div>
          </div>
          <div className="mt-auto flex w-full flex-col items-center gap-4">
            <BrandLogo size={20} className="opacity-80" />
            <button
              onClick={restart}
              className="w-full rounded-xl py-4 font-semibold text-white"
              style={{ background: NAVY }}
            >
              Done
            </button>
          </div>
        </main>
      )}

      {!state && <p className="p-6 text-slate-500">{error ?? "Loading…"}</p>}
    </div>
  );
}

function DemoBadge() {
  return <DemoPill />;
}

function QrIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2" />
    </svg>
  );
}
