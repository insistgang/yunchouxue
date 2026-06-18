import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { prefersReducedMotion } from './reducedMotion';

export function useTrace(total: number, opts?: { onStep?: (i: number) => void }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);            // 0.25..4
  const timer = useRef<number | null>(null);

  const clamp = (n: number) => Math.max(0, Math.min(total - 1, n));
  const go = useCallback((n: number) => { const c = clamp(n); setI(c); opts?.onStep?.(c); }, [total]);
  const next = useCallback(() => go(i + 1), [i, go]);
  const prev = useCallback(() => go(i - 1), [i, go]);
  const reset = useCallback(() => { setPlaying(false); go(0); }, [go]);

  useEffect(() => {
    if (!playing) { if (timer.current) clearTimeout(timer.current); return; }
    if (i >= total - 1) { setPlaying(false); return; }
    if (prefersReducedMotion()) { go(total - 1); setPlaying(false); return; } // 直跳末帧
    const base = 900;
    timer.current = window.setTimeout(() => go(i + 1), base / speed);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [playing, i, speed, total, go]);

  // 键盘：空格播放/暂停、←→ 单步、+/- 调速（PRD 8.2）
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === '+' || e.key === '=') setSpeed(s => Math.min(4, s * 2));
      else if (e.key === '-') setSpeed(s => Math.max(0.25, s / 2));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [next, prev]);

  return { i, playing, speed, setSpeed, setPlaying, next, prev, reset, go };
}
