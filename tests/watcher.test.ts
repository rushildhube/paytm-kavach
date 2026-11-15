import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { getRule } from "@backend/rules";
import {
  alertsByRule,
  checkFeeds,
  clearDemoAlerts,
  injectDemoItem,
  matchItems,
  parseFeed,
  resetWatcher,
  watchStatus,
} from "@backend/watcher";

const RSS = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>NOTIFICATIONS FROM RBI</title>
<item><title><![CDATA[Reserve Bank of India (Know Your Customer) Amendment Directions, 2026]]></title>
<link>https://rbi.org.in/Scripts/NotificationUser.aspx?Id=1</link>
<description><![CDATA[<p>Temporary Debit Hold on suspected money mule transactions &#8377;1000 &amp; above</p>]]></description>
<pubDate>Mon, 30 Nov 2026 17:00:00</pubDate></item>
<item><title><![CDATA[Auction of State Government Securities]]></title>
<link>https://rbi.org.in/x</link><description><![CDATA[<p>Nothing relevant</p>]]></description>
<pubDate>Fri, 13 Nov 2026 17:50:00</pubDate></item>
<item><title><![CDATA[Old note on money mule accounts]]></title>
<link>https://rbi.org.in/old</link><description>old</description>
<pubDate>Mon, 01 Jun 2026 10:00:00</pubDate></item>
</channel></rss>`;

const feed = { id: "rbi-notifications", name: "RBI notifications" };

beforeEach(() => resetWatcher());

describe("feed parsing", () => {
  it("reads RSS items with CDATA, HTML and entities", () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(3);
    expect(items[0].title).toBe("Reserve Bank of India (Know Your Customer) Amendment Directions, 2026");
    expect(items[0].text).toContain("₹1000 & above");
    expect(items[0].text).not.toContain("<p>");
    expect(items[0].published?.slice(0, 10)).toBe("2026-11-30");
  });

  it("reads Atom entries", () => {
    const atom = `<feed><entry><title>Digital arrest order</title><link href="https://x/1"/><updated>2026-12-01T00:00:00Z</updated><summary>s</summary></entry></feed>`;
    expect(parseFeed(atom)).toEqual([
      { title: "Digital arrest order", link: "https://x/1", published: "2026-12-01T00:00:00.000Z", text: "s" },
    ]);
  });

  it("returns nothing for a page that is not a feed", () => {
    expect(parseFeed("<html><body>Not a feed</body></html>")).toEqual([]);
  });
});

describe("matching items to rules", () => {
  it("flags only relevant items dated on or after the rule's last check", () => {
    const alerts = matchItems(feed, parseFeed(RSS), () => false, "2026-12-01T00:00:00Z");
    expect(alerts.map((a) => a.ruleId)).toEqual(["rbi-draft-bank-hold"]);
    expect(alerts[0].link).toContain("Id=1");
    // the June item mentions a keyword but predates the check
    expect(alerts.some((a) => a.link.endsWith("/old"))).toBe(false);
  });

  it("treats undated items as new only when the caller says so", () => {
    const undated = [{ title: "I4C launches grievance redressal module", link: "p1", published: null, text: "" }];
    expect(matchItems(feed, undated, () => false, "2026-12-01T00:00:00Z")).toEqual([]);
    expect(matchItems(feed, undated, () => true, "2026-12-01T00:00:00Z").length).toBeGreaterThan(0);
  });
});

describe("polling", () => {
  it("does not alert on undated items already in the feed at first look", async () => {
    const pib = `<rss><channel><item><title>Cyber fraud review by I4C</title><link>https://pib/1</link></item></channel></rss>`;
    const later = pib.replace("</channel>", `<item><title>New I4C cyber fraud SOP</title><link>https://pib/2</link></item></channel>`);
    await checkFeeds(async (url) => (url.includes("pib") ? pib : "<rss></rss>"));
    expect(Object.keys(alertsByRule())).toEqual([]);
    await checkFeeds(async (url) => (url.includes("pib") ? later : "<rss></rss>"));
    const flagged = Object.values(alertsByRule()).flat();
    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged.every((a) => a.link === "https://pib/2")).toBe(true);
  });

  it("reports a failing feed instead of treating it as no change", async () => {
    await checkFeeds(async () => {
      throw new Error("timeout");
    });
    const status = watchStatus();
    expect(status.feeds.every((f) => "ok" in f && f.ok === false)).toBe(true);
  });

  it("never writes to the rules folder", async () => {
    const dir = path.resolve(__dirname, "../rules");
    const before = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf8"));
    await checkFeeds(async () => RSS);
    injectDemoItem({ title: "money mule", link: "", published: null, text: "" });
    const after = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf8"));
    expect(after).toEqual(before);
    expect(getRule("rbi-draft-bank-hold")?.summary).toBeTruthy();
  });
});

describe("demo law change", () => {
  it("flags the RBI rule and reset clears only simulated alerts", async () => {
    await checkFeeds(async (url) => (url.includes("notifications") ? RSS : "<rss></rss>"));
    injectDemoItem({ title: "[Simulated] temporary debit hold", link: "", published: null, text: "" });
    expect(alertsByRule()["rbi-draft-bank-hold"].map((a) => a.feedId).sort()).toEqual(["demo", "rbi-notifications"]);
    clearDemoAlerts();
    expect(alertsByRule()["rbi-draft-bank-hold"].map((a) => a.feedId)).toEqual(["rbi-notifications"]);
  });
});
