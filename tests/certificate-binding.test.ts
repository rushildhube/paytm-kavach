/**
 * The certificate says how the sale description was tied to the payment, so a
 * reader can judge its weight (#15, #19).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { handle } from "@backend/api";
import { buildCertificate } from "@backend/certificate";
import { resetStore } from "@backend/store";

process.env.KAVACH_USE_MODEL = "0";

beforeEach(() => resetStore());

async function holdOn(txnId: string): Promise<string> {
  await handle({ action: "report", role: "bank", txnId });
  return ((await handle({ action: "hold", role: "bank", txnId })).result as { id: string }).id;
}

describe("certificate binding", () => {
  it("names the bill when the payment was made against one", async () => {
    const bill = (await handle({ action: "bill-create", amountInr: 826, text: "do kilo cheeni, ek tel" }))
      .result as { id: string };
    const paid = (await handle({ action: "pay", billId: bill.id, amountInr: 826 })).result as {
      txn: { id: string };
    };
    const cert = buildCertificate(await holdOn(paid.txn.id), new Date());
    expect(cert.saleTag?.source).toBe("bill");
    expect(cert.saleTag?.boundBy).toBe("bill");
    expect(cert.saleTag?.billId).toBe(bill.id);
    expect(cert.provenance.join(" ")).toMatch(/bill the merchant created before the payment/);
  });

  it("records an amount match from the Soundbox", async () => {
    await handle({ action: "pay", amountInr: 650 });
    const second = (await handle({ action: "pay", amountInr: 1200 })).result as { txn: { id: string } };
    const tagged = (await handle({ action: "tag-auto", transcript: "1200 ka chawal" })).result as {
      outcome: string;
      txnId: string;
    };
    expect(tagged).toMatchObject({ outcome: "bound", txnId: second.txn.id });
    const cert = buildCertificate(await holdOn(second.txn.id), new Date());
    expect(cert.saleTag?.boundBy).toBe("amount");
    expect(cert.provenance.join(" ")).toMatch(/amount the merchant said matched/);
  });
});
