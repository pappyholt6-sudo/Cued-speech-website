import { memo, useId } from "react";
import type { PlacementId } from "../lib/cuedSpeech";
import {
  clamp01,
  FACE_CX,
  HAND_SCALE,
  handToGlobal,
  handTransform,
  type HandPose,
  MOUTH_Y,
  PLACEMENT_TARGETS,
  VIEW_H,
  VIEW_W,
} from "../lib/geometry";
import type { MouthShape } from "../lib/visemes";
import { Hand, SKIN_TONES, type SkinTone } from "./Hand";

export type HairStyle = "short" | "long" | "curly" | "bun";

export interface AvatarLook {
  skin: number;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
}

export const HAIR_COLORS = ["#2A1B12", "#5B3A24", "#9A5B2C", "#D8B169", "#151515", "#A3A3A3", "#B4432E"];
export const SHIRT_COLORS = ["#4F46E5", "#0EA5E9", "#059669", "#DB2777", "#F59E0B", "#334155", "#7C3AED"];
export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "long", label: "Long" },
  { id: "curly", label: "Curly" },
  { id: "bun", label: "Bun" },
];

export function shadeHex(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const CX = FACE_CX;

// ---------------------------------------------------------------- mouth
function Mouth({ m, tone, uid }: { m: MouthShape; tone: SkinTone; uid: string }) {
  const cy = MOUTH_Y;
  const open = clamp01(m.open);
  const round = clamp01(m.round);
  const hw = 23.5 * m.width;
  const ui = cy - open * 7.5 - round * 1.2; // inner edge of upper lip
  const li = cy + open * 19 + round * 1.2; // inner edge of lower lip
  const hwi = hw * (0.9 - 0.22 * round);
  const upperT = 5.8 + round * 2.6;
  const lowerT = 7.6 + round * 2.8;
  const uo = ui - upperT;
  const lo = li + lowerT;
  const L = CX - hw;
  const R = CX + hw;
  const bottomCtl = cy + (lo - cy) / 0.75;
  const outer = [
    `M ${L} ${cy}`,
    `C ${CX - hw * 0.72} ${cy - upperT * 0.6} ${CX - 13} ${uo - 0.6} ${CX - 6.5} ${uo - 1.2}`,
    `Q ${CX} ${uo + 1.6} ${CX + 6.5} ${uo - 1.2}`,
    `C ${CX + 13} ${uo - 0.6} ${CX + hw * 0.72} ${cy - upperT * 0.6} ${R} ${cy}`,
    `C ${CX + hw * 0.66} ${bottomCtl} ${CX - hw * 0.66} ${bottomCtl} ${L} ${cy}`,
    "Z",
  ].join(" ");
  const cxr = 0.55 + 0.3 * round;
  const topCtl = cy + (ui - cy) / 0.75;
  const botCtl = cy + (li - cy) / 0.75;
  const inner = `M ${CX - hwi} ${cy} C ${CX - hwi * cxr} ${topCtl} ${CX + hwi * cxr} ${topCtl} ${CX + hwi} ${cy} C ${CX + hwi * cxr} ${botCtl} ${CX - hwi * cxr} ${botCtl} ${CX - hwi} ${cy} Z`;
  const isOpen = li - ui > 1.4;
  const clipId = `${uid}-mouth`;
  return (
    <g>
      <path d={outer} fill={tone.lip} stroke={tone.line} strokeOpacity={0.35} strokeWidth={1} />
      {/* lower lip highlight */}
      <ellipse cx={CX} cy={li + lowerT * 0.5} rx={hw * 0.32} ry={1.6} fill="#fff" opacity={0.22} />
      {isOpen ? (
        <>
          <clipPath id={clipId}>
            <path d={inner} />
          </clipPath>
          <path d={inner} fill="#3A1117" />
          <g clipPath={`url(#${clipId})`}>
            <ellipse cx={CX} cy={li + 1} rx={hwi * 0.66} ry={Math.max(2, (li - ui) * 0.36)} fill="#C95A62" opacity={smoothOpen(open)} />
            <rect x={CX - hwi * 0.8} y={ui - 2} width={hwi * 1.6} height={7.5} rx={2} fill="#FAFAF7" opacity={m.teeth} />
            <rect x={CX - hwi * 0.62} y={li - 4.5} width={hwi * 1.24} height={6} rx={2} fill="#F2F0EA" opacity={m.teeth * 0.55 * clamp01(open * 2.2)} />
            <ellipse cx={CX} cy={ui + 6} rx={8} ry={4.4} fill="#D9666E" opacity={m.tongueUp} />
          </g>
          {m.tongue > 0.02 && <ellipse cx={CX} cy={li - 0.5} rx={9} ry={3.8} fill="#D9666E" opacity={m.tongue} />}
        </>
      ) : (
        <path d={`M ${L + 2} ${cy} Q ${CX} ${cy + 1.6} ${R - 2} ${cy}`} stroke={shadeHex(tone.lip, -0.45)} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      )}
      {m.bite > 0.02 && <rect x={CX - hw * 0.42} y={cy - 2.5} width={hw * 0.84} height={5.5} rx={1.6} fill="#FAFAF7" opacity={m.bite} />}
    </g>
  );
}
const smoothOpen = (o: number) => clamp01((o - 0.2) / 0.35);

// ---------------------------------------------------------------- hair
const CURLS = Array.from({ length: 13 }, (_, k) => {
  const th = ((200 - k * 18.33) * Math.PI) / 180;
  return { x: CX + 84 * Math.cos(th), y: 160 - 76 * Math.sin(th), r: 19 + (k % 3) * 2.5 };
});
const CURL_FRINGE = [
  { x: 172, y: 138, r: 11 },
  { x: 196, y: 134, r: 12 },
  { x: 221, y: 133, r: 12 },
  { x: 246, y: 134, r: 12 },
  { x: 269, y: 139, r: 11 },
];

function HairBack({ style, color }: { style: HairStyle; color: string }) {
  if (style === "long")
    return <path d="M 136 196 C 124 124 164 74 220 74 C 276 74 316 124 304 196 L 320 362 C 284 384 156 384 120 362 Z" fill={shadeHex(color, -0.12)} />;
  if (style === "bun")
    return (
      <g>
        <circle cx={CX} cy={72} r={29} fill={color} />
        <path d="M 196 66 Q 220 54 244 66" stroke={shadeHex(color, 0.18)} strokeWidth={2.5} fill="none" opacity={0.6} />
      </g>
    );
  if (style === "curly")
    return (
      <g fill={shadeHex(color, -0.1)}>
        {CURLS.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y + 6} r={c.r + 2} />
        ))}
      </g>
    );
  return null;
}

function HairFront({ style, color }: { style: HairStyle; color: string }) {
  const hi = shadeHex(color, 0.22);
  switch (style) {
    case "long":
      return (
        <g>
          <path d="M 139 232 C 127 156 148 101 194 87 C 238 75 287 91 300 140 C 306 170 303 202 301 232 C 293 188 285 157 264 136 C 238 151 195 147 169 128 C 155 151 147 188 139 232 Z" fill={color} />
          <path d="M 186 102 C 212 92 246 92 270 106" stroke={hi} strokeWidth={3} fill="none" opacity={0.45} strokeLinecap="round" />
        </g>
      );
    case "curly":
      return (
        <g fill={color}>
          {CURLS.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={c.r} />
          ))}
          <path d="M 141 192 C 134 120 172 80 220 80 C 268 80 306 120 299 192 C 292 166 276 147 252 141 C 236 145 204 145 188 141 C 164 147 148 166 141 192 Z" />
          {CURL_FRINGE.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={c.r} />
          ))}
          <g fill="none" stroke={hi} strokeWidth={2} opacity={0.35} strokeLinecap="round">
            {CURLS.filter((_, i) => i % 2 === 0).map((c, i) => (
              <path key={i} d={`M ${c.x - 7} ${c.y - 3} q 7 -7 14 0`} />
            ))}
          </g>
        </g>
      );
    case "bun":
      return (
        <g>
          <path d="M 140 198 C 130 130 168 90 220 90 C 272 90 310 130 300 198 C 296 160 282 130 220 124 C 158 130 144 160 140 198 Z" fill={color} />
          <path d="M 170 112 C 196 100 244 100 270 112" stroke={hi} strokeWidth={3} fill="none" opacity={0.4} strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g>
          <path d="M 139 200 C 128 146 142 104 182 88 C 216 74 264 78 290 102 C 308 120 309 162 301 200 C 297 174 291 154 279 140 C 260 151 230 152 204 141 C 187 134 174 125 166 117 C 155 136 146 164 139 200 Z" fill={color} />
          <path d="M 184 98 C 210 86 250 86 274 104" stroke={hi} strokeWidth={3} fill="none" opacity={0.45} strokeLinecap="round" />
        </g>
      );
  }
}

// ---------------------------------------------------------------- avatar
export interface AvatarProps {
  hand: HandPose;
  mouth: MouthShape;
  brow: number;
  look: AvatarLook;
  mirrored?: boolean;
  guides?: boolean;
  activePlacement?: PlacementId | null;
  className?: string;
}

export const Avatar = memo(function Avatar({
  hand,
  mouth,
  brow,
  look,
  mirrored,
  guides,
  activePlacement,
  className,
}: AvatarProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const tone = SKIN_TONES[look.skin] ?? SKIN_TONES[1];
  const shirt = look.shirt;
  const shirtDark = shadeHex(shirt, -0.28);
  const shirtLight = shadeHex(shirt, 0.16);
  const browColor = shadeHex(look.hair, -0.25);
  const by = 166 - brow * 6;

  // forearm geometry (from the wrist down to an off-screen elbow)
  const s = hand.scale * HAND_SCALE;
  const wrist = handToGlobal(hand, { x: -1, y: -4 });
  const fa = ((14 + hand.rot * 0.45) * Math.PI) / 180;
  const dir = { x: Math.sin(fa), y: -Math.cos(fa) };
  const perp = { x: -dir.y, y: dir.x };
  const ARM = 340;
  const wAt = (d: number) => 20 * s + (11 * s * d) / ARM;
  const pt = (d: number, side: number, extra = 0) => {
    const w = wAt(d) + extra;
    return `${(wrist.x - dir.x * d + perp.x * side * w).toFixed(1)} ${(wrist.y - dir.y * d + perp.y * side * w).toFixed(1)}`;
  };
  const sleeveStart = 66 * s;
  const forearm = `M ${pt(0, 1)} L ${pt(ARM, 1)} L ${pt(ARM, -1)} L ${pt(0, -1)} Z`;
  const sleeve = `M ${pt(sleeveStart, 1, 3)} L ${pt(ARM, 1, 3)} L ${pt(ARM, -1, 3)} L ${pt(sleeveStart, -1, 3)} Z`;
  const cuff = `M ${pt(sleeveStart + 4, 1, 3.5)} L ${pt(sleeveStart + 4, -1, 3.5)}`;

  return (
    <svg viewBox={`0 36 ${VIEW_W} ${VIEW_H - 36}`} className={className} role="img" aria-label="Animated avatar cueing">
      <defs>
        <radialGradient id={`${uid}-bg`} gradientUnits="userSpaceOnUse" cx={CX} cy={180} r={330}>
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#EEF2FF" />
          <stop offset="100%" stopColor="#DDE3FB" />
        </radialGradient>
        <filter id={`${uid}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="1.5" dy="3" stdDeviation="2.6" floodColor="#1E1B4B" floodOpacity="0.28" />
        </filter>
      </defs>
      {/* oversized so letterboxing (when height is capped) stays seamless */}
      <rect x={-400} y={0} width={VIEW_W + 800} height={VIEW_H + 40} fill={`url(#${uid}-bg)`} />
      <circle cx={CX} cy={190} r={150} fill="#FFFFFF" opacity={0.55} />

      <g transform={mirrored ? `translate(${VIEW_W} 0) scale(-1 1)` : undefined}>
        <g className="avatar-breathe">
          <HairBack style={look.hairStyle} color={look.hair} />
          {/* torso */}
          <path d="M -400 470 L -400 436 C -200 430 -60 422 -10 410 C -4 376 40 356 100 347 L 178 336 C 196 356 244 356 262 336 L 340 347 C 400 356 424 376 430 410 C 480 422 620 430 820 436 L 820 470 Z" fill={shirt} />
          <path d="M 40 372 C 70 356 110 350 150 348" stroke={shirtLight} strokeWidth={3} fill="none" opacity={0.5} strokeLinecap="round" />
          {/* neck */}
          <path d="M 193 256 L 193 338 C 201 356 239 356 247 338 L 247 256 Z" fill={tone.base} stroke={tone.line} strokeWidth={1.3} />
          <path d="M 193 262 L 247 262 L 247 284 C 236 300 204 300 193 284 Z" fill={tone.shade} opacity={0.7} />
          <path d="M 176 337 C 194 361 246 361 264 337" stroke={shirtDark} strokeWidth={7} fill="none" strokeLinecap="round" />
          {/* ears */}
          <ellipse cx={142} cy={195} rx={11} ry={19} fill={tone.base} stroke={tone.line} strokeWidth={1.3} />
          <ellipse cx={298} cy={195} rx={11} ry={19} fill={tone.base} stroke={tone.line} strokeWidth={1.3} />
          <path d="M 146 186 Q 139 195 146 205" stroke={tone.line} strokeWidth={1.4} fill="none" opacity={0.5} />
          <path d="M 294 186 Q 301 195 294 205" stroke={tone.line} strokeWidth={1.4} fill="none" opacity={0.5} />
          {/* face */}
          <path d="M 220 94 C 271 94 299 131 299 185 C 299 239 271 281 220 289 C 169 281 141 239 141 185 C 141 131 169 94 220 94 Z" fill={tone.base} stroke={tone.line} strokeWidth={1.5} />
          <ellipse cx={178} cy={226} rx={14} ry={8} fill={tone.blush} opacity={0.32} />
          <ellipse cx={262} cy={226} rx={14} ry={8} fill={tone.blush} opacity={0.32} />
          {/* eyes */}
          {[192, 248].map((x) => (
            <g key={x} className="avatar-eye">
              <ellipse cx={x} cy={188} rx={11} ry={8} fill="#FFFFFF" />
              <circle cx={x} cy={188.5} r={5.8} fill="#4A3020" />
              <circle cx={x} cy={188.5} r={2.9} fill="#120C08" />
              <circle cx={x + 2.1} cy={186.3} r={1.6} fill="#FFFFFF" />
              <path d={`M ${x - 12} 187.5 Q ${x} 176.5 ${x + 12} 187.5`} stroke={tone.line} strokeWidth={2.4} fill="none" strokeLinecap="round" />
            </g>
          ))}
          {/* brows */}
          <path d={`M 178 ${by + 2} Q 192 ${by - 5} 206 ${by + 1}`} stroke={browColor} strokeWidth={4.2} fill="none" strokeLinecap="round" />
          <path d={`M 234 ${by + 1} Q 248 ${by - 5} 262 ${by + 2}`} stroke={browColor} strokeWidth={4.2} fill="none" strokeLinecap="round" />
          {/* nose */}
          <path d="M 221 199 C 219 210 213 217 214 222 C 216 227 224 227 227 222" stroke={tone.line} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.75} />
          <Mouth m={mouth} tone={tone} uid={uid} />
          <HairFront style={look.hairStyle} color={look.hair} />
        </g>

        {/* placement guides */}
        {guides && (
          <g>
            {(Object.keys(PLACEMENT_TARGETS) as PlacementId[]).map((p) => {
              const t = PLACEMENT_TARGETS[p];
              const active = activePlacement === p;
              return (
                <g key={p}>
                  <circle cx={t.x} cy={t.y} r={active ? 9 : 6} fill={active ? "#7C3AED" : "#A78BFA"} opacity={active ? 0.35 : 0.25} />
                  <circle cx={t.x} cy={t.y} r={active ? 4 : 3} fill={active ? "#6D28D9" : "#8B5CF6"} opacity={active ? 0.95 : 0.6} />
                </g>
              );
            })}
          </g>
        )}

        {/* arm + hand */}
        <g filter={`url(#${uid}-shadow)`}>
          <path d={forearm} fill={tone.base} stroke={tone.line} strokeWidth={1.5} strokeLinejoin="round" />
          <path d={sleeve} fill={shirt} />
          <path d={cuff} stroke={shirtDark} strokeWidth={8} strokeLinecap="butt" />
          <g transform={handTransform(hand)}>
            <Hand fingers={hand.fingers} spread={hand.spread} tone={tone} />
          </g>
        </g>
      </g>
    </svg>
  );
});
