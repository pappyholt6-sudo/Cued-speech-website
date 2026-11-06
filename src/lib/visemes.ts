// Mouth shapes (visemes) so the avatar's lips move with each sound — Cued Speech is always paired with lipreading.

export interface MouthShape {
  /** jaw / lip opening 0..1 */
  open: number;
  /** horizontal stretch (spread > 1, rounded < 1) */
  width: number;
  /** lip rounding / protrusion 0..1 */
  round: number;
  /** upper teeth visibility 0..1 */
  teeth: number;
  /** tongue tip between teeth (th) 0..1 */
  tongue: number;
  /** lower lip tucked under upper teeth (f, v) 0..1 */
  bite: number;
  /** tongue tip raised behind teeth (l) 0..1 */
  tongueUp: number;
}

const S = (open: number, width: number, round = 0, teeth = 0, tongue = 0, bite = 0, tongueUp = 0): MouthShape => ({
  open, width, round, teeth, tongue, bite, tongueUp,
});

export const REST_MOUTH: MouthShape = S(0, 1);
export const RELAXED_MOUTH: MouthShape = S(0.06, 1);

export const VISEMES: Record<string, MouthShape> = {
  // bilabials: lips pressed
  P: S(0, 0.95), B: S(0, 0.95), M: S(0, 0.95),
  // labiodentals
  F: S(0.1, 1.0, 0, 1, 0, 1), V: S(0.1, 1.0, 0, 1, 0, 1),
  // dentals
  TH: S(0.2, 1.02, 0, 1, 1), DH: S(0.2, 1.02, 0, 1, 1),
  // alveolars
  T: S(0.16, 1.05, 0, 1), D: S(0.16, 1.05, 0, 1), N: S(0.17, 1.04, 0, 0.85),
  S: S(0.11, 1.1, 0, 1), Z: S(0.11, 1.1, 0, 1),
  L: S(0.3, 1.02, 0, 0.75, 0, 0, 1),
  // velars, glottal, palatal
  K: S(0.26, 1.02, 0, 0.5), G: S(0.26, 1.02, 0, 0.5), NG: S(0.22, 1.02, 0, 0.5),
  HH: S(0.32, 1.0, 0, 0.4), Y: S(0.18, 1.12, 0, 0.8),
  // rounded consonants
  R: S(0.18, 0.84, 0.55, 0.4), W: S(0.1, 0.68, 1), WH: S(0.1, 0.68, 1),
  SH: S(0.2, 0.8, 0.7, 1), ZH: S(0.2, 0.8, 0.7, 1), CH: S(0.2, 0.82, 0.65, 1), JH: S(0.2, 0.82, 0.65, 1),
  // vowels
  IY: S(0.2, 1.22, 0, 1), IH: S(0.32, 1.12, 0, 0.8), EH: S(0.45, 1.1, 0, 0.6), AE: S(0.62, 1.16, 0, 0.6),
  AA: S(0.85, 1.0, 0, 0.35), AO: S(0.62, 0.86, 0.5, 0.2), AH: S(0.45, 1.0, 0, 0.35),
  UH: S(0.3, 0.84, 0.6, 0.1), UW: S(0.18, 0.68, 1, 0), ER: S(0.28, 0.85, 0.5, 0.3), OW: S(0.38, 0.74, 0.85, 0),
};

const DIPHTHONGS: Record<string, [string, string]> = {
  AY: ["AA", "IY"],
  AW: ["AA", "UW"],
  EY: ["EH", "IY"],
  OY: ["OW", "IY"],
};

export function visemeFor(p: string): MouthShape {
  return VISEMES[p] ?? RELAXED_MOUTH;
}

/** One or two mouth shapes for a vowel (diphthongs glide between two). */
export function vowelVisemes(v: string): [MouthShape, MouthShape] {
  const d = DIPHTHONGS[v];
  if (d) return [visemeFor(d[0]), visemeFor(d[1])];
  const m = visemeFor(v);
  return [m, m];
}

export const isBilabial = (p: string | null) => p === "P" || p === "B" || p === "M";

export function mixMouth(a: MouthShape, b: MouthShape, t: number): MouthShape {
  const l = (x: number, y: number) => x + (y - x) * t;
  return {
    open: l(a.open, b.open),
    width: l(a.width, b.width),
    round: l(a.round, b.round),
    teeth: l(a.teeth, b.teeth),
    tongue: l(a.tongue, b.tongue),
    bite: l(a.bite, b.bite),
    tongueUp: l(a.tongueUp, b.tongueUp),
  };
}
