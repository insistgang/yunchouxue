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
  nodes: [{id:'A',x:60,y:120},{id:'B',x:220,y:60},{id:'C',x:220,y:180},{id:'D',x:380,y:120}],
  edges: [{from:'A',to:'B',w:1},{from:'A',to:'C',w:4},{from:'B',to:'C',w:-3},{from:'C',to:'D',w:1}],
};
const PRESETS: Record<string, { g: Graph; s: string; label: string; warn?: string }> = {
  textbook: { g: TEXTBOOK, s: 'A', label: '教科书小图（6 节点）' },
  negTrap: { g: NEG, s: 'A', label: '负权陷阱（Dijkstra 失效）',
    warn: '含负权边 B→C(-3)：Dijkstra 不保证正确——观察节点出堆"已确定"后又出现更短路却无法修正，应改用 Bellman-Ford。' },
};

const defaults: DemoState = { demo: 'dijkstra', params: { step: 0 }, step: 0 };
const init = typeof location !== 'undefined' ? decodeState(location.search, 'dijkstra', defaults) : defaults;

export default function DijkstraDemo() {
  const [preset, setPreset] = useState<keyof typeof PRESETS>('textbook');
  const { g, s, warn } = PRESETS[preset];
  const trace = useMemo(() => dijkstraTrace(g, s), [preset]);
  const t = useTrace(trace.frames.length, {
    onStep: (i) => {
      replaceUrl({ demo: 'dijkstra', params: { step: i }, step: i });
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
          setPreset((e.target as HTMLSelectElement).value as keyof typeof PRESETS);
          t.reset();
          replaceUrl({ demo: 'dijkstra', params: { step: 0 }, step: 0 });
        }}>
          {Object.entries(PRESETS).map(([k,v]) => <option value={k}>{v.label}</option>)}
        </select>
      </label>
      {warn && <p class="dj__warn" role="note">⚠ {warn}</p>}
      <svg role="img" aria-label={`最短路演示：${f.narration}`} viewBox="0 0 480 240" class="dj__svg">
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
            <circle r="18" fill="#fff" stroke={colorOf(n.id)} stroke-width="3" />
            <text dy="0.35em" text-anchor="middle" font-size="13" fill={COLORS.ink}>{n.id}</text>
            <text y="-26" text-anchor="middle" font-size="11" fill={COLORS.primary}>{f.dist[n.id] === Infinity ? '∞' : f.dist[n.id]}</text>
          </g>
        ))}
      </svg>
      <PlayControls i={t.i} total={trace.frames.length} playing={t.playing} speed={t.speed}
        onPrev={t.prev} onNext={t.next} onToggle={() => t.setPlaying(!t.playing)} onReset={t.reset} onSpeed={t.setSpeed} />
      <StatusLog text={f.narration} />
      <details class="dj__alt"><summary>等价文本视图（无障碍）</summary>
        <table><thead><tr><th>节点</th><th>dist</th><th>prev</th></tr></thead>
          <tbody>{g.nodes.map(n => <tr><td>{n.id}</td><td>{f.dist[n.id]===Infinity?'∞':f.dist[n.id]}</td><td>{f.prev[n.id]??'—'}</td></tr>)}</tbody>
        </table>
      </details>
      <style>{`.dj__svg{width:100%;background:var(--color-paper);border-radius:var(--radius-sm);}
        .dj__preset{display:block;margin:0 0 var(--space-2);color:var(--color-muted);font-size:var(--fs-caption);}
        .dj__warn{margin:var(--space-1) 0 var(--space-2);padding:var(--space-2) var(--space-3);background:color-mix(in srgb,var(--color-warning) 8%,transparent);border-left:4px solid var(--color-warning);border-radius:var(--radius-sm);font-size:var(--fs-caption);color:var(--color-body);}
        .dj__alt{margin-top:var(--space-2);color:var(--color-muted);font-size:var(--fs-caption);}
        .dj__alt table{border-collapse:collapse;} .dj__alt td,.dj__alt th{border:1px solid var(--gray-200);padding:2px 8px;}`}</style>
    </div>
  );
}
