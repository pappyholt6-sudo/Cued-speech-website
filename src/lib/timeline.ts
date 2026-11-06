// Builds keyframes for the hand and face from cued words, and samples them at any time.
import { type Cue, type Fingers, type HandshapeId, HANDSHAPE_BY_ID, type PlacementId } from "./cuedSpeech";
import type { CuedWord } from "./g2p";
import {
  clamp01,
  contactPoint,
  type HandPose,
  mixPose,
  PLACEMENT_TARGETS,
  REST_POSE,
  smoothstep,
} from "./geometry";
import { isBilabial, type MouthShape, mixMouth, RELAXED_MOUTH, REST_MOUTH, visemeFor, vowelVisemes } from "./visemes";

export interface TimedCue {
  cue: Cue;
  wordIndex: number;
  index: number;
  start: number;
  duration: number;
}

export interface HandKey {
  t: number;
  pose: HandPose;
}

export interface FaceKey {
  t: number;
  mouth: MouthShape;
  brow: number;
}

export interface Timeline {
  words: CuedWord[];
  cues: TimedCue[];
  wordStarts: number[];
  duration: number;
  handKeys: HandKey[];
  faceKeys: FaceKey[];
}

export const BASE_CUE_MS = 640;
const LEAD_IN = 560;
const WORD_GAP = 210;
const SENTENCE_GAP = 560;
const TAIL = 760;

export function poseFor(hs: HandshapeId, placement: PlacementId): HandPose {
  const t = PLACEMENT_TARGETS[placement];
  const h = HANDSHAPE_BY_ID[hs];
  const fingers = [...h.fingers] as Fingers;
  return { x: t.x, y: t.y, rot: t.rot, scale: 1, fingers, spread: h.spread, anchor: contactPoint(fingers, h.spread) };
}

function endPoseFor(cue: Cue, start: HandPose): HandPose {
  switch (cue.movement) {
    case "forward": // toward the viewer: slightly out, down and larger
      return { ...start, x: start.x - 14, y: start.y + 10, rot: start.rot - 4, scale: 1.14 };
    case "down":
      return { ...start, y: start.y + 34, rot: start.rot + 3 };
    case "toThroat": // second half of a diphthong: handshape 5 at the throat
      return poseFor(5, "throat");
    default:
      return start;
  }
}

/** Move a pose back along its finger direction (a small lift between cues). */
function pullBack(p: HandPose, amount: number): HandPose {
  const r = (p.rot * Math.PI) / 180;
  return { ...p, x: p.x - Math.sin(r) * amount, y: p.y + Math.cos(r) * amount };
}

export function buildTimeline(words: CuedWord[], cueMs = BASE_CUE_MS): Timeline {
  const cues: TimedCue[] = [];
  const handKeys: HandKey[] = [{ t: 0, pose: REST_POSE }];
  const faceKeys: FaceKey[] = [{ t: 0, mouth: REST_MOUTH, brow: 0 }];
  const wordStarts: number[] = [];
  let t = LEAD_IN;
  let prevEnd: HandPose = REST_POSE;
  let idx = 0;

  words.forEach((word, wi) => {
    wordStarts.push(t);
    const brow = word.question ? 1 : 0;
    word.cues.forEach((cue) => {
      const d = cue.movement === "none" ? cueMs : cueMs * 1.15;
      const start = poseFor(cue.handshape, cue.placement);
      const end = endPoseFor(cue, start);
      const arrive = t + 0.38 * d;

      // hand
      if (idx > 0) {
        const last = handKeys[handKeys.length - 1];
        const mid = mixPose(prevEnd, start, 0.5, 1);
        const dist = Math.hypot(prevEnd.x - start.x, prevEnd.y - start.y);
        // a small lift between placements, sized to the travel so short hops stay subtle
        handKeys.push({ t: (last.t + arrive) / 2, pose: pullBack(mid, 4 + 8 * clamp01(dist / 240)) });
      }
      handKeys.push({ t: arrive, pose: start });
      if (cue.movement === "none") {
        handKeys.push({ t: t + 0.9 * d, pose: start });
      } else {
        handKeys.push({ t: t + 0.46 * d, pose: start });
        handKeys.push({ t: t + 0.86 * d, pose: end });
        handKeys.push({ t: t + 0.95 * d, pose: end });
      }

      // face
      if (cue.consonant) {
        const m = visemeFor(cue.consonant);
        faceKeys.push({ t: t + 0.1 * d, mouth: m, brow });
        faceKeys.push({ t: t + (isBilabial(cue.consonant) ? 0.34 : 0.28) * d, mouth: m, brow });
      }
      if (cue.vowel) {
        const [v1, v2] = vowelVisemes(cue.vowel);
        faceKeys.push({ t: t + 0.5 * d, mouth: v1, brow });
        faceKeys.push({ t: t + 0.86 * d, mouth: v2, brow });
      } else {
        faceKeys.push({ t: t + 0.62 * d, mouth: RELAXED_MOUTH, brow });
      }

      cues.push({ cue, wordIndex: wi, index: idx++, start: t, duration: d });
      prevEnd = end;
      t += d;
    });
    const gap = word.sentenceEnd ? SENTENCE_GAP : WORD_GAP;
    faceKeys.push({ t: t + gap * 0.55, mouth: word.sentenceEnd ? REST_MOUTH : RELAXED_MOUTH, brow: word.sentenceEnd ? 0 : brow });
    t += gap;
  });

  handKeys.push({ t: t + TAIL * 0.15, pose: prevEnd });
  handKeys.push({ t: t + TAIL * 0.85, pose: REST_POSE });
  faceKeys.push({ t: t + TAIL * 0.5, mouth: REST_MOUTH, brow: 0 });
  return { words, cues, wordStarts, duration: t + TAIL, handKeys, faceKeys };
}

function findSeg(keys: { t: number }[], t: number): number {
  if (t <= keys[0].t) return 0;
  let lo = 0;
  let hi = keys.length - 1;
  if (t >= keys[hi].t) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (keys[mid].t <= t) lo = mid;
    else hi = mid;
  }
  return lo;
}

// ---------------------------------------------------------------- smooth hand sampling
// Channels: x, y, rot, scale, spread, anchor.x, anchor.y, thumb..pinky.
const CHANNELS = 12;

function poseChannels(p: HandPose): number[] {
  const a = p.anchor ?? contactPoint(p.fingers, p.spread);
  return [p.x, p.y, p.rot, p.scale, p.spread, a.x, a.y, ...p.fingers];
}

function channelsPose(v: number[]): HandPose {
  const cl = (x: number) => clamp01(x);
  return {
    x: v[0],
    y: v[1],
    rot: v[2],
    scale: v[3],
    spread: cl(v[4]),
    anchor: { x: v[5], y: v[6] },
    fingers: [cl(v[7]), cl(v[8]), cl(v[9]), cl(v[10]), cl(v[11])] as Fingers,
  };
}

interface Spline {
  times: number[];
  vals: number[][];
  tan: number[][];
}

const EQ_EPS = 1e-6;
const splineCache = new WeakMap<HandKey[], Spline>();

/**
 * Tangents for cubic Hermite interpolation. Keys that sit in a hold (a repeated pose)
 * get a zero tangent, so the hand settles onto each placement and leaves it from rest,
 * while every other key keeps the average of its neighbouring slopes — no stop-start.
 */
function buildSpline(keys: HandKey[]): Spline {
  const n = keys.length;
  const times = keys.map((k) => k.t);
  const vals = keys.map((k) => poseChannels(k.pose));

  const resting = new Array<boolean>(n).fill(false);
  for (let i = 0; i + 1 < n; i++) {
    let same = true;
    for (let c = 0; c < CHANNELS && same; c++) same = Math.abs(vals[i][c] - vals[i + 1][c]) < EQ_EPS;
    if (same) {
      resting[i] = true;
      resting[i + 1] = true;
    }
  }

  const tan: number[][] = Array.from({ length: n }, () => new Array<number>(CHANNELS).fill(0));
  for (let i = 0; i < n; i++) {
    if (resting[i]) continue;
    for (let c = 0; c < CHANNELS; c++) {
      const sPrev = i > 0 ? (vals[i][c] - vals[i - 1][c]) / (times[i] - times[i - 1]) : null;
      const sNext = i < n - 1 ? (vals[i + 1][c] - vals[i][c]) / (times[i + 1] - times[i]) : null;
      tan[i][c] = sPrev !== null && sNext !== null ? (sPrev + sNext) / 2 : (sPrev ?? sNext ?? 0);
    }
  }
  return { times, vals, tan };
}

function evalSpline(s: Spline, t: number): number[] {
  const { times, vals, tan } = s;
  const n = times.length;
  if (n === 1) return vals[0].slice();
  if (t <= times[0]) return vals[0].slice();
  if (t >= times[n - 1]) return vals[n - 1].slice();
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid;
  }
  const h = times[lo + 1] - times[lo];
  const u = (t - times[lo]) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  const out = new Array<number>(CHANNELS);
  for (let c = 0; c < CHANNELS; c++) {
    out[c] = h00 * vals[lo][c] + h10 * h * tan[lo][c] + h01 * vals[lo + 1][c] + h11 * h * tan[lo + 1][c];
  }
  return out;
}

function getSpline(keys: HandKey[]): Spline {
  let s = splineCache.get(keys);
  if (!s) {
    s = buildSpline(keys);
    splineCache.set(keys, s);
  }
  return s;
}

export function sampleHand(keys: HandKey[], t: number): HandPose {
  if (!keys.length) return REST_POSE;
  return channelsPose(evalSpline(getSpline(keys), t));
}

export function sampleFace(keys: FaceKey[], t: number): { mouth: MouthShape; brow: number } {
  const i = findSeg(keys, t);
  const a = keys[i];
  const b = keys[i + 1];
  if (!b) return { mouth: a.mouth, brow: a.brow };
  const p = smoothstep(0, 1, (t - a.t) / Math.max(1, b.t - a.t));
  return { mouth: mixMouth(a.mouth, b.mouth, p), brow: a.brow + (b.brow - a.brow) * p };
}

/** Index of the cue being performed at time t (−1 before the first cue). */
export function cueIndexAt(tl: Timeline, t: number): number {
  const cs = tl.cues;
  if (!cs.length || t < cs[0].start) return -1;
  let lo = 0;
  let hi = cs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cs[mid].start <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Time at which a cue's handshape is fully formed at its placement. */
export function cueHoldTime(tc: TimedCue): number {
  return tc.start + tc.duration * 0.5;
}
