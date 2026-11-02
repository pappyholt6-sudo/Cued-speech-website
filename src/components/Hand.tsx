import { memo } from "react";
import type { Fingers, PlacementId } from "../lib/cuedSpeech";
import {
  clamp01,
  FINGERS_GEOM,
  fingerAngle,
  fingerLength,
  lerp,
  PALM_PATH,
  smoothstep,
  THUMB,
} from "../lib/geometry";

export interface SkinTone {
  name: string;
  base: string;
  shade: string;
  line: string;
  lip: string;
  blush: string;
  nail: string;
}

export const SKIN_TONES: SkinTone[] = [
  { name: "Light", base: "#F7D7BE", shade: "#E8B693", line: "#B57F5B", lip: "#D88379", blush: "#F2A08F", nail: "#FBE6DA" },
  { name: "Fair", base: "#EDC29E", shade: "#D9A077", line: "#A66C47", lip: "#C9726A", blush: "#E8917C", nail: "#F7DCC8" },
  { name: "Medium", base: "#D49E74", shade: "#B98057", line: "#865333", lip: "#AE625A", blush: "#D27E66", nail: "#EBC6A8" },
  { name: "Tan", base: "#AC734D", shade: "#8F5937", line: "#5C361F", lip: "#8A4B43", blush: "#B5634B", nail: "#CF9F80" },
  { name: "Deep", base: "#74472C", shade: "#5A341E", line: "#2E1A0E", lip: "#5E322C", blush: "#8A4B37", nail: "#A07458" },
];

interface HandProps {
  fingers: Fingers;
  spread: number;
  tone: SkinTone;
}

function Finger({ i, ext, spread, tone }: { i: number; ext: number; spread: number; tone: SkinTone }) {
  const g = FINGERS_GEOM[i];
  const L = fingerLength(i, ext);
  const a = fingerAngle(i, spread);
  const nailO = smoothstep(0.45, 0.95, ext);
  const creaseO = 0.4 * smoothstep(0.5, 1, ext);
  return (
    <g transform={`translate(${g.x} ${g.y}) rotate(${a.toFixed(2)})`}>
      <rect x={-g.w / 2} y={-L} width={g.w} height={L + 16} rx={g.w / 2} fill={tone.base} stroke={tone.line} strokeWidth={1.5} />
      {ext < 0.98 && (
        <rect x={-g.w / 2} y={-L} width={g.w} height={L + 16} rx={g.w / 2} fill={tone.shade} opacity={(1 - ext) * 0.55} />
      )}
      {nailO > 0.01 && (
        <rect x={-g.w / 2 + 2.8} y={-L + 2.6} width={g.w - 5.6} height={9.5} rx={3.6} fill={tone.nail} stroke={tone.line} strokeOpacity={0.35} strokeWidth={0.8} opacity={nailO} />
      )}
      {creaseO > 0.01 && (
        <g stroke={tone.line} strokeWidth={1.1} fill="none" strokeLinecap="round" opacity={creaseO}>
          <path d={`M ${-g.w * 0.28} ${-L * 0.63} q ${g.w * 0.28} 2.2 ${g.w * 0.56} 0`} />
          <path d={`M ${-g.w * 0.3} ${-L * 0.3} q ${g.w * 0.3} 2.4 ${g.w * 0.6} 0`} />
        </g>
      )}
    </g>
  );
}

/** The cueing hand in local coordinates (fingers up, wrist at the origin). */
export const Hand = memo(function Hand({ fingers, spread, tone }: HandProps) {
  const th = clamp01(fingers[0]);
  const thumbAngle = lerp(THUMB.foldAngle, THUMB.extAngle, th);
  const thumbLen = lerp(THUMB.foldLen, THUMB.len, th);
  return (
    <g strokeLinejoin="round">
      {/* thumb (tucks behind the palm when folded) */}
      <g transform={`translate(${THUMB.x} ${THUMB.y}) rotate(${thumbAngle.toFixed(2)})`}>
        <rect x={-THUMB.w / 2} y={-thumbLen} width={THUMB.w} height={thumbLen + 3 + 15 * th} rx={THUMB.w / 2} fill={tone.base} stroke={tone.line} strokeWidth={1.5} />
        <rect x={-THUMB.w / 2 + 3.2} y={-thumbLen + 2.8} width={THUMB.w - 6.4} height={10} rx={3.8} fill={tone.nail} opacity={0.75 * smoothstep(0.5, 1, th)} />
        <path d={`M ${-THUMB.w * 0.3} ${-thumbLen * 0.45} q ${THUMB.w * 0.3} 2.4 ${THUMB.w * 0.6} 0`} stroke={tone.line} strokeWidth={1.1} fill="none" opacity={0.4 * th} />
      </g>
      {[3, 2, 1, 0].map((i) => (
        <Finger key={i} i={i} ext={clamp01(fingers[i + 1])} spread={spread} tone={tone} />
      ))}
      {/* back of the hand */}
      <path d={PALM_PATH} fill={tone.base} stroke={tone.line} strokeWidth={1.6} />
      {/* tendons */}
      <g stroke={tone.shade} strokeWidth={2.2} strokeLinecap="round" opacity={0.55} fill="none">
        {FINGERS_GEOM.map((g, i) => (
          <path key={i} d={`M ${g.x * 0.92} ${g.y + 8} Q ${g.x * 0.7} ${-36} ${g.x * 0.35} ${-10}`} />
        ))}
      </g>
      {/* knuckles */}
      {FINGERS_GEOM.map((g, i) => (
        <ellipse key={i} cx={g.x} cy={g.y + 1.5} rx={4.6} ry={2.6} fill="#ffffff" opacity={0.22} />
      ))}
    </g>
  );
});

/** Small upright hand icon for charts and chips. */
export function MiniHand({
  fingers,
  spread,
  tone = SKIN_TONES[1],
  className,
}: {
  fingers: Fingers;
  spread: number;
  tone?: SkinTone;
  className?: string;
}) {
  return (
    <svg viewBox="-66 -146 122 156" className={className} aria-hidden="true">
      <Hand fingers={fingers} spread={spread} tone={tone} />
    </svg>
  );
}

const MINI_POINTS: Record<PlacementId, { x: number; y: number }> = {
  mouth: { x: 41, y: 50 },
  chin: { x: 50, y: 62 },
  throat: { x: 50, y: 80 },
  side: { x: 14, y: 58 },
};

/** Tiny face diagram highlighting a placement (and optional movement arrow). */
export function MiniFace({
  placement,
  to,
  arrow,
  className,
}: {
  placement: PlacementId;
  to?: PlacementId;
  arrow?: "forward" | "down";
  className?: string;
}) {
  const p = MINI_POINTS[placement];
  const q = to ? MINI_POINTS[to] : null;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <rect x="40" y="62" width="20" height="30" rx="6" fill="#E9D5C4" />
      <path d="M 18 100 C 20 86 34 82 50 82 C 66 82 80 86 82 100 Z" fill="#C7D2FE" />
      <ellipse cx="50" cy="42" rx="24" ry="28" fill="#F3DCC8" stroke="#C9A285" strokeWidth="1.5" />
      <circle cx="41" cy="37" r="2.4" fill="#4B3426" />
      <circle cx="59" cy="37" r="2.4" fill="#4B3426" />
      <path d="M 42 51 Q 50 55 58 51" stroke="#B85C55" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {q && (
        <path
          d={`M ${p.x} ${p.y} Q ${(p.x + q.x) / 2 - 6} ${(p.y + q.y) / 2 + 10} ${q.x} ${q.y}`}
          stroke="#7C3AED"
          strokeWidth="2.4"
          fill="none"
          strokeDasharray="3 3"
        />
      )}
      {arrow === "down" && <path d={`M ${p.x} ${p.y + 4} L ${p.x} ${p.y + 18} M ${p.x - 4} ${p.y + 13} L ${p.x} ${p.y + 18} L ${p.x + 4} ${p.y + 13}`} stroke="#7C3AED" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {arrow === "forward" && (
        <g stroke="#7C3AED" strokeWidth="2.2" fill="none">
          <circle cx={p.x} cy={p.y} r="9" strokeDasharray="2.5 2.5" />
          <circle cx={p.x} cy={p.y} r="14" strokeDasharray="2.5 3" opacity="0.6" />
        </g>
      )}
      <circle cx={p.x} cy={p.y} r="6" fill="#7C3AED" stroke="#fff" strokeWidth="2" />
      {q && <circle cx={q.x} cy={q.y} r="5" fill="#A78BFA" stroke="#fff" strokeWidth="2" />}
    </svg>
  );
}
