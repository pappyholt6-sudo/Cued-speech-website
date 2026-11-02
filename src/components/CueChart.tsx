import { BookOpen } from "lucide-react";
import { type HandshapeId, HANDSHAPES, MOVEMENTS, PHONEMES, PLACEMENTS } from "../lib/cuedSpeech";
import { MiniFace, MiniHand, type SkinTone } from "./Hand";

interface Props {
  tone: SkinTone;
  activeHandshape: HandshapeId | null;
  activeVowel: string | null;
  onHandshape: (id: HandshapeId) => void;
  onVowel: (v: string) => void;
}

function VowelChip({ v, active, onClick }: { v: string; active: boolean; onClick: () => void }) {
  const info = PHONEMES[v];
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Demo /${info.label}/ (${info.ipa}) as in “${info.example}”`}
      className={`inline-flex items-baseline gap-1 rounded-lg px-2 py-1 text-sm transition ${
        active ? "bg-violet-600 text-white shadow-sm" : "bg-violet-50 text-violet-900 hover:bg-violet-100"
      }`}
    >
      <span className="font-semibold">/{info.label}/</span>
      <span className={`text-xs ${active ? "text-violet-100" : "text-violet-500"}`}>{info.example}</span>
    </button>
  );
}

export function CueChart({ tone, activeHandshape, activeVowel, onHandshape, onVowel }: Props) {
  return (
    <section id="chart" className="rounded-3xl bg-white/90 p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <BookOpen className="size-5 text-indigo-600" /> Cue chart · American English
      </h2>
      <p className="text-sm text-slate-500">Tap a handshape or a vowel to see the avatar show it.</p>

      <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">Consonants · 8 handshapes</h3>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {HANDSHAPES.map((h) => {
          const active = activeHandshape === h.id;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => onHandshape(h.id)}
              className={`group flex flex-col items-center rounded-2xl border p-3 text-center transition ${
                active
                  ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                  : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
              }`}
            >
              <span className="self-start grid size-6 place-items-center rounded-full bg-indigo-600 text-xs font-bold text-white">{h.id}</span>
              <MiniHand fingers={h.fingers} spread={h.spread} tone={tone} className="-mt-3 mb-1 h-20 w-16 transition group-hover:scale-105" />
              <div className="flex flex-wrap justify-center gap-1">
                {h.consonants.map((c) => (
                  <span
                    key={c}
                    title={`/${PHONEMES[c].ipa}/ as in “${PHONEMES[c].example}”`}
                    className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700"
                  >
                    {PHONEMES[c].label}
                  </span>
                ))}
              </div>
              <div className="mt-1.5 text-[11px] leading-tight text-slate-500">{h.name}</div>
              <div className="text-[11px] italic leading-tight text-indigo-500">“{h.keywords}”</div>
            </button>
          );
        })}
      </div>

      <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-500">Vowels · placements &amp; movements</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PLACEMENTS.map((p) => (
          <div key={p.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3">
            <MiniFace placement={p.id} className="size-16 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{p.name}</span>
                <span className="rounded bg-slate-100 px-1.5 font-mono text-xs text-slate-600">{p.letter}</span>
              </div>
              <div className="text-xs text-slate-500">{p.where}</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {p.vowels.length ? (
                  p.vowels.map((v) => <VowelChip key={v} v={v} active={activeVowel === v} onClick={() => onVowel(v)} />)
                ) : (
                  <span className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600">consonant with no vowel after it</span>
                )}
              </div>
            </div>
          </div>
        ))}
        {MOVEMENTS.map((m) => (
          <div key={m.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3">
            <MiniFace
              placement={m.placement}
              to={m.movement === "toThroat" ? "throat" : undefined}
              arrow={m.movement === "forward" ? "forward" : m.movement === "down" ? "down" : undefined}
              className="size-16 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{m.name}</span>
                <span className="rounded bg-slate-100 px-1.5 font-mono text-xs text-slate-600">{m.notation}</span>
              </div>
              <div className="text-xs text-slate-500">
                {m.movement === "toThroat"
                  ? "Glide that ends in handshape 5 at the throat"
                  : m.movement === "forward"
                    ? "Small flick forward from the side"
                    : "Small flick down from the side"}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {m.vowels.map((v) => (
                  <VowelChip key={v} v={v} active={activeVowel === v} onClick={() => onVowel(v)} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        A vowel with no consonant before it is cued with handshape 5. A consonant with no vowel after it is cued at the side. Words that look
        the same on the lips get different cues, so cues plus lipreading show every sound.
      </p>
    </section>
  );
}
