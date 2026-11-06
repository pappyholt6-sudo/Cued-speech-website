import { ListTree } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { HANDSHAPE_BY_ID, PHONEMES, placementName } from "../lib/cuedSpeech";
import type { Timeline, TimedCue } from "../lib/timeline";
import { MiniHand, type SkinTone } from "./Hand";

interface Props {
  timeline: Timeline | null;
  currentCue: number;
  tone: SkinTone;
  onSeekCue: (index: number) => void;
}

const SOURCE_BADGE: Record<string, { label: string; title: string; cls: string } | undefined> = {
  guess: { label: "guessed", title: "Not in the dictionary — pronunciation guessed from spelling", cls: "bg-amber-100 text-amber-800" },
  derived: { label: "derived", title: "Built from a known word (plural, -ing, compound…)", cls: "bg-sky-100 text-sky-800" },
  spelled: { label: "letter", title: "Spelled out letter by letter", cls: "bg-slate-100 text-slate-600" },
};

export function Breakdown({ timeline, currentCue, tone, onSeekCue }: Props) {
  const byWord = useMemo(() => {
    const groups: TimedCue[][] = [];
    if (!timeline) return groups;
    for (const tc of timeline.cues) (groups[tc.wordIndex] ??= []).push(tc);
    return groups;
  }, [timeline]);

  const currentWord = timeline && currentCue >= 0 ? timeline.cues[currentCue]?.wordIndex : -1;

  // keep the active word visible inside the scrollable list (without scrolling the page)
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = listRef.current;
    if (!box || currentWord == null || currentWord < 0) return;
    const card = box.querySelector<HTMLElement>(`[data-word="${currentWord}"]`);
    if (!card) return;
    const top = card.offsetTop;
    const bottom = top + card.offsetHeight;
    if (top < box.scrollTop || bottom > box.scrollTop + box.clientHeight) box.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
  }, [currentWord]);

  return (
    <section className="rounded-3xl bg-white/90 p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <ListTree className="size-5 text-indigo-600" /> Cue breakdown
        </h2>
        {timeline && (
          <span className="text-xs text-slate-500">
            {timeline.words.length} word{timeline.words.length === 1 ? "" : "s"} · {timeline.cues.length} cue{timeline.cues.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {!timeline || !timeline.words.length ? (
        <p className="mt-3 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Type or say something and press <b>Cue it</b>. Each word's sounds and cues will show up here.
        </p>
      ) : (
        <>
          <div ref={listRef} className="relative mt-3 flex max-h-[360px] flex-wrap gap-2.5 overflow-y-auto pr-1">
            {timeline.words.map((w, wi) => {
              const badge = SOURCE_BADGE[w.source];
              const activeWord = wi === currentWord;
              return (
                <div
                  key={wi}
                  data-word={wi}
                  className={`rounded-2xl border p-2.5 transition ${
                    activeWord ? "border-indigo-400 bg-indigo-50/80 shadow-sm" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-900">{w.display}</span>
                    {badge && (
                      <span title={badge.title} className={`rounded px-1.5 py-px text-[10px] font-semibold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  {w.phonemes.length > 0 && (
                    <div className="font-mono text-[11px] text-slate-500">/{w.phonemes.map((p) => PHONEMES[p]?.ipa ?? p).join("")}/</div>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(byWord[wi] ?? []).map((tc) => {
                      const hs = HANDSHAPE_BY_ID[tc.cue.handshape];
                      const active = tc.index === currentCue;
                      return (
                        <button
                          key={tc.index}
                          type="button"
                          onClick={() => onSeekCue(tc.index)}
                          title={`${tc.cue.sound || "—"}: handshape ${tc.cue.handshape}, ${placementName(tc.cue)}`}
                          className={`flex items-center gap-1 rounded-xl border px-1.5 py-1 text-left transition ${
                            active
                              ? "border-indigo-600 bg-indigo-600 text-white shadow"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300 hover:bg-white"
                          }`}
                        >
                          <MiniHand fingers={hs.fingers} spread={hs.spread} tone={tone} className="h-7 w-6" />
                          <span className="leading-tight">
                            <span className="block font-mono text-xs font-bold">{tc.cue.notation}</span>
                            <span className={`block text-[10px] ${active ? "text-indigo-100" : "text-slate-500"}`}>{tc.cue.sound}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            <b>Notation:</b> handshape number + placement — <span className="font-mono">s</span> side, <span className="font-mono">m</span> mouth,{" "}
            <span className="font-mono">c</span> chin, <span className="font-mono">t</span> throat, <span className="font-mono">sf</span> side-forward,{" "}
            <span className="font-mono">sd</span> side-down, <span className="font-mono">-5t</span> glide to 5 at the throat.
          </p>
        </>
      )}
    </section>
  );
}
