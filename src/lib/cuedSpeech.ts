// Core rules of American English Cued Speech.
// 8 handshapes represent consonant groups, placements (+ movements) represent vowel groups.
// Syllables are cued as consonant+vowel pairs: consonant handshape at the vowel's placement.

export type HandshapeId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type PlacementId = "side" | "mouth" | "chin" | "throat";
export type Movement = "none" | "forward" | "down" | "toThroat";
/** Finger extension 0 (curled) .. 1 (extended): thumb, index, middle, ring, pinky */
export type Fingers = [number, number, number, number, number];

export const VOWELS = new Set([
  "AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW",
]);
export const isVowel = (p: string) => VOWELS.has(p);

export interface PhonemeInfo {
  label: string;
  ipa: string;
  example: string;
}

export const PHONEMES: Record<string, PhonemeInfo> = {
  // consonants
  B: { label: "b", ipa: "b", example: "bat" },
  CH: { label: "ch", ipa: "tʃ", example: "chew" },
  D: { label: "d", ipa: "d", example: "dog" },
  DH: { label: "TH", ipa: "ð", example: "the" },
  F: { label: "f", ipa: "f", example: "fun" },
  G: { label: "g", ipa: "ɡ", example: "go" },
  HH: { label: "h", ipa: "h", example: "hat" },
  JH: { label: "j", ipa: "dʒ", example: "jeep" },
  K: { label: "k", ipa: "k", example: "kite" },
  L: { label: "l", ipa: "l", example: "look" },
  M: { label: "m", ipa: "m", example: "me" },
  N: { label: "n", ipa: "n", example: "no" },
  NG: { label: "ng", ipa: "ŋ", example: "sing" },
  P: { label: "p", ipa: "p", example: "pea" },
  R: { label: "r", ipa: "ɹ", example: "red" },
  S: { label: "s", ipa: "s", example: "see" },
  SH: { label: "sh", ipa: "ʃ", example: "she" },
  T: { label: "t", ipa: "t", example: "top" },
  TH: { label: "th", ipa: "θ", example: "thumb" },
  V: { label: "v", ipa: "v", example: "vine" },
  W: { label: "w", ipa: "w", example: "we" },
  WH: { label: "wh", ipa: "ʍ", example: "why" },
  Y: { label: "y", ipa: "j", example: "you" },
  Z: { label: "z", ipa: "z", example: "zoo" },
  ZH: { label: "zh", ipa: "ʒ", example: "measure" },
  // vowels
  AA: { label: "ah", ipa: "ɑ", example: "father" },
  AE: { label: "a", ipa: "æ", example: "cat" },
  AH: { label: "uh", ipa: "ʌ", example: "but" },
  AO: { label: "aw", ipa: "ɔ", example: "dog" },
  AW: { label: "ou", ipa: "aʊ", example: "cow" },
  AY: { label: "ie", ipa: "aɪ", example: "eye" },
  EH: { label: "e", ipa: "ɛ", example: "get" },
  ER: { label: "ur", ipa: "ɝ", example: "her" },
  EY: { label: "ay", ipa: "eɪ", example: "pay" },
  IH: { label: "i", ipa: "ɪ", example: "is" },
  IY: { label: "ee", ipa: "i", example: "see" },
  OW: { label: "oe", ipa: "oʊ", example: "home" },
  OY: { label: "oi", ipa: "ɔɪ", example: "boy" },
  UH: { label: "oo", ipa: "ʊ", example: "book" },
  UW: { label: "ue", ipa: "u", example: "blue" },
};

export interface HandshapeInfo {
  id: HandshapeId;
  name: string;
  fingers: Fingers;
  spread: number;
  consonants: string[];
  keywords: string;
}

export const HANDSHAPES: HandshapeInfo[] = [
  { id: 1, name: "Index finger", fingers: [0, 1, 0, 0, 0], spread: 0, consonants: ["D", "P", "ZH"], keywords: "deep treasure" },
  { id: 2, name: "Index + middle together", fingers: [0, 1, 1, 0, 0], spread: 0, consonants: ["DH", "K", "V", "Z"], keywords: "the caves" },
  { id: 3, name: "Middle, ring + pinky", fingers: [0, 0.14, 1, 1, 1], spread: 0.15, consonants: ["S", "HH", "R"], keywords: "seahorse" },
  { id: 4, name: "Four fingers, thumb tucked", fingers: [0, 1, 1, 1, 1], spread: 0, consonants: ["B", "N", "WH"], keywords: "white bone" },
  { id: 5, name: "Open hand, thumb out", fingers: [1, 1, 1, 1, 1], spread: 0, consonants: ["M", "T", "F"], keywords: "my feet" },
  { id: 6, name: "Index + thumb (L)", fingers: [1, 1, 0, 0, 0], spread: 0, consonants: ["W", "SH", "L"], keywords: "wet shell" },
  { id: 7, name: "Index, middle + thumb", fingers: [1, 1, 1, 0, 0], spread: 0, consonants: ["TH", "JH", "G"], keywords: "thin jogger" },
  { id: 8, name: "Index + middle spread (V)", fingers: [0, 1, 1, 0, 0], spread: 1, consonants: ["Y", "NG", "CH"], keywords: "young child" },
];

export const HANDSHAPE_BY_ID = Object.fromEntries(HANDSHAPES.map((h) => [h.id, h])) as Record<HandshapeId, HandshapeInfo>;

export const CONSONANT_TO_HANDSHAPE: Record<string, HandshapeId> = Object.fromEntries(
  HANDSHAPES.flatMap((h) => h.consonants.map((c) => [c, h.id]))
);

export interface VowelCue {
  placement: PlacementId;
  movement: Movement;
}

export const VOWEL_CUES: Record<string, VowelCue> = {
  IY: { placement: "mouth", movement: "none" },
  ER: { placement: "mouth", movement: "none" },
  AO: { placement: "chin", movement: "none" },
  EH: { placement: "chin", movement: "none" },
  UW: { placement: "chin", movement: "none" },
  AE: { placement: "throat", movement: "none" },
  IH: { placement: "throat", movement: "none" },
  UH: { placement: "throat", movement: "none" },
  OW: { placement: "side", movement: "forward" },
  AA: { placement: "side", movement: "forward" },
  AH: { placement: "side", movement: "down" },
  AY: { placement: "side", movement: "toThroat" },
  AW: { placement: "side", movement: "toThroat" },
  EY: { placement: "chin", movement: "toThroat" },
  OY: { placement: "chin", movement: "toThroat" },
};

export interface PlacementInfo {
  id: PlacementId;
  name: string;
  letter: string;
  where: string;
  vowels: string[];
  keywords: string;
}

export const PLACEMENTS: PlacementInfo[] = [
  { id: "mouth", name: "Mouth", letter: "m", where: "Corner of the mouth", vowels: ["IY", "ER"], keywords: "fir tree" },
  { id: "chin", name: "Chin", letter: "c", where: "Tip of the chin", vowels: ["AO", "EH", "UW"], keywords: "too tall Ted" },
  { id: "throat", name: "Throat", letter: "t", where: "Base of the throat", vowels: ["AE", "IH", "UH"], keywords: "look at it" },
  { id: "side", name: "Side", letter: "s", where: "~4 in. beside the chin", vowels: [], keywords: "consonant alone" },
];

export interface MovementInfo {
  id: string;
  name: string;
  notation: string;
  vowels: string[];
  keywords: string;
  placement: PlacementId;
  movement: Movement;
}

export const MOVEMENTS: MovementInfo[] = [
  { id: "sf", name: "Side-forward", notation: "sf", vowels: ["OW", "AA"], keywords: "boat dock", placement: "side", movement: "forward" },
  { id: "sd", name: "Side-down", notation: "sd", vowels: ["AH"], keywords: "sun", placement: "side", movement: "down" },
  { id: "st", name: "Side → throat", notation: "s-5t", vowels: ["AY", "AW"], keywords: "lighthouse", placement: "side", movement: "toThroat" },
  { id: "ct", name: "Chin → throat", notation: "c-5t", vowels: ["EY", "OY"], keywords: "moist snails", placement: "chin", movement: "toThroat" },
];

export interface Cue {
  consonant: string | null;
  vowel: string | null;
  handshape: HandshapeId;
  placement: PlacementId;
  movement: Movement;
  /** Cue notation, e.g. "5m", "2sf", "3s", "1c-5t" */
  notation: string;
  /** Friendly sound label, e.g. "t + ee" */
  sound: string;
}

const PLACEMENT_LETTER: Record<PlacementId, string> = { side: "s", mouth: "m", chin: "c", throat: "t" };

export function notationFor(hs: HandshapeId, placement: PlacementId, movement: Movement): string {
  if (movement === "forward") return `${hs}sf`;
  if (movement === "down") return `${hs}sd`;
  if (movement === "toThroat") return `${hs}${PLACEMENT_LETTER[placement]}-5t`;
  return `${hs}${PLACEMENT_LETTER[placement]}`;
}

export function makeCue(consonant: string | null, vowel: string | null): Cue {
  const handshape: HandshapeId = consonant ? CONSONANT_TO_HANDSHAPE[consonant] ?? 5 : 5;
  const vc = vowel ? VOWEL_CUES[vowel] : null;
  const placement: PlacementId = vc ? vc.placement : "side";
  const movement: Movement = vc ? vc.movement : "none";
  const sound = [consonant ? PHONEMES[consonant]?.label : null, vowel ? PHONEMES[vowel]?.label : null]
    .filter(Boolean)
    .join(" + ");
  return { consonant, vowel, handshape, placement, movement, notation: notationFor(handshape, placement, movement), sound };
}

/** Group a phoneme sequence into consonant-vowel cues. */
export function buildCues(phonemes: string[]): Cue[] {
  const cues: Cue[] = [];
  let i = 0;
  while (i < phonemes.length) {
    const p = phonemes[i];
    if (isVowel(p)) {
      cues.push(makeCue(null, p)); // vowel alone → handshape 5
      i += 1;
      continue;
    }
    const next = phonemes[i + 1];
    if (next && isVowel(next)) {
      cues.push(makeCue(p, next));
      i += 2;
    } else {
      cues.push(makeCue(p, null)); // consonant alone → side
      i += 1;
    }
  }
  return cues;
}

export function placementName(cue: Pick<Cue, "placement" | "movement">): string {
  if (cue.movement === "forward") return "Side-forward";
  if (cue.movement === "down") return "Side-down";
  if (cue.movement === "toThroat") return cue.placement === "side" ? "Side → throat" : "Chin → throat";
  return { side: "Side", mouth: "Mouth", chin: "Chin", throat: "Throat" }[cue.placement];
}

export function phonemeLabel(p: string | null): string {
  return p ? PHONEMES[p]?.label ?? p.toLowerCase() : "";
}
