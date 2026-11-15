import { BRAND } from "@frontend/brand";
import { DEFAULT_VOICE_LANGUAGE, type VoiceLanguage } from "./languages";

/**
 * What the Soundbox says, per language. The brand phrase ("on AITM")
 * comes from frontend/brand.ts. Modelled on the Paytm Soundbox
 * announcement ("Paytm par ₹826 prapt hue"); the exact wording of the real
 * device was not confirmed from a primary source. Non-Hindi phrases were
 * written for the demo and need a native speaker's check before a pitch.
 *
 * Amounts stay as digits: bulbul:v3 reads digits as number words in every
 * language (tested 2026-11-15, see voice/voices.ts). No thousands commas,
 * which some voices read digit by digit.
 */
type Phrases = {
  /** "Received ₹{amount} on {brand}". */
  received: (amount: string) => string;
  /** Word for paise, used when the amount has a fractional part. */
  paise: string;
  /** Word for rupees, between the rupee and paise figures. */
  rupees: string;
  /** "Bill {n} paid", for a payment against a merchant bill (already tagged). */
  billPaid: (bill: string) => string;
  /** Ask the shopkeeper what was sold. */
  ask: string;
  /** The tag was saved. */
  saved: string;
  /** Several payments are open and the amount did not settle it. */
  choose: string;
  /** Spoken once at power on. */
  poweredOn: string;
  /** A bill sent to the box: "please pay {amount}" plus "for {what}" when the merchant wrote what is sold. */
  payRequest: (amount: string, what: string) => string;
  /** Idle hint on the box's mic button: say the amount and what is sold to make a bill. */
  billHint: string;
};

export const PHRASES: Record<VoiceLanguage, Phrases> = {
  "hi-IN": {
    received: (a) => `${BRAND.spokenOn["hi-IN"]} ${a} प्राप्त हुए।`,
    rupees: "रुपये",
    paise: "पैसे",
    billPaid: (b) => `बिल नंबर ${b} का भुगतान हो गया।`,
    ask: "क्या बेचा? बोलकर बताइए।",
    saved: "बिक्री दर्ज हो गई।",
    choose: "कौन सा पेमेंट? स्क्रीन पर दबाइए।",
    poweredOn: "साउंडबॉक्स चालू है।",
    payRequest: (a, w) => `कृपया ${a} का भुगतान करें${w ? `, ${w} के लिए` : ""}। QR स्कैन कीजिए।`,
    billHint: "बोलकर बिल बनाइए: रक़म और सामान",
  },
  "en-IN": {
    received: (a) => `Received ${a} ${BRAND.spokenOn["en-IN"]}.`,
    rupees: "rupees",
    paise: "paise",
    billPaid: (b) => `Bill number ${b} is paid.`,
    ask: "What did you sell? Please say it.",
    saved: "Sale saved.",
    choose: "Which payment? Tap it on the screen.",
    poweredOn: "Soundbox is on.",
    payRequest: (a, w) => `Please pay ${a}${w ? ` for ${w}` : ""}. Scan the QR.`,
    billHint: "Make a bill by voice: amount and items",
  },
  "bn-IN": {
    received: (a) => `${BRAND.spokenOn["bn-IN"]} ${a} পাওয়া গেছে।`,
    rupees: "টাকা",
    paise: "পয়সা",
    billPaid: (b) => `বিল নম্বর ${b} পরিশোধ হয়েছে।`,
    ask: "কী বিক্রি করলেন? বলুন।",
    saved: "বিক্রি নথিভুক্ত হয়েছে।",
    choose: "কোন পেমেন্ট? স্ক্রিনে চাপুন।",
    poweredOn: "সাউন্ডবক্স চালু হয়েছে।",
    payRequest: (a, w) => `অনুগ্রহ করে ${a} দিন${w ? `, ${w}-এর জন্য` : ""}। QR স্ক্যান করুন।`,
    billHint: "বলে বিল বানান: টাকা আর জিনিস",
  },
  "gu-IN": {
    received: (a) => `${BRAND.spokenOn["gu-IN"]} ${a} મળ્યા.`,
    rupees: "રૂપિયા",
    paise: "પૈસા",
    billPaid: (b) => `બિલ નંબર ${b} ચૂકવાઈ ગયું.`,
    ask: "શું વેચ્યું? બોલીને કહો.",
    saved: "વેચાણ નોંધાઈ ગયું.",
    choose: "કયું પેમેન્ટ? સ્ક્રીન પર દબાવો.",
    poweredOn: "સાઉન્ડબોક્સ ચાલુ છે.",
    payRequest: (a, w) => `કૃપા કરીને ${a} ચૂકવો${w ? `, ${w} માટે` : ""}. QR સ્કેન કરો.`,
    billHint: "બોલીને બિલ બનાવો: રકમ અને સામાન",
  },
  "kn-IN": {
    received: (a) => `${BRAND.spokenOn["kn-IN"]} ${a} ಸ್ವೀಕರಿಸಲಾಗಿದೆ.`,
    rupees: "ರೂಪಾಯಿ",
    paise: "ಪೈಸೆ",
    billPaid: (b) => `ಬಿಲ್ ಸಂಖ್ಯೆ ${b} ಪಾವತಿಯಾಗಿದೆ.`,
    ask: "ಏನು ಮಾರಾಟ ಮಾಡಿದಿರಿ? ಹೇಳಿ.",
    saved: "ಮಾರಾಟ ದಾಖಲಾಗಿದೆ.",
    choose: "ಯಾವ ಪಾವತಿ? ಪರದೆಯ ಮೇಲೆ ಒತ್ತಿ.",
    poweredOn: "ಸೌಂಡ್‌ಬಾಕ್ಸ್ ಆನ್ ಆಗಿದೆ.",
    payRequest: (a, w) => `ದಯವಿಟ್ಟು ${a} ಪಾವತಿಸಿ${w ? `, ${w} ಗಾಗಿ` : ""}. QR ಸ್ಕ್ಯಾನ್ ಮಾಡಿ.`,
    billHint: "ಹೇಳಿ ಬಿಲ್ ಮಾಡಿ: ಮೊತ್ತ ಮತ್ತು ಸಾಮಾನು",
  },
  "ml-IN": {
    received: (a) => `${BRAND.spokenOn["ml-IN"]} ${a} ലഭിച്ചു.`,
    rupees: "രൂപ",
    paise: "പൈസ",
    billPaid: (b) => `ബിൽ നമ്പർ ${b} അടച്ചു.`,
    ask: "എന്താണ് വിറ്റത്? പറയൂ.",
    saved: "വിൽപ്പന രേഖപ്പെടുത്തി.",
    choose: "ഏത് പേയ്മെന്റ്? സ്ക്രീനിൽ അമർത്തൂ.",
    poweredOn: "സൗണ്ട്ബോക്സ് ഓണാണ്.",
    payRequest: (a, w) => `ദയവായി ${a} അടയ്ക്കുക${w ? `, ${w} ന്` : ""}. QR സ്കാൻ ചെയ്യുക.`,
    billHint: "പറഞ്ഞ് ബിൽ ഉണ്ടാക്കൂ: തുകയും സാധനങ്ങളും",
  },
  "mr-IN": {
    received: (a) => `${BRAND.spokenOn["mr-IN"]} ${a} मिळाले.`,
    rupees: "रुपये",
    paise: "पैसे",
    billPaid: (b) => `बिल क्रमांक ${b} भरले गेले.`,
    ask: "काय विकले? बोलून सांगा.",
    saved: "विक्री नोंदवली गेली.",
    choose: "कोणते पेमेंट? स्क्रीनवर दाबा.",
    poweredOn: "साउंडबॉक्स चालू आहे.",
    payRequest: (a, w) => `कृपया ${a} भरा${w ? `, ${w} साठी` : ""}. QR स्कॅन करा.`,
    billHint: "बोलून बिल बनवा: रक्कम आणि सामान",
  },
  "od-IN": {
    received: (a) => `${BRAND.spokenOn["od-IN"]} ${a} ମିଳିଲା।`,
    rupees: "ଟଙ୍କା",
    paise: "ପଇସା",
    billPaid: (b) => `ବିଲ ନମ୍ବର ${b} ପଇଠ ହେଲା।`,
    ask: "କଣ ବିକିଲେ? କୁହନ୍ତୁ।",
    saved: "ବିକ୍ରି ଲେଖାହେଲା।",
    choose: "କେଉଁ ପେମେଣ୍ଟ? ସ୍କ୍ରିନରେ ଦବାନ୍ତୁ।",
    poweredOn: "ସାଉଣ୍ଡବକ୍ସ ଚାଲୁ ଅଛି।",
    payRequest: (a, w) => `ଦୟାକରି ${a} ଦିଅନ୍ତୁ${w ? `, ${w} ପାଇଁ` : ""}। QR ସ୍କାନ କରନ୍ତୁ।`,
    billHint: "କହି ବିଲ କରନ୍ତୁ: ଟଙ୍କା ଓ ଜିନିଷ",
  },
  "pa-IN": {
    received: (a) => `${BRAND.spokenOn["pa-IN"]} ${a} ਪ੍ਰਾਪਤ ਹੋਏ।`,
    rupees: "ਰੁਪਏ",
    paise: "ਪੈਸੇ",
    billPaid: (b) => `ਬਿੱਲ ਨੰਬਰ ${b} ਦਾ ਭੁਗਤਾਨ ਹੋ ਗਿਆ।`,
    ask: "ਕੀ ਵੇਚਿਆ? ਬੋਲ ਕੇ ਦੱਸੋ।",
    saved: "ਵਿਕਰੀ ਦਰਜ ਹੋ ਗਈ।",
    choose: "ਕਿਹੜਾ ਪੇਮੈਂਟ? ਸਕ੍ਰੀਨ 'ਤੇ ਦਬਾਓ।",
    poweredOn: "ਸਾਊਂਡਬਾਕਸ ਚਾਲੂ ਹੈ।",
    payRequest: (a, w) => `ਕਿਰਪਾ ਕਰਕੇ ${a} ਦਾ ਭੁਗਤਾਨ ਕਰੋ${w ? `, ${w} ਲਈ` : ""}। QR ਸਕੈਨ ਕਰੋ।`,
    billHint: "ਬੋਲ ਕੇ ਬਿੱਲ ਬਣਾਓ: ਰਕਮ ਅਤੇ ਸਾਮਾਨ",
  },
  "ta-IN": {
    received: (a) => `${BRAND.spokenOn["ta-IN"]} ${a} பெறப்பட்டது.`,
    rupees: "ரூபாய்",
    paise: "பைசா",
    billPaid: (b) => `பில் எண் ${b} செலுத்தப்பட்டது.`,
    ask: "என்ன விற்றீர்கள்? சொல்லுங்கள்.",
    saved: "விற்பனை பதிவு செய்யப்பட்டது.",
    choose: "எந்த பணம்? திரையில் அழுத்தவும்.",
    poweredOn: "சவுண்ட்பாக்ஸ் இயங்குகிறது.",
    payRequest: (a, w) => `தயவுசெய்து ${a} செலுத்துங்கள்${w ? `, ${w} க்கு` : ""}. QR ஸ்கேன் செய்யுங்கள்.`,
    billHint: "சொல்லி பில் போடுங்கள்: தொகை, பொருட்கள்",
  },
  "te-IN": {
    received: (a) => `${BRAND.spokenOn["te-IN"]} ${a} అందాయి.`,
    rupees: "రూపాయలు",
    paise: "పైసలు",
    billPaid: (b) => `బిల్లు నంబర్ ${b} చెల్లించబడింది.`,
    ask: "ఏమి అమ్మారు? చెప్పండి.",
    saved: "అమ్మకం నమోదైంది.",
    choose: "ఏ చెల్లింపు? స్క్రీన్‌పై నొక్కండి.",
    poweredOn: "సౌండ్‌బాక్స్ ఆన్‌లో ఉంది.",
    payRequest: (a, w) => `దయచేసి ${a} చెల్లించండి${w ? `, ${w} కోసం` : ""}. QR స్కాన్ చేయండి.`,
    billHint: "చెప్పి బిల్లు చేయండి: మొత్తం, సరుకులు",
  },
};

/** Short status words shown (not spoken) on the Soundbox panel. */
type Status = { listening: string; understanding: string; saving: string };

export const STATUS: Record<VoiceLanguage, Status> = {
  "hi-IN": { listening: "सुन रहे हैं…", understanding: "समझ रहे हैं…", saving: "दर्ज कर रहे हैं…" },
  "en-IN": { listening: "Listening…", understanding: "Understanding…", saving: "Saving…" },
  "bn-IN": { listening: "শুনছি…", understanding: "বুঝছি…", saving: "সংরক্ষণ হচ্ছে…" },
  "gu-IN": { listening: "સાંભળી રહ્યા છીએ…", understanding: "સમજી રહ્યા છીએ…", saving: "નોંધી રહ્યા છીએ…" },
  "kn-IN": { listening: "ಕೇಳುತ್ತಿದೆ…", understanding: "ಅರ್ಥಮಾಡಿಕೊಳ್ಳುತ್ತಿದೆ…", saving: "ದಾಖಲಿಸುತ್ತಿದೆ…" },
  "ml-IN": { listening: "കേൾക്കുന്നു…", understanding: "മനസ്സിലാക്കുന്നു…", saving: "രേഖപ്പെടുത്തുന്നു…" },
  "mr-IN": { listening: "ऐकत आहे…", understanding: "समजत आहे…", saving: "नोंदवत आहे…" },
  "od-IN": { listening: "ଶୁଣୁଛି…", understanding: "ବୁଝୁଛି…", saving: "ଲେଖୁଛି…" },
  "pa-IN": { listening: "ਸੁਣ ਰਹੇ ਹਾਂ…", understanding: "ਸਮਝ ਰਹੇ ਹਾਂ…", saving: "ਦਰਜ ਕਰ ਰਹੇ ਹਾਂ…" },
  "ta-IN": { listening: "கேட்கிறது…", understanding: "புரிந்துகொள்கிறது…", saving: "பதிவு செய்கிறது…" },
  "te-IN": { listening: "వింటోంది…", understanding: "అర్థం చేసుకుంటోంది…", saving: "నమోదు చేస్తోంది…" },
};

export function statusFor(lang: VoiceLanguage): Status {
  return STATUS[lang] ?? STATUS[DEFAULT_VOICE_LANGUAGE];
}

export function phrasesFor(lang: VoiceLanguage): Phrases {
  return PHRASES[lang] ?? PHRASES[DEFAULT_VOICE_LANGUAGE];
}

/**
 * "826 रुपये", or "826 रुपये 50 पैसे" when there are paise. Digits only,
 * no grouping commas.
 */
export function spokenAmount(amountInr: number, lang: VoiceLanguage): string {
  const p = phrasesFor(lang);
  const totalPaise = Math.round(amountInr * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;
  const r = `${rupees} ${p.rupees}`;
  return paise ? `${r} ${paise} ${p.paise}` : r;
}

/** "BILL-0007" is spoken as "7". */
export function spokenBill(billId: string): string {
  const digits = billId.match(/\d+/)?.[0];
  return digits ? String(Number(digits)) : billId;
}

/** The payment announcement, with "bill paid" appended for a bill payment. */
export function announcePayment(
  payment: { amountInr: number; billId?: string | null },
  lang: VoiceLanguage,
): string {
  const p = phrasesFor(lang);
  const said = p.received(spokenAmount(payment.amountInr, lang));
  return payment.billId ? `${said} ${p.billPaid(spokenBill(payment.billId))}` : said;
}

/** "Please pay 826 rupees for two kilo atta…", for a bill sent to the box. */
export function announceRequest(request: { amountInr: number; text: string }, lang: VoiceLanguage): string {
  return phrasesFor(lang).payRequest(spokenAmount(request.amountInr, lang), request.text.trim());
}
