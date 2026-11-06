// Geometry shared by the avatar renderer and the animation timeline.
import type { Fingers, PlacementId } from "./cuedSpeech";

export const VIEW_W = 420;
export const VIEW_H = 440;
export const FACE_CX = 220;
export const MOUTH_Y = 247;

/** Global multiplier for hand size relative to the face. */
export const HAND_SCALE = 1.06;

export interface HandPose {
  /** contact point (finger tip) in avatar coordinates */
  x: number;
  y: number;
  /** finger direction in degrees, clockwise from straight up */
  rot: number;
  scale: number;
  fingers: Fingers;
  spread: number;
  /**
   * The point on the hand (in hand-local coordinates) that sits at (x, y) — normally the
   * touching fingertip. Interpolated on its own channel so that morphing between
   * handshapes never nudges the whole hand sideways mid-flight.
   */
  anchor?: { x: number; y: number };
}

/** Where the contact finger goes for each placement (right-handed cuer, viewed from the front). */
export const PLACEMENT_TARGETS: Record<PlacementId, { x: number; y: number; rot: number }> = {
  side: { x: 112, y: 270, rot: 14 },
  mouth: { x: 199, y: 250, rot: 60 },
  chin: { x: 220, y: 276, rot: 74 },
  throat: { x: 220, y: 322, rot: 86 },
};

export const REST_POSE: HandPose = {
  x: 96,
  y: 520,
  rot: 10,
  scale: 1,
  fingers: [0.35, 0.8, 0.75, 0.65, 0.55],
  spread: 0.1,
};

// ---- hand local geometry: fingers point up (−y), origin at the wrist, back of the right hand toward viewer
export const FINGERS_GEOM = [
  { x: -20, y: -68, len: 56, w: 14 }, // index
  { x: -6.5, y: -70, len: 62, w: 14.5 }, // middle
  { x: 7, y: -69, len: 57, w: 13.5 }, // ring
  { x: 19.5, y: -66, len: 45, w: 12 }, // pinky
];
export const FOLDED_LEN = 11;
export const THUMB = { x: -25, y: -26, len: 44, foldLen: 22, w: 16, extAngle: -52, foldAngle: 28 };
export const PALM_PATH =
  "M -23 4 C -30 -12 -33.5 -30 -32 -48 C -31.5 -60 -30 -67 -24.5 -71.5 C -10 -76.5 12 -76.5 25.5 -70 C 31 -66 32.5 -56 31.5 -44 C 30.5 -26 27.5 -9 21 4 Z";

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function fingerAngle(i: number, spread: number): number {
  const base = [-4, 0, 3.5, 8][i];
  const s = [-12, 10, 0, 0][i] * spread;
  return base + s;
}

export function fingerLength(i: number, ext: number): number {
  return FOLDED_LEN + (FINGERS_GEOM[i].len - FOLDED_LEN) * ext;
}

export function fingerTip(i: number, ext: number, spread: number) {
  const b = FINGERS_GEOM[i];
  const a = (fingerAngle(i, spread) * Math.PI) / 180;
  const L = fingerLength(i, ext);
  return { x: b.x + Math.sin(a) * L, y: b.y - Math.cos(a) * L };
}

/**
 * The finger that touches the placement: the middle finger when extended with the
 * fingers together (handshape 2), but the pointer finger when they are spread apart
 * (handshape 8, /y ng ch/) or when the middle finger is folded.
 */
export function contactPoint(fingers: Fingers, spread: number) {
  const ti = fingerTip(0, fingers[1], spread);
  const tm = fingerTip(1, fingers[2], spread);
  const w = smoothstep(0.3, 0.8, fingers[2]) * (1 - smoothstep(0.35, 0.85, spread));
  return { x: lerp(ti.x, tm.x, w), y: lerp(ti.y, tm.y, w) };
}

/** The point of the hand that rests on the placement: the stored anchor, or the touching fingertip. */
export function anchorOf(pose: HandPose) {
  return pose.anchor ?? contactPoint(pose.fingers, pose.spread);
}

export function handTransform(pose: HandPose): string {
  const a = anchorOf(pose);
  const s = pose.scale * HAND_SCALE;
  return `translate(${pose.x.toFixed(2)} ${pose.y.toFixed(2)}) rotate(${pose.rot.toFixed(2)}) scale(${s.toFixed(4)}) translate(${(-a.x).toFixed(2)} ${(-a.y).toFixed(2)})`;
}

/** Map a point from hand-local coordinates into avatar coordinates. */
export function handToGlobal(pose: HandPose, p: { x: number; y: number }) {
  const a = anchorOf(pose);
  const s = pose.scale * HAND_SCALE;
  const lx = (p.x - a.x) * s;
  const ly = (p.y - a.y) * s;
  const r = (pose.rot * Math.PI) / 180;
  return {
    x: pose.x + lx * Math.cos(r) - ly * Math.sin(r),
    y: pose.y + lx * Math.sin(r) + ly * Math.cos(r),
  };
}

export function mixPose(a: HandPose, b: HandPose, t: number, ft: number = t): HandPose {
  const aa = a.anchor ?? contactPoint(a.fingers, a.spread);
  const ab = b.anchor ?? contactPoint(b.fingers, b.spread);
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    rot: lerp(a.rot, b.rot, t),
    scale: lerp(a.scale, b.scale, t),
    fingers: a.fingers.map((f, i) => lerp(f, b.fingers[i], ft)) as Fingers,
    spread: lerp(a.spread, b.spread, ft),
    anchor: { x: lerp(aa.x, ab.x, t), y: lerp(aa.y, ab.y, t) },
  };
}
