import type { Draft } from "@agent/drafts";
import type { Packet, Snapshot } from "@backend/api";
import { CertificateCard, DraftCard, inr, when } from "../parts";
import { NAVY } from "./chrome";

/**
 * The hold flow, presentation only. All state (explanation, answers, packet,
 * escalation) lives in KavachApp so switching tabs never loses or repeats it.
 */

type Hold = NonNullable<Snapshot["hold"]>;
export type Answers = { lentAccount: boolean | null; receivedForCommission: boolean | null };

const primary =
  "w-full rounded-full py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50";

/** Reassures before it instructs: one payment, not an accusation. */
export function HoldAlert({
  hold,
  explanation,
  explaining,
  canSpeak,
  onSpeak,
}: {
  hold: Hold;
  explanation: Draft | null;
  explaining: boolean;
  canSpeak: boolean;
  onSpeak: (text: string) => void;
}) {
  return (
    <section id="kavach-hold" className="overflow-hidden rounded-2xl border-2 border-red-500 bg-white shadow-sm">
      <div className="bg-red-50 p-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-red-700">
          <span className="rounded bg-red-600 px-1.5 py-0.5 text-white">Kavach</span>
          {hold.scope === "debit_freeze"
            ? "Withdrawals stopped · complaint on one payment"
            : "Hold on one payment"}
        </div>
        {hold.scope === "debit_freeze" ? (
          <>
            <div className="mt-1 text-2xl font-bold text-red-700">खाते से निकासी पर रोक</div>
            <p className="mt-1 text-sm font-medium text-red-900">
              शिकायत सिर्फ़ एक पेमेंट की है: {inr(hold.heldAmountInr)}। यह कोई आरोप नहीं है।
            </p>
          </>
        ) : (
          <>
            <div className="mt-1 text-3xl font-bold text-red-700">{inr(hold.heldAmountInr)} पर रोक</div>
            <p className="mt-1 text-sm font-medium text-red-900">
              सिर्फ़ इस एक पेमेंट पर, पूरे खाते पर नहीं। यह कोई आरोप नहीं है।
            </p>
          </>
        )}
        <p className="mt-1 text-xs text-red-800">
          Reference {hold.reference} · {when(hold.placedAt)}
        </p>
      </div>
      {explanation ? (
        <div className="p-4">
          <p className="text-[15px] leading-relaxed text-slate-900">{explanation.text}</p>
          {canSpeak && (
            <button
              onClick={() => onSpeak(explanation.text)}
              className="mt-2 rounded-full bg-brand-tint px-3 py-1.5 text-sm font-semibold"
              style={{ color: NAVY }}
            >
              ▶ सुनिए
            </button>
          )}
        </div>
      ) : (
        explaining && <p className="p-4 text-sm text-red-800">समझा रहे हैं…</p>
      )}
    </section>
  );
}

/** Mule screen: two yes/no questions before any document is prepared. */
export function MuleScreen({
  answers,
  onAnswers,
  busy,
  onSubmit,
}: {
  answers: Answers;
  onAnswers: (a: Answers) => void;
  busy: string | null;
  onSubmit: () => void;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="text-[15px] font-semibold text-slate-900">दो छोटे सवाल</h3>
      <Question
        text="क्या आपने यह खाता या QR किसी और को इस्तेमाल करने दिया?"
        sub="Did you let anyone else use this account or QR?"
        value={answers.lentAccount}
        onChange={(v) => onAnswers({ ...answers, lentAccount: v })}
      />
      <Question
        text="क्या आपने किसी और के लिए पैसा लेकर आगे भेजा या कमीशन लिया?"
        sub="Did you receive money for someone else, or for a commission?"
        value={answers.receivedForCommission}
        onChange={(v) => onAnswers({ ...answers, receivedForCommission: v })}
      />
      <button
        onClick={onSubmit}
        disabled={busy !== null || answers.lentAccount === null || answers.receivedForCommission === null}
        className={`${primary} mt-4`}
        style={{ background: NAVY }}
      >
        {busy === "packet" ? "काग़ज़ तैयार हो रहे हैं…" : "मेरे काग़ज़ तैयार कीजिए"}
      </button>
    </section>
  );
}

function Question({
  text,
  sub,
  value,
  onChange,
}: {
  text: string;
  sub: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  const pill = (selected: boolean) =>
    `rounded-full border px-5 py-1.5 text-sm font-semibold ${
      selected ? "border-brand-navy bg-brand-navy text-white" : "border-slate-300 text-slate-700"
    }`;
  return (
    <div className="mt-3">
      <p className="text-[15px] text-slate-900">{text}</p>
      <p className="text-xs text-slate-500">{sub}</p>
      <div className="mt-1.5 flex gap-2">
        <button className={pill(value === true)} onClick={() => onChange(true)}>
          हाँ
        </button>
        <button className={pill(value === false)} onClick={() => onChange(false)}>
          नहीं
        </button>
      </div>
    </div>
  );
}

/** Certificate and grievance, or the legal-aid / no-certificate outcome. */
export function PacketView({
  packet,
  alerts,
  filed,
  busy,
  onFiled,
}: {
  packet: Packet;
  alerts: Snapshot["lawWatch"]["alertsByRule"];
  filed: boolean;
  busy: string | null;
  onFiled: () => void;
}) {
  if (packet.eligibility.outcome !== "eligible") {
    return (
      <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
        <h3 className="text-[15px] font-semibold text-slate-900">
          {packet.eligibility.outcome === "legal_aid"
            ? "कृपया कानूनी सहायता लीजिए"
            : "Certificate not available"}
        </h3>
        <p className="mt-1 text-sm text-slate-700">{packet.eligibility.reason}</p>
        {"referral" in packet && packet.referral && (
          <>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-900">{packet.referral.hi}</p>
            <p className="mt-1 text-sm text-slate-600">{packet.referral.en}</p>
          </>
        )}
      </section>
    );
  }
  if (!("certificate" in packet)) return null;
  return (
    <>
      <CertificateCard cert={packet.certificate} />
      <DraftCard
        title="Grievance to your bank"
        draft={packet.grievance}
        filename={`grievance-${packet.certificate.hold.reference}.txt`}
        alerts={alerts}
      />
      {!filed && (
        <button
          onClick={onFiled}
          disabled={busy !== null}
          className="w-full rounded-full border-2 bg-white py-3 text-sm font-semibold disabled:opacity-50"
          style={{ color: NAVY, borderColor: NAVY }}
        >
          मैंने इसे अपने बैंक में जमा कर दिया है
        </button>
      )}
    </>
  );
}

export function TrackerCard({
  tracker,
  ladder,
}: {
  tracker: NonNullable<Snapshot["tracker"]>;
  ladder: Snapshot["ladder"];
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="text-[15px] font-semibold text-slate-900">Grievance tracker</h3>
      <ol className="mt-2 space-y-2 text-sm">
        {ladder.steps.map((step, i) => (
          <li
            key={step.level}
            className={`rounded-xl p-2 ${
              i === tracker.currentStep ? "bg-brand-tint font-medium text-brand-navy" : "text-slate-500"
            }`}
          >
            {step.level}. {step.to}
            <div className="text-[11px] font-normal">{step.deadline}</div>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm text-slate-700">
        Day {tracker.daysSinceFiled} since you complained at your bank.{" "}
        {tracker.stage === "escalation_due"
          ? `No decision after ${tracker.escalateAfterDays} days. A letter to the next level is ready below.`
          : `If there is no decision by day ${tracker.escalateAfterDays}, Kavach will draft a letter to the next level.`}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">
        {ladder.placeholder
          ? `The ${tracker.escalateAfterDays}-day figure is a demo placeholder, not a verified deadline.`
          : ladder.note}
      </p>
    </section>
  );
}
