/**
 * Soundbox voice per language (feat/voice-language, refs #15, #17).
 * No test reaches Sarvam: fetch is stubbed and the key is fake.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@backend/ratelimit";
import { announcePayment, PHRASES, phrasesFor, spokenAmount, spokenBill } from "@voice/announce";
import { spokenAmountsInr } from "@voice/amounts";
import { BRAND } from "@frontend/brand";
import { isVoiceLanguage, VOICE_LANGUAGES, type VoiceLanguage } from "@voice/languages";
import { textToSpeech, transcribe, ttsRequestBody, speechToText } from "@voice/sarvam";
import {
  BULBUL_V3_SPEAKERS,
  browserLang,
  parseLanguageField,
  SPEAKER_BY_LANGUAGE,
  TTS_CONTENT_TYPE,
  TTS_MODEL,
} from "@voice/voices";
import { POST as ttsPOST } from "@/app/api/voice/tts/route";
import { POST as sttPOST } from "@/app/api/voice/stt/route";

const LANGS = VOICE_LANGUAGES.map((l) => l.code) as VoiceLanguage[];

type Call = { url: string; init: RequestInit };
let calls: Call[];

beforeEach(() => {
  resetRateLimits();
  calls = [];
  vi.stubEnv("SARVAM_API_KEY", "test-key");
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (url.endsWith("/text-to-speech")) {
      return Response.json({ audios: [Buffer.from("ID3fake").toString("base64")] });
    }
    return Response.json({ transcript: " 2 किलो चीनी ₹826 ", language_code: "hi-IN" });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("announcement phrases", () => {
  it("has every phrase for every language the merchant can pick", () => {
    for (const lang of LANGS) {
      const p = PHRASES[lang];
      expect(p, lang).toBeDefined();
      for (const s of [p.ask, p.saved, p.choose, p.poweredOn, p.rupees, p.paise]) {
        expect(s.trim().length, lang).toBeGreaterThan(0);
      }
    }
  });

  it("says the amount as plain digits, no grouping commas", () => {
    for (const lang of LANGS) {
      const said = announcePayment({ amountInr: 1250 }, lang);
      expect(said, lang).toContain("1250");
      expect(said, lang).not.toMatch(/1,250/);
    }
    expect(announcePayment({ amountInr: 826 }, "hi-IN")).toBe(`${BRAND.spokenOn["hi-IN"]} 826 रुपये प्राप्त हुए।`);
    expect(announcePayment({ amountInr: 826 }, "en-IN")).toBe(`Received 826 rupees ${BRAND.spokenOn["en-IN"]}.`);
  });

  it("names the demo brand from brand.ts in every language, never a real payments company", () => {
    for (const lang of LANGS) {
      const said = announcePayment({ amountInr: 826 }, lang);
      expect(said, lang).toContain(BRAND.spokenOn[lang]);
      expect(said, lang).not.toMatch(/paytm|पेटीएम|পেটিএম|પેટીએમ|ಪೇಟಿಎಂ|പേടിഎ|ପେଟିଏମ|ਪੇਟੀਐਮ|பேடிஎம்|పేటీఎం/i);
    }
  });

  it("reads paise separately and never invents them", () => {
    expect(spokenAmount(826.5, "hi-IN")).toBe("826 रुपये 50 पैसे");
    expect(spokenAmount(826, "hi-IN")).toBe("826 रुपये");
    expect(spokenAmount(0.1 + 0.2, "en-IN")).toBe("0 rupees 30 paise");
  });

  it("adds 'bill paid' only for a bill payment, speaking the bill number", () => {
    expect(spokenBill("BILL-0007")).toBe("7");
    const said = announcePayment({ amountInr: 300, billId: "BILL-0007" }, "hi-IN");
    expect(said).toContain("300 रुपये");
    expect(said).toContain("बिल नंबर 7");
    expect(announcePayment({ amountInr: 300, billId: null }, "hi-IN")).not.toContain("बिल");
  });

  it("the amount said in Hindi or English is the amount tag-auto hears back", () => {
    for (const lang of ["hi-IN", "en-IN"] as const) {
      expect(spokenAmountsInr(announcePayment({ amountInr: 826 }, lang))).toContain(826);
    }
  });

  it("falls back to Hindi for an unknown language", () => {
    expect(phrasesFor("xx-IN" as VoiceLanguage)).toBe(PHRASES["hi-IN"]);
  });
});

describe("language validation", () => {
  it("accepts the 11 Sarvam languages only", () => {
    expect(LANGS).toHaveLength(11);
    for (const l of LANGS) expect(isVoiceLanguage(l)).toBe(true);
    for (const bad of ["hi", "HI-IN", "fr-FR", "unknown", "", null, 3]) {
      expect(isVoiceLanguage(bad)).toBe(false);
    }
  });

  it("defaults a missing language and rejects a wrong one", () => {
    expect(parseLanguageField(undefined)).toBe("hi-IN");
    expect(parseLanguageField(null)).toBe("hi-IN");
    expect(parseLanguageField("ta-IN")).toBe("ta-IN");
    expect(parseLanguageField("xx-IN")).toBeNull();
  });

  it("gives every language a bulbul:v3 short-name speaker, never a v4 persona", () => {
    for (const l of LANGS) {
      const s = SPEAKER_BY_LANGUAGE[l];
      expect(BULBUL_V3_SPEAKERS, l).toContain(s);
      expect(s, l).not.toContain("_");
    }
    // bulbul:v4-flash has no Malayalam or Odia; these must stay on v3.
    expect(TTS_MODEL).toBe("bulbul:v3");
  });

  it("maps Odia to the browser's BCP-47 tag", () => {
    expect(browserLang("od-IN")).toBe("or-IN");
    expect(browserLang("ta-IN")).toBe("ta-IN");
  });
});

describe("Sarvam request bodies", () => {
  it("text to speech sends the language, its speaker, pace and mp3", async () => {
    const audio = await textToSpeech("பேடிஎம்மில் 826 ரூபாய் பெறப்பட்டது.", "ta-IN");
    expect(audio.toString()).toBe("ID3fake");
    expect(calls[0].url).toBe("https://api.sarvam.ai/text-to-speech");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toEqual({
      text: "பேடிஎம்மில் 826 ரூபாய் பெறப்பட்டது.",
      language_code: "ta-IN",
      model: "bulbul:v3",
      speaker: "ishita",
      pace: 1.1,
      output_audio_codec: "mp3",
    });
    expect((calls[0].init.headers as Record<string, string>)["api-subscription-key"]).toBe("test-key");
  });

  it("keeps Hindi on the rehearsed voice and caps text length", () => {
    const body = ttsRequestBody("x".repeat(3000), "hi-IN");
    expect(body.speaker).toBe("priya");
    expect(body.text).toHaveLength(2500);
  });

  it("speech to text sends the merchant language, or unknown to auto-detect", async () => {
    const clip = new Blob([new Uint8Array(8)], { type: "audio/webm;codecs=opus" });
    expect(await transcribe(clip, "mr-IN")).toEqual({ transcript: "2 किलो चीनी ₹826", languageCode: "hi-IN" });
    await speechToText(clip, "unknown");
    const first = calls[0].init.body as FormData;
    expect(first.get("language_code")).toBe("mr-IN");
    expect(first.get("model")).toBe("saaras:v4");
    expect((first.get("file") as File).type).toBe("audio/webm");
    expect((calls[1].init.body as FormData).get("language_code")).toBe("unknown");
  });
});

describe("voice routes", () => {
  const ttsReq = (body: unknown) =>
    new Request("http://localhost/api/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const sttReq = (language?: string) => {
    const form = new FormData();
    form.append("audio", new Blob([new Uint8Array(16)], { type: "audio/webm" }), "sale.webm");
    if (language !== undefined) form.append("language", language);
    return new Request("http://localhost/api/voice/stt", { method: "POST", body: form });
  };

  it("TTS route speaks in the requested language and returns mp3", async () => {
    const res = await ttsPOST(ttsReq({ text: "Received 826 rupees.", language: "en-IN" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(TTS_CONTENT_TYPE);
    expect(JSON.parse(String(calls[0].init.body)).language_code).toBe("en-IN");
  });

  it("TTS route defaults to Hindi for older callers and refuses an unknown language", async () => {
    await ttsPOST(ttsReq({ text: "नमस्ते" }));
    expect(JSON.parse(String(calls[0].init.body)).language_code).toBe("hi-IN");
    const bad = await ttsPOST(ttsReq({ text: "hello", language: "fr-FR" }));
    expect(bad.status).toBe(400);
    expect(calls).toHaveLength(1);
  });

  it("TTS route never lets the client pick the speaker", async () => {
    await ttsPOST(ttsReq({ text: "hello", language: "en-IN", speaker: "varun" }));
    expect(JSON.parse(String(calls[0].init.body)).speaker).toBe("ishita");
  });

  it("STT route passes the language through, maps auto, and refuses junk", async () => {
    const ok = await sttPOST(sttReq("te-IN"));
    expect(await ok.json()).toEqual({ transcript: "2 किलो चीनी ₹826", languageCode: "hi-IN" });
    expect((calls[0].init.body as FormData).get("language_code")).toBe("te-IN");
    await sttPOST(sttReq("auto"));
    expect((calls[1].init.body as FormData).get("language_code")).toBe("unknown");
    await sttPOST(sttReq());
    expect((calls[2].init.body as FormData).get("language_code")).toBe("hi-IN");
    const bad = await sttPOST(sttReq("unknown-lang"));
    expect(bad.status).toBe(400);
    expect(calls).toHaveLength(3);
  });

  it("returns 503 without a key and never calls out", async () => {
    vi.stubEnv("SARVAM_API_KEY", "");
    const res = await ttsPOST(ttsReq({ text: "hello", language: "en-IN" }));
    expect(res.status).toBe(503);
    expect(calls).toHaveLength(0);
  });
});
