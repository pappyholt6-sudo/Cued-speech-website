import { useCallback, useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type RecognitionCtor = new () => any;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as RecognitionCtor | null;
}

const ERROR_TEXT: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow the mic in your browser's site settings and try again.",
  "service-not-allowed": "Speech recognition isn't allowed here. Try Chrome, Edge or Safari, or open the page in its own tab.",
  "audio-capture": "No microphone was found. Check that one is connected.",
  network: "Speech recognition needs an internet connection.",
  "language-not-supported": "This language isn't supported for speech recognition.",
};

export function useSpeechRecognition({ lang = "en-US", onFinal }: { lang?: string; onFinal: (text: string) => void }) {
  const [supported] = useState(() => getCtor() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const wantRef = useRef(false);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  });

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setError("Speech recognition isn't available in this browser. Try Chrome, Edge or Safari, or just type.");
      return;
    }
    setError(null);
    try {
      recRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = String(r[0]?.transcript ?? "");
        if (r.isFinal) {
          const clean = txt.trim();
          if (clean) onFinalRef.current(clean);
        } else interimText += txt;
      }
      setInterim(interimText.trim());
    };
    rec.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      wantRef.current = false;
      setError(ERROR_TEXT[e.error] ?? `Speech recognition error: ${e.error}`);
    };
    rec.onend = () => {
      if (wantRef.current) {
        try {
          rec.start(); // keep listening through pauses
          return;
        } catch {
          /* fall through */
        }
      }
      wantRef.current = false;
      setListening(false);
      setInterim("");
    };
    recRef.current = rec;
    wantRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      wantRef.current = false;
      setError("Couldn't start the microphone.");
    }
  }, [lang]);

  const stop = useCallback(() => {
    wantRef.current = false;
    try {
      recRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    setListening(false);
    setInterim("");
  }, []);

  useEffect(
    () => () => {
      wantRef.current = false;
      try {
        recRef.current?.abort?.();
      } catch {
        /* ignore */
      }
    },
    []
  );

  return { supported, listening, interim, error, start, stop, clearError: () => setError(null) };
}
