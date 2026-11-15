/**
 * Rupee amounts said aloud in a sale tag, so `tag-auto` can tell which open
 * payment the merchant means: "आठ सौ छब्बीस", "aath sau chhabbis",
 * "eight hundred twenty six", "826", "₹1,200", "डेढ़ हज़ार".
 *
 * It only lists the numbers it hears. Choosing a payment (and refusing to
 * guess when two match) is the caller's job.
 */

/** Hindi 1–99 in Devanagari, index = value. Irregular, so listed in full. */
const HI_DEVANAGARI = [
  "", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ", "नौ",
  "दस", "ग्यारह", "बारह", "तेरह", "चौदह", "पंद्रह", "सोलह", "सत्रह", "अठारह", "उन्नीस",
  "बीस", "इक्कीस", "बाईस", "तेईस", "चौबीस", "पच्चीस", "छब्बीस", "सत्ताईस", "अट्ठाईस", "उनतीस",
  "तीस", "इकतीस", "बत्तीस", "तैंतीस", "चौंतीस", "पैंतीस", "छत्तीस", "सैंतीस", "अड़तीस", "उनतालीस",
  "चालीस", "इकतालीस", "बयालीस", "तैंतालीस", "चौवालीस", "पैंतालीस", "छियालीस", "सैंतालीस", "अड़तालीस", "उनचास",
  "पचास", "इक्यावन", "बावन", "तिरेपन", "चौवन", "पचपन", "छप्पन", "सत्तावन", "अट्ठावन", "उनसठ",
  "साठ", "इकसठ", "बासठ", "तिरेसठ", "चौंसठ", "पैंसठ", "छियासठ", "सड़सठ", "अड़सठ", "उनहत्तर",
  "सत्तर", "इकहत्तर", "बहत्तर", "तिहत्तर", "चौहत्तर", "पचहत्तर", "छिहत्तर", "सतहत्तर", "अठहत्तर", "उन्यासी",
  "अस्सी", "इक्यासी", "बयासी", "तिरासी", "चौरासी", "पचासी", "छियासी", "सत्तासी", "अट्ठासी", "नवासी",
  "नब्बे", "इक्यानवे", "बानवे", "तिरानवे", "चौरानवे", "पचानवे", "छियानवे", "सत्तानवे", "अट्ठानवे", "निन्यानवे",
];

/** Hindi 1–99 romanised, index = value. Spelling varies, so input and keys both go through `roman()`. */
const HI_ROMAN = [
  "", "ek", "do", "teen", "char", "paanch", "chhah", "saat", "aath", "nau",
  "das", "gyarah", "barah", "terah", "chaudah", "pandrah", "solah", "satrah", "atharah", "unnees",
  "bees", "ikkees", "baees", "teis", "chaubees", "pachchees", "chhabbees", "sattaees", "atthaees", "untees",
  "tees", "iktees", "battees", "taintees", "chauntees", "paintees", "chhattees", "saintees", "adtees", "untalees",
  "chalees", "iktalees", "bayalees", "taintalees", "chauvalees", "paintalees", "chhiyalees", "saintalees", "adtalees", "unchaas",
  "pachaas", "ikyavan", "baavan", "tirepan", "chauvan", "pachpan", "chhappan", "sattavan", "atthavan", "unsath",
  "saath", "iksath", "baasath", "tiresath", "chaunsath", "painsath", "chhiyasath", "sadsath", "adsath", "unhattar",
  "sattar", "ikhattar", "bahattar", "tihattar", "chauhattar", "pachhattar", "chhihattar", "sathattar", "athhattar", "unyaasi",
  "assi", "ikyaasi", "bayaasi", "tiraasi", "chauraasi", "pachaasi", "chhiyaasi", "sattaasi", "atthaasi", "navaasi",
  "nabbe", "ikyaanve", "baanve", "tiraanve", "chauraanve", "pachaanve", "chhiyaanve", "sattaanve", "atthaanve", "ninyaanve",
];

/** Common alternative spellings not produced by `roman()` from the list above. */
const HI_ROMAN_EXTRA: Record<string, number> = {
  tin: 3, chaar: 4, panch: 5, chhe: 6, cheh: 6, chah: 6, dus: 10, gyara: 11, bara: 12,
  pandra: 15, sola: 16, satra: 17, athara: 18, unnis: 19, bis: 20, chhabis: 26, pachis: 25,
};

const EN_SMALL: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** Fractions that scale the next multiplier: "डेढ़ हज़ार" = 1500, "ढाई सौ" = 250. */
const FRACTIONS: Record<string, number> = {
  dedh: 1.5, "डेढ़": 1.5, "डेढ": 1.5, dhai: 2.5, "ढाई": 2.5,
};

const MULTIPLIERS: Record<string, number> = {
  sau: 100, "सौ": 100, hundred: 100,
  hazaar: 1000, hazar: 1000, "हज़ार": 1000, "हजार": 1000, thousand: 1000,
  lakh: 100_000, lac: 100_000, "लाख": 100_000,
};

/** Fold romanised spelling variants: aa/ee/oo, chh, w, doubled letters. */
function roman(word: string): string {
  return word
    .replace(/aa/g, "a")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/chh/g, "ch")
    .replace(/w/g, "v")
    .replace(/([a-z])\1+/g, "$1");
}

const SMALL = new Map<string, number>();
HI_DEVANAGARI.forEach((w, n) => n && SMALL.set(w, n));
SMALL.set("पांच", 5);
SMALL.set("छः", 6);
HI_ROMAN.forEach((w, n) => n && SMALL.set(roman(w), n));
for (const [w, n] of Object.entries(HI_ROMAN_EXTRA)) SMALL.set(roman(w), n);
for (const [w, n] of Object.entries(EN_SMALL)) SMALL.set(w, n);

type Token =
  | { kind: "small"; value: number }
  | { kind: "digits"; value: number }
  | { kind: "fraction"; value: number }
  | { kind: "multiplier"; value: number }
  | { kind: "and" }
  | { kind: "other" };

function token(word: string): Token {
  if (/^\d+(\.\d+)?$/.test(word)) return { kind: "digits", value: Number(word) };
  if (Object.hasOwn(MULTIPLIERS, word)) return { kind: "multiplier", value: MULTIPLIERS[word] };
  if (Object.hasOwn(FRACTIONS, word)) return { kind: "fraction", value: FRACTIONS[word] };
  if (word === "and") return { kind: "and" };
  const small = SMALL.get(word) ?? SMALL.get(roman(word));
  if (small !== undefined) return { kind: "small", value: small };
  return { kind: "other" };
}

/** Read one run of number words into values; a new run starts where the words stop adding up. */
function readRun(tokens: Token[]): number[] {
  const out: number[] = [];
  let total = 0; // thousands and lakhs already closed
  let current = 0; // hundreds part
  let small = 0; // the 1–99 part after the last multiplier
  let fraction: number | null = null;
  let any = false;

  const flush = () => {
    if (any) out.push(Math.round((total + current + small) * 100) / 100);
    total = current = small = 0;
    fraction = null;
    any = false;
  };

  tokens.forEach((t, i) => {
    switch (t.kind) {
      case "small":
      case "digits": {
        const v = t.value;
        // "twenty six" composes; "chhabbis do" (26, then a quantity of 2) does not.
        const composes = small === 0 || (small % 10 === 0 && small >= 20 && v < 10 && t.kind === "small");
        if (!composes) flush();
        small += v;
        any = true;
        break;
      }
      case "fraction":
        if (small || fraction !== null) flush();
        fraction = t.value;
        break;
      case "multiplier": {
        const base = fraction ?? (small || 1);
        fraction = null;
        if (t.value === 100) current += base * 100;
        else {
          total += (current + base) * t.value;
          current = 0;
        }
        small = 0;
        any = true;
        break;
      }
      case "and":
        // only inside a number: "two hundred and fifty"
        if (!(any && tokens[i + 1] && tokens[i + 1].kind !== "other")) flush();
        break;
      default:
        flush();
    }
  });
  flush();
  return out;
}

/** Devanagari digits to ASCII. */
function asciiDigits(text: string): string {
  return text.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
}

/**
 * Every rupee amount heard in the transcript, in order, without duplicates.
 * "aath sau chhabbis: do kilo cheeni" -> [826, 2]
 */
export function spokenAmountsInr(transcript: string): number[] {
  const text = asciiDigits(transcript.toLowerCase())
    .replace(/(\d),(?=\d)/g, "$1") // 1,200 and 1,00,000
    .replace(/₹|\brs\.?(?=\s|\d|$)|\binr\b/g, " ")
    .replace(/(\d)(?=[a-zऀ-ॿ])/g, "$1 ");
  const found: number[] = [];
  for (const segment of text.split(/[,;:।!?]|\.(?!\d)/)) {
    const words = segment.split(/\s+/).filter(Boolean);
    for (const n of readRun(words.map(token))) {
      if (n > 0 && !found.includes(n)) found.push(n);
    }
  }
  return found;
}
