import { useEffect, useMemo, useState } from 'preact/hooks';
import { dijkstraTrace, type Graph } from '@/lib/dijkstra';
import { useTrace } from './_shared/useTrace';
import PlayControls from './_shared/PlayControls';
import StatusLog from './_shared/StatusLog';
import { COLORS } from './_shared/colorTokens';
import { decodeState, replaceUrl, type DemoState } from './_shared/urlState';

const TEXTBOOK: Graph = {
  directed: false,
  nodes: [
    {id:'A',x:60,y:120},{id:'B',x:180,y:60},{id:'C',x:180,y:180},
    {id:'D',x:300,y:60},{id:'E',x:300,y:180},{id:'F',x:420,y:120},
  ],
  edges: [
    {from:'A',to:'B',w:2},{from:'A',to:'C',w:4},{from:'B',to:'C',w:1},
    {from:'B',to:'D',w:7},{from:'C',to:'E',w:3},{from:'D',to:'F',w:1},
    {from:'E',to:'D',w:2},{from:'E',to:'F',w:5},
  ],
};
const NEG: Graph = {
  directed: true,
  nodes: [{id:'A',x:60,y:120},{id:'B',x:220,y:70},{id:'C',x:220,y:170},{id:'D',x:380,y:120}],
  edges: [{from:'A',to:'B',w:1},{from:'A',to:'C',w:2},{from:'C',to:'B',w:-2},{from:'B',to:'D',w:3}],
};
// 5×5 grid map — nodes are spaced 80px apart starting at (50,50).
// High-cost zone: edges whose both endpoints lie within the 3×3 interior node block
// (rows 1-3 AND cols 1-3) get weight 15; all other edges get weight 1.
// This forces the shortest path from corner 0,0 to skirt around the expensive center.
const GRID_SIZE = 5;
const GRID_CELL = 80;
const GRID_OFFSET_X = 50;
const GRID_OFFSET_Y = 50;

function makeGrid(): Graph {
  const nodes: Graph['nodes'] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      nodes.push({ id: `${r},${c}`, x: GRID_OFFSET_X + c * GRID_CELL, y: GRID_OFFSET_Y + r * GRID_CELL });
    }
  }
  const edges: Graph['edges'] = [];
  const isHighCost = (r1: number, c1: number, r2: number, c2: number) =>
    Math.min(r1,r2) >= 1 && Math.max(r1,r2) <= 3 &&
    Math.min(c1,c2) >= 1 && Math.max(c1,c2) <= 3;

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (c + 1 < GRID_SIZE) {
        const w = isHighCost(r, c, r, c + 1) ? 15 : 1;
        edges.push({ from: `${r},${c}`, to: `${r},${c+1}`, w });
      }
      if (r + 1 < GRID_SIZE) {
        const w = isHighCost(r, c, r + 1, c) ? 15 : 1;
        edges.push({ from: `${r},${c}`, to: `${r+1},${c}`, w });
      }
    }
  }
  return { directed: false, nodes, edges };
}
const GRID: Graph = makeGrid();
const PRESETS: Record<string, {
  g: Graph; s: string; label: string; warn?: string;
  viewBox?: string; nodeR?: number; nodeFontSize?: number; distFontSize?: number; distLabelY?: number;
}> = {
  textbook: { g: TEXTBOOK, s: 'A', label: '教科书小图（6 节点）' },
  negTrap: { g: NEG, s: 'A', label: '负权陷阱（Dijkstra 失效）',
    warn: '负权边 C→B(-2) 本可让 B 的最短距离降到 0（路径 A→C→B=2+(-2)=0），但 Dijkstra 先以 dist[B]=1 将 B "确定"，随后松弛 C→B 时因 B 已确定而被跳过，故给出错误的 dist[B]=1，B→D 随之偏大。负权图应改用 Bellman-Ford。' },
  grid: { g: GRID, s: '0,0', label: '网格地图（5×5，绕开高代价区）', viewBox: '0 0 420 420', nodeR: 13, nodeFontSize: 8, distFontSize: 9, distLabelY: -18 },
};

const PRESET_KEYS = Object.keys(PRESETS) as Array<keyof typeof PRESETS>;

const defaults: DemoState = { demo: 'dijkstra', params: { preset: 0 }, step: 0 };
const init = typeof location !== 'undefined' ? decodeState(location.search, 'dijkstra', defaults) : defaults;

export default function DijkstraDemo() {
  const initPresetIdx = Math.min(Math.max(0, Math.round(init.params.preset ?? 0)), PRESET_KEYS.length - 1);
  const [preset, setPreset] = useState<keyof typeof PRESETS>(PRESET_KEYS[initPresetIdx]);
  const { g, s, warn, viewBox: presetViewBox, nodeR = 18, nodeFontSize = 13, distFontSize = 11, distLabelY = -26 } = PRESETS[preset];
  const trace = useMemo(() => dijkstraTrace(g, s), [g, s]);
  const t = useTrace(trace.frames.length, {
    onStep: (i) => {
      const pidx = PRESET_KEYS.indexOf(preset as string);
      replaceUrl({ demo: 'dijkstra', params: { preset: pidx }, step: i });
    },
  });

  // Apply URL-initialized step on first render (clamp to valid range)
  useEffect(() => {
    const urlStep = Math.min(Math.max(0, init.step), trace.frames.length - 1);
    if (urlStep > 0) t.go(urlStep);
  }, []);

  const f = trace.frames[t.i];
  const colorOf = (id: string) =>
    f.settled.includes(id) ? COLORS.success : id === f.current ? COLORS.accent
    : f.queue.includes(id) ? COLORS.primary : COLORS.gray400;
  return (
    <div class="dj">
      <label class="dj__preset">预设
        <select value={preset} onChange={(e) => {
          const key = (e.target as HTMLSelectElement).value as keyof typeof PRESETS;
          setPreset(key);
          t.reset();
          const pidx = PRESET_KEYS.indexOf(key as string);
          replaceUrl({ demo: 'dijkstra', params: { preset: pidx }, step: 0 });
        }}>
          {Object.entries(PRESETS).map(([k,v]) => <option value={k}>{v.label}</option>)}
        </select>
      </label>
      {warn && <p class="dj__warn" role="note">⚠ {warn}</p>}
      <div class="dj__layout">
        <svg role="img" aria-label={`最短路演示：${f.narration}`}
          viewBox={presetViewBox ?? '0 0 480 240'}
          class={`dj__svg${preset === 'grid' ? ' dj__svg--grid' : ''}`}>
          {g.edges.map(e => {
            const a = g.nodes.find(n => n.id === e.from)!, b = g.nodes.find(n => n.id === e.to)!;
            const hot = f.relaxing && f.relaxing.edge.from === e.from && f.relaxing.edge.to === e.to;
            return <g>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hot ? COLORS.accent : COLORS.gray300} stroke-width={hot ? 3 : 1.5} />
              <text x={(a.x+b.x)/2} y={(a.y+b.y)/2 - 4} text-anchor="middle" font-size="11" fill={COLORS.muted}>{e.w}</text>
            </g>;
          })}
          {g.nodes.map(n => (
            <g transform={`translate(${n.x},${n.y})`}>
              <circle r={nodeR} fill="#fff" stroke={colorOf(n.id)} stroke-width="3" />
              <text dy="0.35em" text-anchor="middle" font-size={nodeFontSize} fill={COLORS.ink}>{n.id}</text>
              <text y={distLabelY} text-anchor="middle" font-size={distFontSize} fill={COLORS.primary}>{f.dist[n.id] === Infinity ? '∞' : f.dist[n.id]}</text>
            </g>
          ))}
        </svg>
        <div class="dj__table-wrap" aria-label="dist/prev 实时表格" role="region" aria-live="polite">
          <table class="dj__table">
            <thead><tr><th>节点</th><th>dist</th><th>prev</th></tr></thead>
            <tbody>
              {g.nodes.map(n => {
                const hi = n.id === f.current || (f.relaxing != null && f.relaxing.edge.to === n.id);
                return (
                  <tr class={hi ? 'dj__table-row--active' : ''} key={n.id}>
                    <td>{n.id}</td>
                    <td>{f.dist[n.id] === Infinity ? '∞' : f.dist[n.id]}</td>
                    <td>{f.prev[n.id] ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <PlayControls i={t.i} total={trace.frames.length} playing={t.playing} speed={t.speed}
        onPrev={t.prev} onNext={t.next} onToggle={() => t.setPlaying(!t.playing)} onReset={t.reset} onSpeed={t.setSpeed} />
      <StatusLog text={f.narration} />
      <style>{`.dj__layout{display:flex;gap:var(--space-4);align-items:flex-start;flex-wrap:wrap;}
        .dj__svg{flex:1 1 280px;min-width:0;width:100%;background:var(--demo-canvas);border-radius:var(--radius-sm);}
        .dj__svg--grid{max-height:480px;}
        .dj__preset{display:block;margin:0 0 var(--space-2);color:var(--color-muted);font-size:var(--fs-caption);}
        .dj__warn{margin:var(--space-1) 0 var(--space-2);padding:var(--space-2) var(--space-3);background:color-mix(in srgb,var(--color-warning) 8%,transparent);border-left:4px solid var(--color-warning);border-radius:var(--radius-sm);font-size:var(--fs-caption);color:var(--color-body);}
        .dj__table-wrap{flex:0 0 auto;overflow-x:auto;}
        .dj__table{border-collapse:collapse;font-size:var(--fs-caption);white-space:nowrap;}
        .dj__table th,.dj__table td{border:1px solid var(--gray-200);padding:3px 10px;text-align:center;}
        .dj__table th{background:var(--gray-100,#f7fafc);color:var(--color-muted);}
        .dj__table-row--active td{background:color-mix(in srgb,var(--color-accent,#B45309) 12%,transparent);font-weight:600;}`}</style>
    </div>
  );
}
