import type { Draft } from "@agent/drafts";
import type { SaleCertificate } from "@backend/certificate";
import type { Rule } from "@backend/rules";
import type { RuleAlert } from "@backend/watcher";

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

export function Disclaimer({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
      {text}
    </p>
  );
}

const STATUS_LABEL: Record<Rule["status"], string> = {
  statute: "Statute",
  contested: "Contested",
  administrative: "Administrative procedure",
  binding_direction: "Binding court direction",
  draft: "Draft, not in force",
};

export type AlertsByRule = Record<string, RuleAlert[]>;

export function Citations({ rules, alerts = {} }: { rules: Rule[]; alerts?: AlertsByRule }) {
  if (rules.length === 0) return null;
  return (
    <ol className="space-y-2 text-xs text-slate-600">
      {rules.map((r, i) => (
        <li key={r.id} className="rounded-lg bg-slate-50 p-2">
          <div className="font-medium text-slate-800">
            [{i + 1}] {r.instrument}
            <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide">
              {STATUS_LABEL[r.status]}
            </span>
          </div>
          <div className="mt-0.5">{r.summary}</div>
          <div className="mt-1 text-[11px]">
            Source:{" "}
            {r.source_url ? (
              <a href={r.source_url} target="_blank" rel="noreferrer" className="underline">
                {r.source_name}
              </a>
            ) : (
              r.source_name
            )}
            .{" "}
            {r.verified && r.last_checked ? (
              <span>Checked {r.last_checked}.</span>
            ) : (
              <span className="font-medium text-amber-700">
                Not yet verified against the primary source.
              </span>
            )}
          </div>
          {alerts[r.id]?.map((a) => (
            <div key={a.link || a.title} className="mt-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
              <span className="font-semibold">Possibly changed, under review.</span> {a.feedName}:{" "}
              {a.link ? (
                <a href={a.link} target="_blank" rel="noreferrer" className="underline">
                  {a.title}
                </a>
              ) : (
                a.title
              )}
            </div>
          ))}
        </li>
      ))}
    </ol>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export function CertificateCard({ cert }: { cert: SaleCertificate }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold text-slate-900">Sale certificate</h3>
        <span className="text-xs text-slate-500">{cert.certificateId}</span>
      </div>

      <h4 className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-[#002E6E]">
        From Paytm records
      </h4>
      <dl className="divide-y divide-slate-100">
        <Row label="Shop" value={`${cert.merchant.shopName}, ${cert.merchant.city}`} />
        <Row label="Account" value={`•••• ${cert.merchant.accountLast4}`} />
        <Row label="Transaction" value={cert.transaction.id} />
        <Row label="Amount" value={inr(cert.transaction.amountInr)} />
        <Row label="Received" value={when(cert.transaction.at)} />
        <Row label="Payer (masked)" value={cert.transaction.payerVpaMasked} />
        <Row label="Settlement" value={cert.transaction.settlementStatus} />
      </dl>

      <h4 className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
        Said by the merchant at payment time
      </h4>
      {cert.saleTag ? (
        <div className="mt-1 rounded-lg bg-emerald-50 p-3 text-sm">
          <div className="text-base font-medium text-emerald-950">
            “{cert.saleTag.transcript}”
          </div>
          <ul className="mt-1 text-emerald-900">
            {cert.saleTag.items.map((it, i) => (
              <li key={i}>
                {it.quantity ?? ""} {it.unit ?? ""} {it.name}
              </li>
            ))}
          </ul>
          <div className="mt-1 text-xs text-emerald-800">
            Recorded {cert.saleTag.secondsAfterPayment}s after the payment, before the hold.
            Cannot be added or edited later.
          </div>
        </div>
      ) : (
        <p className="mt-1 text-sm text-slate-600">
          No sale description was recorded for this payment.
        </p>
      )}
    </section>
  );
}

export function DraftCard({
  title,
  draft,
  filename,
  alerts,
}: {
  title: string;
  draft: Draft;
  filename: string;
  alerts?: AlertsByRule;
}) {
  const full = `${draft.text}\n\n---\n${draft.disclaimer}\n`;
  const download = () => {
    const url = URL.createObjectURL(new Blob([full], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">
          {title}{" "}
          <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
            Draft
          </span>
        </h3>
        <span className="text-[10px] text-slate-400">
          {draft.generatedBy === "sarvam" ? "Worded by AI from verified facts" : "Standard wording"}
        </span>
      </div>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-[13px] leading-relaxed text-slate-800">
        {draft.text}
      </pre>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => navigator.clipboard.writeText(full)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Copy
        </button>
        <button
          onClick={download}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Download
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Read it, correct anything that is wrong, and file it at your bank yourself.
      </p>
      <div className="mt-3">
        <Citations rules={draft.citations} alerts={alerts} />
      </div>
    </section>
  );
}
