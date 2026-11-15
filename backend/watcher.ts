import { z } from "zod";
import raw from "@rules/feeds.json";
import { allRules, getRule } from "./rules";

/**
 * Watches official feeds for news that may change a rule. It only flags:
 * a flagged rule is shown as "possibly changed, under review" until a person
 * reads the source and updates the rule's last_checked date in rules.json.
 * Nothing here writes to rules/.
 */

const feedsFileSchema = z.object({
  poll_minutes: z.number().positive(),
  feeds: z.array(z.object({ id: z.string(), name: z.string(), url: z.string().url() })),
  watch: z.array(
    z.object({ rules: z.array(z.string()).min(1), keywords: z.array(z.string().min(2)).min(1) }),
  ),
});

export type FeedsFile = z.infer<typeof feedsFileSchema>;

export function validateFeeds(input: unknown): FeedsFile {
  const parsed = feedsFileSchema.parse(input);
  for (const w of parsed.watch) {
    for (const id of w.rules) if (!getRule(id)) throw new Error(`feeds.json names unknown rule: ${id}`);
  }
  return parsed;
}

const config = validateFeeds(raw);

export type FeedItem = { title: string; link: string; published: string | null; text: string };

export type RuleAlert = {
  ruleId: string;
  feedId: string;
  feedName: string;
  title: string;
  link: string;
  published: string | null;
  keyword: string;
  seenAt: string;
};

// ---- parsing -------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);
}

/** Text of the first <tag>, with CDATA unwrapped, HTML stripped and entities decoded. */
function field(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return "";
  const inner = m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
  return decode(decode(inner).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function isoOrNull(date: string): string | null {
  const t = Date.parse(date);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** RSS 2.0 <item>s or Atom <entry>s. Small and forgiving; feeds are trusted sites but still just data. */
export function parseFeed(xml: string): FeedItem[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  return blocks.map((b) => {
    const atomLink = b.match(/<link[^>]*href="([^"]+)"/i)?.[1];
    return {
      title: field(b, "title"),
      link: (field(b, "link") || atomLink || "").trim(),
      published: isoOrNull(field(b, "pubDate") || field(b, "updated") || field(b, "published")),
      text: field(b, "description") || field(b, "summary") || field(b, "content"),
    };
  });
}

// ---- matching ------------------------------------------------------------

/**
 * Items that may affect a rule: they mention one of its keywords, and they
 * are newer than the day the rule was last checked. Undated items (PIB) only
 * count if they were not already in the feed on the watcher's first look.
 */
export function matchItems(
  feed: { id: string; name: string },
  items: FeedItem[],
  isNewUndated: (item: FeedItem) => boolean,
  seenAt: string,
  watch = config.watch,
): RuleAlert[] {
  const alerts: RuleAlert[] = [];
  for (const item of items) {
    const haystack = `${item.title} ${item.text}`.toLowerCase();
    for (const w of watch) {
      const keyword = w.keywords.find((k) => haystack.includes(k.toLowerCase()));
      if (!keyword) continue;
      for (const ruleId of w.rules) {
        const rule = getRule(ruleId);
        if (!rule) continue;
        const fresh = item.published
          ? !rule.last_checked || item.published.slice(0, 10) >= rule.last_checked
          : isNewUndated(item);
        if (!fresh) continue;
        alerts.push({
          ruleId,
          feedId: feed.id,
          feedName: feed.name,
          title: item.title,
          link: item.link,
          published: item.published,
          keyword,
          seenAt,
        });
      }
    }
  }
  return alerts;
}

// ---- state and polling ---------------------------------------------------

type FeedStatus = { ok: boolean; items: number; error?: string; checkedAt: string };

type WatchState = {
  alerts: RuleAlert[];
  feeds: Record<string, FeedStatus>;
  baseline: Record<string, Set<string>>; // undated item links seen on first look, per feed
  lastRun: string | null;
  timer: ReturnType<typeof setInterval> | null;
  running: Promise<void> | null;
};

const g = globalThis as typeof globalThis & { __kavachWatch?: WatchState };

function state(): WatchState {
  g.__kavachWatch ??= { alerts: [], feeds: {}, baseline: {}, lastRun: null, timer: null, running: null };
  return g.__kavachWatch;
}

const alertKey = (a: RuleAlert) => `${a.ruleId}|${a.link || a.title}`;

function addAlerts(found: RuleAlert[]) {
  const s = state();
  const known = new Set(s.alerts.map(alertKey));
  for (const a of found) {
    if (known.has(alertKey(a))) continue;
    s.alerts.push(a);
    known.add(alertKey(a));
  }
}

type Fetcher = (url: string) => Promise<string>;

const defaultFetch: Fetcher = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};

/** Poll every feed once. A failing feed is reported, never treated as "no change". */
export async function checkFeeds(fetcher: Fetcher = defaultFetch): Promise<void> {
  const s = state();
  if (s.running) return s.running;
  s.running = (async () => {
    const seenAt = new Date().toISOString();
    await Promise.all(
      config.feeds.map(async (feed) => {
        try {
          const items = parseFeed(await fetcher(feed.url));
          const firstLook = !s.baseline[feed.id];
          const base = (s.baseline[feed.id] ??= new Set());
          const isNewUndated = (item: FeedItem) => !firstLook && !base.has(item.link || item.title);
          addAlerts(matchItems(feed, items, isNewUndated, seenAt));
          for (const item of items) if (!item.published) base.add(item.link || item.title);
          s.feeds[feed.id] = { ok: true, items: items.length, checkedAt: seenAt };
        } catch (err) {
          s.feeds[feed.id] = {
            ok: false,
            items: 0,
            error: err instanceof Error ? err.message : String(err),
            checkedAt: seenAt,
          };
        }
      }),
    );
    s.lastRun = seenAt;
  })().finally(() => {
    s.running = null;
  });
  return s.running;
}

/** Start polling once per server process. Off in tests and when KAVACH_WATCH_FEEDS=0. */
export function ensureWatcher(): void {
  const s = state();
  if (s.timer || process.env.KAVACH_WATCH_FEEDS === "0" || process.env.VITEST) return;
  s.timer = setInterval(() => void checkFeeds(), config.poll_minutes * 60_000);
  s.timer.unref?.();
  void checkFeeds();
}

/**
 * Open alerts: those dated on or after their rule's last_checked date. Moving
 * last_checked past the item's date after reviewing the source clears it.
 */
export function openAlerts(): RuleAlert[] {
  return state().alerts.filter((a) => {
    const rule = getRule(a.ruleId);
    if (!rule) return false;
    if (!rule.last_checked) return true;
    // Same-day counts: an item from the day of the check may have come after it.
    return (a.published ?? a.seenAt).slice(0, 10) >= rule.last_checked;
  });
}

export function alertsByRule(): Record<string, RuleAlert[]> {
  const out: Record<string, RuleAlert[]> = {};
  for (const a of openAlerts()) (out[a.ruleId] ??= []).push(a);
  return out;
}

export function watchStatus() {
  const s = state();
  return {
    pollMinutes: config.poll_minutes,
    lastRun: s.lastRun,
    feeds: config.feeds.map((f) => ({ id: f.id, name: f.name, ...(s.feeds[f.id] ?? null) })),
    alertsByRule: alertsByRule(),
    rulesWatched: allRules().filter((r) => config.watch.some((w) => w.rules.includes(r.id))).length,
  };
}

/** Demo only: feed a sample item through the same matching path. */
export function injectDemoItem(item: FeedItem, feed = { id: "demo", name: "Demo feed (simulated)" }) {
  addAlerts(matchItems(feed, [item], () => true, new Date().toISOString()));
}

/** Demo reset: drop simulated alerts, keep real ones. */
export function clearDemoAlerts(): void {
  const s = state();
  s.alerts = s.alerts.filter((a) => a.feedId !== "demo");
}

/** Tests only: forget everything. */
export function resetWatcher(): void {
  const s = state();
  s.alerts = [];
  s.feeds = {};
  s.baseline = {};
  s.lastRun = null;
}
