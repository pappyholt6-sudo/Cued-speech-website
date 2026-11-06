// Text → phonemes (ARPAbet) for General American English.
// 1) CMU Pronouncing Dictionary (common-word subset)  2) morphological derivation  3) letter-to-sound rules.
import { CODE_CHARS, DICT_DATA, PHONEME_CODES } from "../data/cmudict";
import { buildCues, type Cue } from "./cuedSpeech";

export type WordSource = "dictionary" | "derived" | "guess" | "spelled";

export interface CuedWord {
  display: string;
  phonemes: string[];
  cues: Cue[];
  source: WordSource;
  sentenceEnd: boolean;
  question: boolean;
}

// ---------------------------------------------------------------- dictionary
let dict: Map<string, string> | null = null;
const CODE_TO_PH: Record<string, string> = {};
for (let i = 0; i < CODE_CHARS.length; i++) CODE_TO_PH[CODE_CHARS[i]] = PHONEME_CODES[i];

function getDict(): Map<string, string> {
  if (dict) return dict;
  const m = new Map<string, string>();
  const parts = DICT_DATA.split(" ");
  for (let i = 0; i + 1 < parts.length; i += 2) m.set(parts[i], parts[i + 1]);
  dict = m;
  return m;
}

export function lookup(word: string): string[] | null {
  const code = getDict().get(word);
  if (!code) return null;
  const out: string[] = [];
  for (const ch of code) out.push(CODE_TO_PH[ch]);
  return out;
}

/** Warm the dictionary (parsing takes a few ms). */
export function preloadDictionary() {
  getDict();
}

// ---------------------------------------------------------------- numbers
const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function under1000(n: number): string[] {
  const out: string[] = [];
  if (n >= 100) {
    out.push(ONES[Math.floor(n / 100)], "hundred");
    n %= 100;
  }
  if (n >= 20) {
    out.push(TENS[Math.floor(n / 10)]);
    n %= 10;
    if (n) out.push(ONES[n]);
  } else if (n > 0) out.push(ONES[n]);
  return out;
}

export function numberToWords(n: number): string[] {
  if (!isFinite(n)) return [];
  if (n === 0) return ["zero"];
  const out: string[] = [];
  const scales: [number, string][] = [
    [1e12, "trillion"],
    [1e9, "billion"],
    [1e6, "million"],
    [1e3, "thousand"],
  ];
  for (const [v, name] of scales) {
    if (n >= v) {
      out.push(...under1000(Math.floor(n / v)), name);
      n %= v;
    }
  }
  if (n > 0) out.push(...under1000(n));
  return out;
}

function yearToWords(n: number): string[] {
  const hi = Math.floor(n / 100);
  const lo = n % 100;
  const first = under1000(hi);
  if (lo === 0) return [...first, "hundred"];
  if (lo < 10) return [...first, "oh", ONES[lo]];
  return [...first, ...under1000(lo)];
}

const ORDINAL_IRREGULAR: Record<string, string> = {
  one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth",
};
function toOrdinal(word: string): string {
  if (ORDINAL_IRREGULAR[word]) return ORDINAL_IRREGULAR[word];
  if (word.endsWith("y")) return word.slice(0, -1) + "ieth";
  return word + "th";
}

export function numberTokenToWords(tok: string): string[] {
  let t = tok;
  const suffix: string[] = [];
  let ordinal = false;
  if (t.startsWith("$")) {
    t = t.slice(1);
    suffix.push("dollars");
  }
  if (t.endsWith("%")) {
    t = t.slice(0, -1);
    suffix.push("percent");
  }
  const ord = t.match(/(st|nd|rd|th)$/i);
  if (ord) {
    t = t.slice(0, -2);
    ordinal = true;
  }
  const hadComma = t.includes(",");
  const [intPart, decPart] = t.replace(/,/g, "").split(".");
  const n = parseInt(intPart || "0", 10);
  let words: string[];
  if (!hadComma && !decPart && !suffix.length && !ordinal && intPart.length === 4 && ((n >= 1100 && n <= 1999) || (n >= 2010 && n <= 2099))) {
    words = yearToWords(n);
  } else if (intPart.length > 15) {
    words = [...intPart].map((d) => ONES[+d]);
  } else {
    words = numberToWords(n);
  }
  if (ordinal && words.length) words[words.length - 1] = toOrdinal(words[words.length - 1]);
  if (decPart) words.push("point", ...[...decPart].map((d) => ONES[+d]));
  if (suffix[0] === "dollars" && n === 1 && !decPart) suffix[0] = "dollar";
  return [...words, ...suffix];
}

// ---------------------------------------------------------------- letters & abbreviations
const LETTERS: Record<string, string[]> = {
  a: ["EY"], b: ["B", "IY"], c: ["S", "IY"], d: ["D", "IY"], e: ["IY"], f: ["EH", "F"], g: ["JH", "IY"],
  h: ["EY", "CH"], i: ["AY"], j: ["JH", "EY"], k: ["K", "EY"], l: ["EH", "L"], m: ["EH", "M"], n: ["EH", "N"],
  o: ["OW"], p: ["P", "IY"], q: ["K", "Y", "UW"], r: ["AA", "R"], s: ["EH", "S"], t: ["T", "IY"], u: ["Y", "UW"],
  v: ["V", "IY"], w: ["D", "AH", "B", "AH", "L", "Y", "UW"], x: ["EH", "K", "S"], y: ["W", "AY"], z: ["Z", "IY"],
};

const ABBREV: Record<string, string[]> = {
  mr: ["mister"], mrs: ["missus"], ms: ["miz"], dr: ["doctor"], vs: ["versus"], etc: ["et", "cetera"],
  ok: ["okay"], st: ["street"], ave: ["avenue"], jr: ["junior"], sr: ["senior"], approx: ["approximately"],
  lol: ["l", "o", "l"], btw: ["by", "the", "way"], omg: ["oh", "my", "gosh"], asap: ["a", "s", "a", "p"],
};

const SYMBOLS: Record<string, string[]> = { "&": ["and"], "@": ["at"], "+": ["plus"], "=": ["equals"], "%": ["percent"] };

// ---------------------------------------------------------------- morphology
const VOICELESS = new Set(["P", "T", "K", "F", "TH", "S", "SH", "CH"]);

function addPlural(base: string[]): string[] {
  const last = base[base.length - 1];
  if (["S", "Z", "SH", "ZH", "CH", "JH"].includes(last)) return [...base, "IH", "Z"];
  if (["P", "T", "K", "F", "TH"].includes(last)) return [...base, "S"];
  return [...base, "Z"];
}

function addPast(base: string[]): string[] {
  const last = base[base.length - 1];
  if (last === "T" || last === "D") return [...base, "IH", "D"];
  if (VOICELESS.has(last)) return [...base, "T"];
  return [...base, "D"];
}

function stemLookup(stem: string): string[] | null {
  if (stem.length < 2) return null;
  return (
    lookup(stem) ||
    lookup(stem + "e") ||
    (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2] ? lookup(stem.slice(0, -1)) : null)
  );
}

function derive(w: string): string[] | null {
  let b: string[] | null;
  if (w.endsWith("'s") && (b = lookup(w.slice(0, -2)))) return addPlural(b);
  if (w.endsWith("s'") && (b = lookup(w.slice(0, -1)))) return b;
  if (w.includes("'") && (b = lookup(w.replace(/'/g, "")))) return b;
  if (w.endsWith("ies") && (b = lookup(w.slice(0, -3) + "y"))) return addPlural(b);
  if (w.endsWith("es") && (b = lookup(w.slice(0, -2)))) return addPlural(b);
  if (w.endsWith("s") && !w.endsWith("ss") && (b = lookup(w.slice(0, -1)))) return addPlural(b);
  if (w.endsWith("ied") && (b = lookup(w.slice(0, -3) + "y"))) return addPast(b);
  if (w.endsWith("ed") && (b = stemLookup(w.slice(0, -2)))) return addPast(b);
  if (w.endsWith("ing") && (b = stemLookup(w.slice(0, -3)))) return [...b, "IH", "NG"];
  const SUFFIXES: [string, string[]][] = [
    ["ly", ["L", "IY"]], ["ness", ["N", "AH", "S"]], ["ful", ["F", "AH", "L"]], ["less", ["L", "AH", "S"]],
    ["ment", ["M", "AH", "N", "T"]], ["ers", ["ER", "Z"]], ["er", ["ER"]], ["est", ["AH", "S", "T"]],
    ["ish", ["IH", "SH"]], ["able", ["AH", "B", "AH", "L"]], ["y", ["IY"]],
  ];
  for (const [suf, ph] of SUFFIXES) {
    if (w.endsWith(suf) && w.length > suf.length + 2 && (b = stemLookup(w.slice(0, -suf.length)))) return [...b, ...ph];
  }
  const PREFIXES: [string, string[]][] = [
    ["un", ["AH", "N"]], ["re", ["R", "IY"]], ["pre", ["P", "R", "IY"]], ["dis", ["D", "IH", "S"]],
    ["mis", ["M", "IH", "S"]], ["non", ["N", "AA", "N"]], ["over", ["OW", "V", "ER"]], ["out", ["AW", "T"]],
    ["super", ["S", "UW", "P", "ER"]], ["anti", ["AE", "N", "T", "IY"]],
  ];
  for (const [pre, ph] of PREFIXES) {
    if (w.startsWith(pre) && w.length > pre.length + 2 && (b = lookup(w.slice(pre.length)))) return [...ph, ...b];
  }
  // compound words ("sunflower" → sun + flower)
  for (let k = w.length - 3; k >= 3; k--) {
    const a = lookup(w.slice(0, k));
    if (!a) continue;
    const c = lookup(w.slice(k));
    if (c) return [...a, ...c];
  }
  return null;
}

// ---------------------------------------------------------------- letter-to-sound fallback
export function letterToSound(raw: string): string[] {
  const w = raw.toLowerCase().replace(/[^a-z]/g, "");
  const n = w.length;
  const out: string[] = [];
  if (!n) return out;
  const isV = (c?: string) => c !== undefined && "aeiou".includes(c);
  const isCons = (c?: string) => c !== undefined && "bcdfghjklmnpqrstvwxz".includes(c);
  const vowelGroups = (w.match(/[aeiouy]+/g) || []).length;
  const has = (s: string, k: number) => w.startsWith(s, k);
  const atEnd = (k: number, len: number) => k + len === n;

  // vowel + single consonant + silent e ("make", "theme", "time", "home", "cute")
  const magicE = (k: number) => {
    const c = w[k + 1];
    if (!isCons(c) || c === "x" || c === "w") return false;
    if (w[k + 2] !== "e") return false;
    return ["", "s", "d", "ly", "r", "n", "ment", "ful", "less", "ness", "st"].includes(w.slice(k + 3));
  };
  const silentFinalE = (k: number) => atEnd(k, 1) && k >= 2 && /[aeiouy]/.test(w.slice(0, k - 1));
  // unstressed vowel in a final syllable ("-en", "-el", "-an", "-on", "-um")
  const reduced = (k: number) => vowelGroups > 1 && k > 0 && /^[aeiou][nlm]s?$/.test(w.slice(k));

  const SIMPLE: Record<string, string> = {
    b: "B", d: "D", f: "F", j: "JH", k: "K", l: "L", m: "M", n: "N", p: "P", q: "K", r: "R", t: "T", v: "V", w: "W", z: "Z",
  };

  let i = 0;
  while (i < n) {
    const c = w[i];
    const next = w[i + 1];
    const rule = (len: number, ...ph: string[]) => {
      out.push(...ph);
      i += len;
      return true;
    };
    // ---- multi-letter patterns
    if (has("tion", i) && rule(4, "SH", "AH", "N")) continue;
    if (has("sion", i) && rule(4, isV(w[i - 1]) ? "ZH" : "SH", "AH", "N")) continue;
    if (has("cian", i) && rule(4, "SH", "AH", "N")) continue;
    if ((has("cious", i) || has("tious", i)) && rule(5, "SH", "AH", "S")) continue;
    if ((has("cial", i) || has("tial", i)) && rule(4, "SH", "AH", "L")) continue;
    if (has("ture", i) && rule(4, "CH", "ER")) continue;
    if (has("ous", i) && atEnd(i, 3) && rule(3, "AH", "S")) continue;
    if (has("eigh", i) && rule(4, "EY")) continue;
    if (has("ough", i) && rule(4, "OW")) continue;
    if (has("augh", i) && rule(4, "AO")) continue;
    if (has("igh", i) && rule(3, "AY")) continue;
    if (has("tch", i) && rule(3, "CH")) continue;
    if (has("dge", i) && rule(3, "JH")) continue;
    if (has("sch", i) && rule(3, "S", "K")) continue;
    if (has("chr", i) && rule(3, "K", "R")) continue;
    if (has("ch", i) && rule(2, "CH")) continue;
    if (has("sh", i) && rule(2, "SH")) continue;
    if (has("th", i) && rule(2, "TH")) continue;
    if (has("ph", i) && rule(2, "F")) continue;
    if (has("wh", i) && rule(2, "W")) continue;
    if (has("ck", i) && rule(2, "K")) continue;
    if (has("gh", i)) {
      if (i === 0) out.push("G");
      i += 2;
      continue;
    }
    if (i === 0 && (has("kn", 0) || has("gn", 0)) && rule(2, "N")) continue;
    if (i === 0 && has("wr", 0) && rule(2, "R")) continue;
    if (i === 0 && has("ps", 0) && rule(2, "S")) continue;
    if (has("gn", i) && atEnd(i, 2) && rule(2, "N")) continue;
    if (has("mb", i) && atEnd(i, 2) && rule(2, "M")) continue;
    if (has("ng", i)) {
      if ("eiy".includes(w[i + 2] ?? "#")) out.push("N", "JH");
      else out.push("NG");
      i += 2;
      if (w[i] === "e" && silentFinalE(i)) i++;
      continue;
    }
    if (has("nk", i) && rule(2, "NG", "K")) continue;
    if (has("qu", i) && rule(2, "K", "W")) continue;
    // ---- vowel teams
    if ((has("air", i) || (has("are", i) && atEnd(i, 3))) && rule(3, "EH", "R")) continue;
    if ((has("ear", i) || has("eer", i)) && rule(3, "IH", "R")) continue;
    if (has("our", i) && rule(3, "AW", "ER")) continue;
    if ((has("oor", i) || (has("ore", i) && atEnd(i, 3))) && rule(3, "AO", "R")) continue;
    if (has("ire", i) && atEnd(i, 3) && rule(3, "AY", "ER")) continue;
    if (has("ure", i) && atEnd(i, 3) && rule(3, "UH", "R")) continue;
    if (has("eau", i) && rule(3, "OW")) continue;
    if (has("ould", i) && rule(3, "UH")) continue;
    if ((has("ook", i) || has("ood", i)) && rule(2, "UH")) continue;
    if ((has("ai", i) || has("ay", i)) && rule(2, "EY")) continue;
    if ((has("au", i) || has("aw", i)) && rule(2, "AO")) continue;
    if ((has("ee", i) || has("ea", i)) && rule(2, "IY")) continue;
    if (has("ei", i) && rule(2, "EY")) continue;
    if (has("ey", i) && rule(2, atEnd(i, 2) ? "IY" : "EY")) continue;
    if (has("eu", i) || has("ew", i)) {
      if (i === 0) out.push("Y");
      out.push("UW");
      i += 2;
      continue;
    }
    if (has("ie", i) && rule(2, atEnd(i, 2) && n <= 4 ? "AY" : "IY")) continue;
    if (has("oa", i) && rule(2, "OW")) continue;
    if (has("oe", i) && atEnd(i, 2) && rule(2, "OW")) continue;
    if ((has("oi", i) || has("oy", i)) && rule(2, "OY")) continue;
    if (has("oo", i) && rule(2, "UW")) continue;
    if (has("ou", i) && rule(2, "AW")) continue;
    if (has("ow", i) && rule(2, atEnd(i, 2) ? "OW" : "AW")) continue;
    if ((has("ue", i) || has("ui", i)) && rule(2, "UW")) continue;
    if (has("uy", i) && rule(2, "AY")) continue;
    if (has("ar", i) && !isV(w[i + 2]) && rule(2, "AA", "R")) continue;
    if ((has("er", i) || has("ir", i) || has("ur", i)) && !isV(w[i + 2]) && rule(2, "ER")) continue;
    if (has("or", i) && !isV(w[i + 2])) {
      if (atEnd(i, 2) && vowelGroups > 1) out.push("ER");
      else out.push("AO", "R");
      i += 2;
      continue;
    }
    if (has("all", i) && rule(3, "AO", "L")) continue;
    if (has("alk", i) && rule(3, "AO", "K")) continue;
    if (has("ind", i) && atEnd(i, 3) && rule(3, "AY", "N", "D")) continue;
    if (has("ild", i) && atEnd(i, 3) && rule(3, "AY", "L", "D")) continue;
    if (has("old", i) && rule(3, "OW", "L", "D")) continue;
    if (has("le", i) && atEnd(i, 2) && isCons(w[i - 1]) && i > 1 && rule(2, "AH", "L")) continue;

    // ---- single letters
    switch (c) {
      case "a":
        out.push(magicE(i) ? "EY" : atEnd(i, 1) ? "AH" : reduced(i) ? "AH" : "AE");
        break;
      case "e": {
        if (atEnd(i, 1)) {
          if (!silentFinalE(i)) out.push("IY");
          break;
        }
        if (atEnd(i, 2) && next === "s" && i > 1) {
          const p = w[i - 1];
          const pp = w.slice(i - 2, i);
          if ("szxcg".includes(p) || pp === "sh" || pp === "ch") out.push("IH");
          break;
        }
        if (atEnd(i, 2) && next === "d" && i > 1) {
          if ("td".includes(w[i - 1])) out.push("IH");
          break;
        }
        out.push(magicE(i) ? "IY" : isV(next) ? "IY" : reduced(i) ? "AH" : "EH");
        break;
      }
      case "i":
        out.push(magicE(i) ? "AY" : atEnd(i, 1) ? "IY" : isV(next) ? "IY" : "IH");
        break;
      case "o":
        out.push(magicE(i) ? "OW" : atEnd(i, 1) ? "OW" : isV(next) ? "OW" : reduced(i) ? "AH" : "AA");
        break;
      case "u":
        out.push(magicE(i) ? "UW" : atEnd(i, 1) ? "UW" : isV(next) ? "UW" : "AH");
        break;
      case "y":
        if (i === 0 || isV(next)) out.push("Y");
        else if (atEnd(i, 1)) out.push(vowelGroups > 1 ? "IY" : "AY");
        else out.push(magicE(i) ? "AY" : "IH");
        break;
      case "c":
        if (next === "c") {
          out.push("K");
          if ("eiy".includes(w[i + 2] ?? "#")) out.push("S");
          i++;
        } else out.push("eiy".includes(next ?? "#") ? "S" : "K");
        break;
      case "g":
        out.push(i > 0 && "eiy".includes(next ?? "#") ? "JH" : "G");
        break;
      case "s":
        if (next === "s") {
          out.push("S");
          i++;
        } else if (atEnd(i, 1)) {
          const lp = out[out.length - 1];
          const prevLetter = w[i - 1];
          out.push(lp && VOICELESS.has(lp) ? "S" : isV(prevLetter) && prevLetter !== "e" ? "S" : "Z");
        } else if (isV(w[i - 1]) && w[i + 1] === "e" && silentFinalE(i + 1)) out.push("Z");
        else out.push("S");
        break;
      case "x":
        out.push(...(i === 0 ? ["Z"] : ["K", "S"]));
        break;
      case "h":
        if (i === 0 || isV(next)) out.push("HH");
        break;
      case "d": {
        const lp = out[out.length - 1];
        if (atEnd(i, 1) && w[i - 1] === "e" && i > 2 && !"td".includes(w[i - 2]) && lp && VOICELESS.has(lp)) out.push("T");
        else out.push("D");
        break;
      }
      default:
        if (SIMPLE[c]) out.push(SIMPLE[c]);
    }
    // doubled consonants ("ll", "tt", ...)
    if (isCons(c) && c !== "c" && c !== "s" && w[i + 1] === c) i++;
    i++;
  }
  return out.filter((p, k) => p && p !== out[k - 1]);
}

// ---------------------------------------------------------------- public API
function pronounce(word: string): { phonemes: string[]; source: WordSource } {
  const direct = lookup(word);
  if (direct) return { phonemes: direct, source: "dictionary" };
  const d = derive(word);
  if (d) return { phonemes: d, source: "derived" };
  if (word.length === 1 && LETTERS[word]) return { phonemes: LETTERS[word], source: "spelled" };
  return { phonemes: letterToSound(word), source: "guess" };
}

const TOKEN_RE = /\$?\d[\d,]*(?:\.\d+)?(?:%|st|nd|rd|th)?|[A-Za-z]+(?:'[A-Za-z]+)*|[&@+=%]|[.!?]+/g;

/** Analyze free text into cued words. */
export function analyzeText(text: string): CuedWord[] {
  const words: CuedWord[] = [];
  const clean = text.replace(/[\u2018\u2019\u02bc]/g, "'");
  const PERIOD_ABBREV = new Set(["mr", "mrs", "ms", "dr", "st", "jr", "sr", "vs", "approx", "ave"]);
  let afterAbbrev = false;
  for (const m of clean.matchAll(TOKEN_RE)) {
    const tok = m[0];
    const wasAbbrev = afterAbbrev;
    afterAbbrev = PERIOD_ABBREV.has(tok.toLowerCase());
    if (/^[.!?]+$/.test(tok)) {
      if (tok === "." && wasAbbrev) continue;
      const last = words[words.length - 1];
      if (last) {
        last.sentenceEnd = true;
        if (tok.includes("?")) last.question = true;
      }
      continue;
    }
    let spoken: { display: string; word: string; spell?: boolean }[];
    const lower = tok.toLowerCase();
    if (/\d/.test(tok)) spoken = numberTokenToWords(tok).map((x) => ({ display: x, word: x }));
    else if (SYMBOLS[tok]) spoken = SYMBOLS[tok].map((x) => ({ display: x, word: x }));
    else if (ABBREV[lower] && !(lower === "us" || lower === "it")) spoken = ABBREV[lower].map((x) => ({ display: x.length === 1 ? x.toUpperCase() : x, word: x }));
    else if (/^[A-Z]{2,5}$/.test(tok) && !lookup(lower)) spoken = [...tok].map((ch) => ({ display: ch, word: ch.toLowerCase(), spell: true }));
    else spoken = [{ display: tok, word: lower }];

    for (const s of spoken) {
      const res = s.spell && LETTERS[s.word] ? { phonemes: LETTERS[s.word], source: "spelled" as WordSource } : pronounce(s.word);
      if (!res.phonemes.length) continue;
      words.push({
        display: s.display,
        phonemes: res.phonemes,
        cues: buildCues(res.phonemes),
        source: res.source,
        sentenceEnd: false,
        question: false,
      });
    }
  }
  return words;
}

export function phonemesToIpa(phonemes: string[], ipaOf: (p: string) => string): string {
  return phonemes.map(ipaOf).join("");
}
