import {
  Captions,
  ChevronDown,
  Crosshair,
  FlipHorizontal2,
  Palette,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import type { Ref } from "react";
import { HANDSHAPE_BY_ID, type PlacementId, placementName } from "../lib/cuedSpeech";
import { REST_POSE } from "../lib/geometry";
import { sampleFace, sampleHand, type Timeline } from "../lib/timeline";
import { REST_MOUTH } from "../lib/visemes";
import { Avatar, type AvatarLook, HAIR_COLORS, HAIR_STYLES, SHIRT_COLORS } from "./Avatar";
import { MiniHand, SKIN_TONES } from "./Hand";

export interface Settings {
  speed: number;
  loop: boolean;
  guides: boolean;
  captions: boolean;
  mirrored: boolean;
  voice: boolean;
  autoCue: boolean;
}

interface StageProps {
  timeline: Timeline | null;
  time: number;
  playing: boolean;
  currentCue: number;
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => void;
  look: AvatarLook;
  onLook: (look: AvatarLook) => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (t: number) => void;
  onStep: (dir: -1 | 1) => void;
  onRestart: () => void;
  listening: boolean;
  interim: string;
  avatarRef?: Ref<HTMLDivElement>;
}

const SPEEDS = [0.5, 0.75, 1, 1.5, 2];

/** Small floating avatar shown while the main stage is scrolled out of view. */
export function FloatingAvatar({
  timeline,
  time,
  currentCue,
  look,
  mirrored,
  onClick,
}: {
  timeline: Timeline;
  time: number;
  currentCue: number;
  look: AvatarLook;
  mirrored: boolean;
  onClick: () => void;
}) {
  const hand = sampleHand(timeline.handKeys, time);
  const face = sampleFace(timeline.faceKeys, time);
  const current = currentCue >= 0 ? timeline.cues[currentCue] : null;
  const word = current ? timeline.words[current.wordIndex]?.display : "";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Scroll back to the avatar"
      className="fixed bottom-4 right-4 z-40 w-40 overflow-hidden rounded-2xl bg-white text-left shadow-2xl shadow-indigo-900/20 ring-1 ring-slate-200 transition hover:scale-[1.02] sm:w-52"
    >
      <Avatar hand={hand} mouth={face.mouth} brow={face.brow} look={look} mirrored={mirrored} className="block h-auto w-full" />
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2.5 py-1.5">
        <span className="truncate text-xs font-semibold text-slate-700">{word || "…"}</span>
        {current && <span className="font-mono text-xs font-bold text-indigo-700">{current.cue.notation}</span>}
      </div>
    </button>
  );
}

function fmt(ms: number) {
  const s = Math.max(0, ms) / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}

function Toggle({ icon: Icon, label, on, onClick, title }: { icon: LucideIcon; label: string; on: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title ?? label}
      className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
        on ? "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
      }`}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

function Swatches({ label, colors, value, onChange }: { label: string; colors: string[]; value: number; onChange: (i: number) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c, i) => (
          <button
            key={c + i}
            type="button"
            onClick={() => onChange(i)}
            aria-label={`${label} ${i + 1}`}
            className={`size-7 rounded-full ring-offset-2 transition hover:scale-110 ${value === i ? "ring-2 ring-indigo-500" : "ring-1 ring-black/10"}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}

export function Stage(props: StageProps) {
  const { timeline: tl, time, playing, currentCue, settings, onSettings, look, onLook, listening, interim, avatarRef } = props;
  const ended = !!tl && time >= tl.duration - 1;
  const hand = tl ? sampleHand(tl.handKeys, time) : REST_POSE;
  const face = tl ? sampleFace(tl.faceKeys, time) : { mouth: REST_MOUTH, brow: 0 };
  const current = tl && currentCue >= 0 && !ended ? tl.cues[currentCue] : null;
  const wordIdx = current ? current.wordIndex : -1;

  let activePlacement: PlacementId | null = null;
  if (current) {
    const late = time > current.start + current.duration * 0.62;
    activePlacement = current.cue.movement === "toThroat" && late ? "throat" : current.cue.placement;
  }

  // caption window around the current word
  const words = tl?.words ?? [];
  const winStart = Math.max(0, Math.min(Math.max(0, wordIdx - 5), words.length - 12));
  const shown = words.slice(winStart, winStart + 12);
  const hs = current ? HANDSHAPE_BY_ID[current.cue.handshape] : null;

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-indigo-900/5 ring-1 ring-slate-200">
      <div className="relative" ref={avatarRef}>
        <Avatar
          hand={hand}
          mouth={face.mouth}
          brow={face.brow}
          look={look}
          mirrored={settings.mirrored}
          guides={settings.guides}
          activePlacement={activePlacement}
          className="block h-auto w-full lg:max-h-[calc(100vh_-_340px)] lg:min-h-[300px]"
        />
        {current && hs && (
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-2xl bg-white/90 py-1.5 pl-1.5 pr-3 shadow-md ring-1 ring-slate-200 backdrop-blur sm:left-4 sm:top-4">
            <MiniHand fingers={hs.fingers} spread={hs.spread} tone={SKIN_TONES[look.skin]} className="h-11 w-9" />
            <div>
              <div className="font-mono text-xl font-extrabold leading-none text-indigo-700">{current.cue.notation}</div>
              <div className="mt-0.5 text-xs font-medium text-slate-600">{current.cue.sound || "—"}</div>
            </div>
          </div>
        )}
        {current && (
          <div className="pointer-events-none absolute right-3 top-3 max-w-[45%] rounded-xl bg-indigo-600/90 px-3 py-1.5 text-right text-xs font-medium text-white shadow sm:right-4 sm:top-4">
            <div>Handshape {current.cue.handshape}</div>
            <div className="text-indigo-100">{placementName(current.cue)}</div>
          </div>
        )}
        {listening && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-full bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-white" />
            </span>
            <span className="truncate">{interim ? `“${interim}”` : "Listening… start talking"}</span>
          </div>
        )}
      </div>

      {settings.captions && (
        <div className="flex min-h-[60px] flex-wrap items-center justify-center gap-x-1.5 gap-y-1 border-t border-slate-100 bg-slate-50/80 px-4 py-3 text-center">
          {shown.length ? (
            <>
              {winStart > 0 && <span className="text-slate-300">…</span>}
              {shown.map((w, i) => {
                const idx = winStart + i;
                const active = idx === wordIdx;
                const past = wordIdx >= 0 && idx < wordIdx;
                return (
                  <span
                    key={idx}
                    className={`rounded-lg px-1.5 py-0.5 text-lg font-semibold transition-all duration-150 sm:text-xl ${
                      active ? "scale-110 bg-indigo-600 text-white shadow" : past ? "text-slate-700" : "text-slate-400"
                    }`}
                  >
                    {w.display}
                  </span>
                );
              })}
              {winStart + 12 < words.length && <span className="text-slate-300">…</span>}
            </>
          ) : (
            <span className="text-sm text-slate-400">Captions will appear here</span>
          )}
        </div>
      )}

      {/* transport */}
      <div className="flex items-center gap-2 px-4 pt-3 sm:gap-3">
        <button
          type="button"
          onClick={playing ? props.onPause : props.onPlay}
          disabled={!tl}
          aria-label={playing ? "Pause" : "Play"}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-indigo-600 text-white shadow-md shadow-indigo-600/30 transition hover:bg-indigo-700 disabled:opacity-40"
        >
          {playing ? <Pause className="size-5" /> : <Play className="size-5 translate-x-px" />}
        </button>
        <button type="button" onClick={() => props.onStep(-1)} disabled={!tl} title="Previous cue" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40">
          <SkipBack className="size-4" />
        </button>
        <button type="button" onClick={() => props.onStep(1)} disabled={!tl} title="Next cue" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40">
          <SkipForward className="size-4" />
        </button>
        <button type="button" onClick={props.onRestart} disabled={!tl} title="Replay from start" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40">
          <RotateCcw className="size-4" />
        </button>
        <input
          type="range"
          min={0}
          max={tl ? Math.round(tl.duration) : 1}
          step={10}
          value={tl ? Math.round(time) : 0}
          onChange={(e) => props.onSeek(Number(e.target.value))}
          disabled={!tl}
          aria-label="Timeline"
          className="h-2 min-w-0 flex-1 cursor-pointer accent-indigo-600"
        />
        <span className="hidden font-mono text-xs tabular-nums text-slate-500 sm:inline">
          {fmt(time)} / {fmt(tl?.duration ?? 0)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="flex items-center gap-0.5 rounded-xl bg-slate-100 p-1" role="group" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSettings({ speed: s })}
              className={`rounded-lg px-2 py-1 text-xs font-bold transition ${settings.speed === s ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              {s}×
            </button>
          ))}
        </div>
        <Toggle icon={Repeat} label="Loop" on={settings.loop} onClick={() => onSettings({ loop: !settings.loop })} />
        <Toggle icon={Crosshair} label="Guides" title="Show placement dots" on={settings.guides} onClick={() => onSettings({ guides: !settings.guides })} />
        <Toggle icon={Captions} label="Captions" on={settings.captions} onClick={() => onSettings({ captions: !settings.captions })} />
        <Toggle icon={FlipHorizontal2} label="Left hand" title="Mirror for a left-handed cuer" on={settings.mirrored} onClick={() => onSettings({ mirrored: !settings.mirrored })} />
        <Toggle
          icon={settings.voice ? Volume2 : VolumeX}
          label="Voice"
          title="Speak each word aloud as it is cued"
          on={settings.voice}
          onClick={() => onSettings({ voice: !settings.voice })}
        />
      </div>

      <details className="group border-t border-slate-100">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <Palette className="size-4 text-indigo-600" /> Customize avatar
          <ChevronDown className="ml-auto size-4 text-slate-400 transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
          <Swatches label="Skin tone" colors={SKIN_TONES.map((s) => s.base)} value={look.skin} onChange={(i) => onLook({ ...look, skin: i })} />
          <Swatches label="Hair color" colors={HAIR_COLORS} value={HAIR_COLORS.indexOf(look.hair)} onChange={(i) => onLook({ ...look, hair: HAIR_COLORS[i] })} />
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Hair style</div>
            <div className="flex flex-wrap gap-1.5">
              {HAIR_STYLES.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => onLook({ ...look, hairStyle: h.id })}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    look.hairStyle === h.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>
          <Swatches label="Shirt" colors={SHIRT_COLORS} value={SHIRT_COLORS.indexOf(look.shirt)} onChange={(i) => onLook({ ...look, shirt: SHIRT_COLORS[i] })} />
        </div>
      </details>
    </div>
  );
}
