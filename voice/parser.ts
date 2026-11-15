import type { SaleItem } from "@backend/types";

const NUMBERS: Record<string, number> = {
  ek: 1, एक: 1, one: 1,
  do: 2, दो: 2, two: 2,
  teen: 3, tin: 3, तीन: 3, three: 3,
  char: 4, chaar: 4, चार: 4, four: 4,
  paanch: 5, panch: 5, पांच: 5, पाँच: 5, five: 5,
  chhe: 6, cheh: 6, छह: 6, छः: 6, six: 6,
  saat: 7, सात: 7, seven: 7,
  aath: 8, आठ: 8, eight: 8,
  nau: 9, नौ: 9, nine: 9,
  das: 10, दस: 10, ten: 10,
  aadha: 0.5, adha: 0.5, आधा: 0.5, half: 0.5,
  dedh: 1.5, डेढ़: 1.5,
  dhai: 2.5, ढाई: 2.5,
};

const UNITS = new Set([
  "kilo", "kg", "किलो", "gram", "ग्राम", "litre", "liter", "लीटर",
  "packet", "पैकेट", "darjan", "dozen", "दर्जन", "piece", "पीस",
  "bottle", "बोतल", "dabba", "डिब्बा",
]);

function toNumber(word: string): number | null {
  if (/^\d+(\.\d+)?$/.test(word)) return Number(word);
  // Devanagari digits
  if (/^[०-९]+$/.test(word)) {
    return Number([...word].map((c) => c.charCodeAt(0) - 0x0966).join(""));
  }
  return NUMBERS[word] ?? null;
}

/**
 * Turn a short spoken sale description into items.
 * "do kilo cheeni, ek tel" -> [{cheeni, 2, kilo}, {tel, 1, null}]
 * The raw transcript is stored alongside, so a weak parse loses nothing.
 */
export function parseSaleItems(transcript: string): SaleItem[] {
  return transcript
    .toLowerCase()
    .replace(/[।.!?]/g, " ")
    .split(/,|\s+aur\s+|\s+और\s+|\s+and\s+/)
    .map((part) => part.trim().split(/\s+/).filter(Boolean))
    .filter((words) => words.length > 0)
    .map((words) => {
      let quantity: number | null = null;
      let unit: string | null = null;
      const rest: string[] = [];
      for (const w of words) {
        const n: number | null = quantity === null ? toNumber(w) : null;
        if (n !== null) quantity = n;
        else if (unit === null && UNITS.has(w)) unit = w;
        else rest.push(w);
      }
      return { name: rest.join(" "), quantity, unit };
    })
    .filter((item) => item.name.length > 0);
}
