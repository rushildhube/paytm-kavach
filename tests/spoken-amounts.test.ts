import { beforeEach, describe, expect, it } from "vitest";
import { handle } from "@backend/api";
import { resetStore } from "@backend/store";
import { spokenAmountsInr } from "@voice/amounts";

describe("spoken amounts (#19)", () => {
  const cases: [string, number[]][] = [
    ["आठ सौ छब्बीस: दो किलो चीनी", [826, 2]],
    ["aath sau chhabbis, do kilo cheeni", [826, 2]],
    ["aath sau chhabis do kilo cheeni", [826, 2]],
    ["eight hundred twenty six rupees", [826]],
    ["two hundred and fifty", [250]],
    ["826 wala, ek tel", [826, 1]],
    ["₹1,200 ka saman", [1200]],
    ["Rs 1,00,000", [100000]],
    ["ek hazaar do sau", [1200]],
    ["डेढ़ हज़ार", [1500]],
    ["dhai sau", [250]],
    ["पाँच सौ साठ", [560]],
    ["paanch sau saath", [560]],
    ["unnees sau", [1900]],
    ["८२६ वाला", [826]],
    ["do kilo cheeni aur ek tel", [2, 1]],
    ["cheeni and tel", []],
    ["", []],
  ];
  for (const [said, expected] of cases) {
    it(`"${said}" -> ${JSON.stringify(expected)}`, () => {
      expect(spokenAmountsInr(said)).toEqual(expected);
    });
  }

  it("does not treat object keys as numbers", () => {
    expect(spokenAmountsInr("constructor toString hundred")).toEqual([100]);
  });
});

describe("tag-auto binds by a spoken amount in words", () => {
  beforeEach(() => resetStore());

  async function pay(amountInr: number) {
    const r = (await handle({ action: "pay", amountInr })).result as { txn: { id: string } };
    return r.txn.id;
  }

  it("picks the payment whose amount was said in Hindi words", async () => {
    const a = await pay(826);
    await pay(560);
    const r = (await handle({ action: "tag-auto", transcript: "आठ सौ छब्बीस: दो किलो चीनी, एक तेल" }))
      .result as { outcome: string; txnId?: string; method?: string };
    expect(r).toMatchObject({ outcome: "bound", txnId: a, method: "amount" });
  });

  it("asks when two open payments have the spoken amount", async () => {
    await pay(826);
    await pay(826);
    const r = (await handle({ action: "tag-auto", transcript: "aath sau chhabbis, do kilo cheeni" }))
      .result as { outcome: string };
    expect(r.outcome).toBe("ambiguous");
  });

  it("asks when the spoken amount matches no open payment", async () => {
    await pay(826);
    await pay(560);
    const r = (await handle({ action: "tag-auto", transcript: "do kilo cheeni" })).result as { outcome: string };
    expect(r.outcome).toBe("ambiguous");
  });
});
