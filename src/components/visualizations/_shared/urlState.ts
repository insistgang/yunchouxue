export type DemoState = { demo: string; params: Record<string, number>; step: number };

export function encodeState(s: DemoState): string {
  const parts = [`demo=${s.demo}`];
  for (const [k, v] of Object.entries(s.params)) parts.push(`${k}=${v}`);
  parts.push(`step=${s.step}`);
  return parts.join('&');
}

export function decodeState(search: string, demo: string, defaults: DemoState): DemoState {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if ((q.get('demo') ?? demo) !== demo) return defaults;
  const params: Record<string, number> = {};
  for (const k of Object.keys(defaults.params)) {
    const raw = q.get(k);
    if (raw === null) { params[k] = defaults.params[k]; continue; }
    const n = Number(raw);
    if (!Number.isFinite(n)) return defaults;
    params[k] = n;
  }
  const step = Number(q.get('step') ?? defaults.step);
  if (!Number.isInteger(step) || step < 0) return defaults;
  return { demo, params, step };
}

export function replaceUrl(s: DemoState): void {
  if (typeof history === 'undefined') return;
  history.replaceState(null, '', `?${encodeState(s)}`);
}
