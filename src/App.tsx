import { Hand as HandIcon, Info, Lightbulb, MessageCircle, Mic, Sparkles, Square, Trash2, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type AvatarLook, HAIR_COLORS, SHIRT_COLORS } from "./components/Avatar";
import { Breakdown } from "./components/Breakdown";
import { CueChart } from "./components/CueChart";
import { SKIN_TONES } from "./components/Hand";
import { FloatingAvatar, type Settings, Stage } from "./components/Stage";
import { useCuePlayer } from "./hooks/useCuePlayer";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { type Cue, type HandshapeId, HANDSHAPE_BY_ID, makeCue, PHONEMES } from "./lib/cuedSpeech";
import { analyzeText, type CuedWord } from "./lib/g2p";
import { buildTimeline, cueHoldTime, cueIndexAt } from "./lib/timeline";

const PHRASES = [
  "Hello! Nice to meet you.",
  "How are you today?",
  "I love you.",
  "Thank you so much!",
  "What's your name?",
  "Let's go to the park.",
  "Good morning, sunshine!",
  "Can I have some water, please?",
];

const MAX_CHARS = 600;

const DEFAULT_SETTINGS: Settings = {
  speed: 1,
  loop: false,
  guides: true,
  captions: true,
  mirrored: false,
  voice: false,
  autoCue: true,
};
const DEFAULT_LOOK: AvatarLook = { skin: 1, hair: HAIR_COLORS[1], hairStyle: "short", shirt: SHIRT_COLORS[0] };

function loadSaved<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<T>) } : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export default function App() {
  const [text, setText] = useState(PHRASES[0]);
  const [settings, setSettings] = useState<Settings>(() => loadSaved("cuebuddy.settings", DEFAULT_SETTINGS));
  const [look, setLook] = useState<AvatarLook>(() => loadSaved("cuebuddy.look", DEFAULT_LOOK));
  useEffect(() => saveLocal("cuebuddy.settings", settings), [settings]);
  useEffect(() => saveLocal("cuebuddy.look", look), [look]);
  const [queued, setQueued] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const queueRef = useRef<string[]>([]);
  const loadTextRef = useRef<(t: string) => boolean>(() => false);

  const onSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);

  const { timeline: tl, time, playing, load, play, pause, seek } = useCuePlayer({
    speed: settings.speed,
    loop: settings.loop,
    onEnd: () => {
      const next = queueRef.current.shift();
      setQueued(queueRef.current.length);
      if (next) loadTextRef.current(next);
    },
  });

  const cueText = useCallback(
    (value: string) => {
      const words = analyzeText(value);
      if (!words.length) {
        setNotice("I couldn't find any words to cue in that text.");
        return false;
      }
      setNotice(null);
      load(buildTimeline(words));
      return true;
    },
    [load]
  );

  useEffect(() => {
    loadTextRef.current = cueText;
  }, [cueText]);

  // refs for callbacks that outlive a render
  const playingRef = useRef(playing);
  const autoCueRef = useRef(settings.autoCue);
  useEffect(() => {
    playingRef.current = playing;
    autoCueRef.current = settings.autoCue;
  });

  const speech = useSpeechRecognition({
    lang: "en-US",
    onFinal: (chunk) => {
      setText((prev) => ((prev.trim() ? prev.trim() + " " : "") + chunk).slice(-MAX_CHARS));
      if (!autoCueRef.current) return;
      if (playingRef.current) {
        queueRef.current.push(chunk);
        setQueued(queueRef.current.length);
      } else cueText(chunk);
    },
  });

  const toggleMic = () => {
    if (speech.listening) {
      speech.stop();
      return;
    }
    setText("");
    queueRef.current = [];
    setQueued(0);
    speech.start();
  };

  const cueNow = () => {
    queueRef.current = [];
    setQueued(0);
    cueText(text);
  };

  // playback position
  const currentCue = tl ? cueIndexAt(tl, time) : -1;
  const ended = !!tl && time >= tl.duration - 1;
  const activeTc = tl && currentCue >= 0 && !ended ? tl.cues[currentCue] : null;
  const wordIdx = activeTc ? activeTc.wordIndex : -1;

  const step = useCallback(
    (dir: -1 | 1) => {
      if (!tl || !tl.cues.length) return;
      pause();
      const idx = cueIndexAt(tl, time);
      const target =
        dir === 1
          ? Math.min(tl.cues.length - 1, idx + 1)
          : Math.max(0, idx >= 0 && time > cueHoldTime(tl.cues[idx]) + 1 ? idx : idx - 1);
      seek(cueHoldTime(tl.cues[target]));
    },
    [tl, time, pause, seek]
  );

  const seekCue = useCallback(
    (i: number) => {
      if (!tl) return;
      pause();
      seek(cueHoldTime(tl.cues[i]));
    },
    [tl, pause, seek]
  );

  const restart = () => {
    seek(0);
    play();
  };

  // chart demos
  const demo = useCallback(
    (cues: Cue[], label: string) => {
      const word: CuedWord = { display: label, phonemes: [], cues, source: "dictionary", sentenceEnd: true, question: false };
      load(buildTimeline([word], 2000));
    },
    [load]
  );
  const demoHandshape = (id: HandshapeId) => demo([makeCue(HANDSHAPE_BY_ID[id].consonants[0], null)], `Handshape ${id}`);
  const demoVowel = (v: string) => demo([makeCue(null, v)], `/${PHONEMES[v].label}/ as in “${PHONEMES[v].example}”`);

  // speak each word as it starts (optional)
  const spokenRef = useRef<{ tl: unknown; w: number }>({ tl: null, w: -1 });
  useEffect(() => {
    if (!settings.voice || !playing || !tl || wordIdx < 0 || speech.listening) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const s = spokenRef.current;
    if (s.tl === tl && s.w === wordIdx) return;
    spokenRef.current = { tl, w: wordIdx };
    const word = tl.words[wordIdx];
    if (!word || word.phonemes.length === 0) return;
    const u = new SpeechSynthesisUtterance(word.display);
    u.lang = "en-US";
    u.rate = Math.min(1.8, Math.max(0.7, settings.speed * 1.05));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, [settings.voice, settings.speed, playing, tl, wordIdx, speech.listening]);

  // space bar toggles playback
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.code !== "Space" || !el || /^(INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY)$/.test(el.tagName) || el.isContentEditable) return;
      e.preventDefault();
      if (playingRef.current) pause();
      else play();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play, pause]);

  // show a floating mini avatar when the main stage scrolls out of view
  const avatarRef = useRef<HTMLDivElement>(null);
  const [stageVisible, setStageVisible] = useState(true);
  useEffect(() => {
    const el = avatarRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setStageVisible(entry.intersectionRatio > 0.35), {
      threshold: [0, 0.2, 0.35, 0.5, 1],
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // greet on first load
  useEffect(() => {
    const id = window.setTimeout(() => loadTextRef.current(PHRASES[0]), 450);
    return () => window.clearTimeout(id);
  }, []);

  const tone = SKIN_TONES[look.skin] ?? SKIN_TONES[1];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-sky-50 text-slate-800">
      <header className="mx-auto flex max-w-7xl items-center gap-3 px-4 pb-2 pt-6 sm:px-6">
        <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30">
          <HandIcon className="size-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">CueBuddy</h1>
          <p className="truncate text-sm text-slate-500">Type or talk, then watch it cued in American English Cued Speech</p>
        </div>
        <nav className="ml-auto hidden gap-1 sm:flex">
          <a href="#chart" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:shadow-sm">
            Cue chart
          </a>
          <a href="#about" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:shadow-sm">
            About
          </a>
        </nav>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Stage
            timeline={tl}
            time={time}
            playing={playing}
            currentCue={currentCue}
            settings={settings}
            onSettings={onSettings}
            look={look}
            onLook={setLook}
            onPlay={play}
            onPause={pause}
            onSeek={(t) => {
              pause();
              seek(t);
            }}
            onStep={step}
            onRestart={restart}
            listening={speech.listening}
            interim={speech.interim}
            avatarRef={avatarRef}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section className="rounded-3xl bg-white/90 p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <MessageCircle className="size-5 text-indigo-600" /> What should I cue?
            </h2>
            <div className="relative mt-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    cueNow();
                  }
                }}
                rows={4}
                placeholder={speech.listening ? "Listening… what you say shows up here" : "Type something to cue, like “See you later!”"}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 pb-7 text-base leading-relaxed shadow-inner outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                aria-label="Text to cue"
              />
              <span className="pointer-events-none absolute bottom-3 right-4 text-[11px] text-slate-400">
                {text.length}/{MAX_CHARS}
              </span>
            </div>
            {speech.listening && speech.interim && <p className="mt-2 text-sm italic text-slate-500">“{speech.interim}…”</p>}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={cueNow}
                disabled={!text.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles className="size-4" /> Cue it
              </button>
              <button
                type="button"
                onClick={toggleMic}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold transition ${
                  speech.listening
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/30 hover:bg-rose-700"
                    : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300"
                }`}
              >
                {speech.listening ? (
                  <>
                    <Square className="size-4 fill-current" /> Stop
                  </>
                ) : (
                  <>
                    <Mic className="size-4" /> Talk
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setText("")}
                disabled={!text}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
              >
                <Trash2 className="size-4" /> Clear
              </button>
              <label className="ml-auto flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={settings.autoCue}
                  onChange={(e) => onSettings({ autoCue: e.target.checked })}
                  className="size-4 accent-indigo-600"
                />
                Auto-cue speech
              </label>
            </div>

            {queued > 0 && (
              <p className="mt-2 text-xs font-medium text-indigo-600">
                {queued} more phrase{queued === 1 ? "" : "s"} waiting to be cued…
              </p>
            )}
            {(speech.error || notice) && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-100">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>{speech.error ?? notice}</span>
              </div>
            )}
            {!speech.supported && (
              <p className="mt-2 text-xs text-slate-500">Voice input works in Chrome, Edge and Safari. You can still type anything.</p>
            )}

            <div className="mt-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Try a phrase</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {PHRASES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setText(p);
                      queueRef.current = [];
                      setQueued(0);
                      cueText(p);
                    }}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-indigo-100 hover:text-indigo-800"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-4 hidden text-[11px] text-slate-400 sm:block">
              Shortcuts: <kbd className="rounded border border-slate-200 bg-slate-50 px-1">Ctrl/⌘ + Enter</kbd> to cue ·{" "}
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1">Space</kbd> to play/pause
            </p>
          </section>

          <Breakdown timeline={tl} currentCue={ended ? -1 : currentCue} tone={tone} onSeekCue={seekCue} />
        </div>
      </main>

      <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6">
        <CueChart
          tone={tone}
          activeHandshape={activeTc ? activeTc.cue.handshape : null}
          activeVowel={activeTc ? activeTc.cue.vowel : null}
          onHandshape={demoHandshape}
          onVowel={demoVowel}
        />
      </div>

      <section id="about" className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:px-6 md:grid-cols-3">
        <div className="rounded-3xl bg-white/80 p-5 ring-1 ring-slate-200">
          <h3 className="flex items-center gap-2 font-bold text-slate-900">
            <Info className="size-4 text-indigo-600" /> What is Cued Speech?
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Cued Speech is a visual way to show spoken language. Dr. R. Orin Cornett created it in 1966. Eight handshapes show consonants and four
            places near the face show vowels. Together with the mouth movements of speech, they make every sound visible, even ones that look
            the same on the lips.
          </p>
        </div>
        <div className="rounded-3xl bg-white/80 p-5 ring-1 ring-slate-200">
          <h3 className="flex items-center gap-2 font-bold text-slate-900">
            <Sparkles className="size-4 text-indigo-600" /> How CueBuddy works
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Your words are turned into sounds using the CMU Pronouncing Dictionary (General American English). The sounds are grouped into
            consonant–vowel pairs, and each pair becomes one cue: the consonant's handshape at the vowel's placement. The avatar moves its mouth
            too, because cues are meant to be read together with the lips.
          </p>
        </div>
        <div className="rounded-3xl bg-white/80 p-5 ring-1 ring-slate-200">
          <h3 className="flex items-center gap-2 font-bold text-slate-900">
            <Lightbulb className="size-4 text-indigo-600" /> Good to know
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Pronunciation changes with accent. Names and new words are guessed from their spelling and marked “guessed”. CueBuddy is for
            learning and practice. It doesn't replace a trained cuer or transliterator. To learn more, visit the{" "}
            <a href="https://cuedspeech.org" target="_blank" rel="noreferrer" className="font-medium text-indigo-600 underline-offset-2 hover:underline">
              National Cued Speech Association
            </a>
            .
          </p>
        </div>
      </section>

      <footer className="pb-8 text-center text-xs text-slate-400">CueBuddy · An American English Cued Speech practice avatar</footer>

      {!stageVisible && tl && !ended && (
        <FloatingAvatar
          timeline={tl}
          time={time}
          currentCue={currentCue}
          look={look}
          mirrored={settings.mirrored}
          onClick={() => avatarRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
        />
      )}
    </div>
  );
}
