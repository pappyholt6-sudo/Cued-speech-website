import { useCallback, useEffect, useRef, useState } from "react";
import type { Timeline } from "../lib/timeline";

/** Plays a cue timeline with requestAnimationFrame; speed scales the clock. */
export function useCuePlayer({ speed, loop, onEnd }: { speed: number; loop: boolean; onEnd?: () => void }) {
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timeRef = useRef(0);
  const tlRef = useRef<Timeline | null>(null);
  const speedRef = useRef(speed);
  const loopRef = useRef(loop);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    speedRef.current = speed;
    loopRef.current = loop;
    onEndRef.current = onEnd;
  });

  const load = useCallback((tl: Timeline, autoplay = true) => {
    tlRef.current = tl;
    timeRef.current = 0;
    setTimeline(tl);
    setTime(0);
    setPlaying(autoplay);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const tl = tlRef.current;
      if (!tl) return;
      const dt = Math.min(64, now - last) * speedRef.current;
      last = now;
      let t = timeRef.current + dt;
      if (t >= tl.duration) {
        if (loopRef.current) t = 0;
        else {
          timeRef.current = tl.duration;
          setTime(tl.duration);
          setPlaying(false);
          onEndRef.current?.();
          return;
        }
      }
      timeRef.current = t;
      setTime(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, timeline]);

  const play = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (timeRef.current >= tl.duration - 1) {
      timeRef.current = 0;
      setTime(0);
    }
    setPlaying(true);
  }, []);

  const pause = useCallback(() => setPlaying(false), []);

  const seek = useCallback((t: number) => {
    const tl = tlRef.current;
    if (!tl) return;
    const c = Math.max(0, Math.min(tl.duration, t));
    timeRef.current = c;
    setTime(c);
  }, []);

  return { timeline, time, playing, load, play, pause, seek };
}
