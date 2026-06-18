import type { JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { edmondsKarpTrace, type FlowNetwork } from '@/lib/maxflow';
import { useTrace } from './_shared/useTrace';
import PlayControls from './_shared/PlayControls';
import StatusLog from './_shared/StatusLog';
import { COLORS } from './_shared/colorTokens';
import { decodeState, replaceUrl, type DemoState } from './_shared/urlState';

const CLASSIC: FlowNetwork = {
  source:'s', sink:'t',
  nodes:[{id:'s',x:40,y:120},{id:'a',x:180,y:50},{id:'b',x:180,y:190},{id:'c',x:320,y:50},{id:'d',x:320,y:190},{id:'t',x:460,y:120}],
  edges:[{from:'s',to:'a',cap:10},{from:'s',to:'b',cap:8},{from:'a',to:'c',cap:6},{from:'a',to:'b',cap:2},
    {from:'b',to:'d',cap:9},{from:'c',to:'t',cap:8},{from:'d',to:'c',cap:3},{from:'d',to:'t',cap:7}],
};
const REVERSE: FlowNetwork = {
  source:'s', sink:'t',
  nodes:[{id:'s',x:40,y:120},{id:'u',x:230,y:60},{id:'v',x:230,y:180},{id:'t',x:420,y:120}],
  edges:[{from:'s',to:'u',cap:3},{from:'s',to:'v',cap:2},{from:'u',to:'v',cap:3},{from:'u',to:'t',cap:2},{from:'v',to:'t',cap:3}],
};
const SYMMETRIC: FlowNetwork = {
  source:'s', sink:'t',
  nodes:[
    {id:'s',x:40, y:120},
    {id:'u',x:220,y:60 },
    {id:'v',x:220,y:180},
    {id:'t',x:400,y:120},
  ],
  edges:[
    {from:'s',to:'u',cap:3},
    {from:'s',to:'v',cap:3},
    {from:'u',to:'v',cap:1},
    {from:'u',to:'t',cap:3},
    {from:'v',to:'t',cap:3},
  ],
};
const PRESETS: Record<string,{net:FlowNetwork;label:string}> = {
  classic:   { net: CLASSIC,   label:'教学经典网（6 节点）' },
  reverse:   { net: REVERSE,   label:'反向边救场网（需反向边撤回）' },
  symmetric: { net: SYMMETRIC, label:'对称瓶颈网（两个等值最小割）' },
};

const PRESET_KEYS_MF = Object.keys(PRESETS) as Array<keyof typeof PRESETS>;

const defaults: DemoState = { demo: 'maxflow', params: { preset: 0 }, step: 0 };
const init = typeof location !== 'undefined' ? decodeState(location.search, 'maxflow', defaults) : defaults;

type ViewMode = 'original' | 'residual' | 'sidebyside';

const PSEUDO_LINES = [
  'Edmonds-Karp(G, s, t):',
  '  初始化所有流 f(u,v) = 0',
  '  while BFS(残余网络, s→t) 找增广路:',
  '    Δ = min{ cf(e) : e ∈ P }',
  '    for each (u,v) ∈ P:',
  '      f(u,v) += Δ;  f(v,u) -= Δ',
  '      cf(u,v) -= Δ; cf(v,u) += Δ',
  '  return f  ← 无增广路，最优',
  '  S = BFS可达(残余图, s) → 最小割',
];

function getActiveLines(phase: string, narration: string): Set<number> {
  if (phase === 'bfs') return new Set([2]);
  if (phase === 'augment') {
    if (narration.includes('瓶颈') || narration.includes('找到增广路')) return new Set([3, 4]);
    if (narration.includes('推送')) return new Set([5, 6]);
  }
  if (phase === 'optimal') return new Set([7, 8]);
  return new Set();
}

function phaseLabel(phase: string): string {
  if (phase === 'bfs') return '阶段：BFS 搜索增广路';
  if (phase === 'augment') return '阶段：沿增广路更新流';
  if (phase === 'optimal') return '阶段：已找到最大流';
  return '';
}

/** Compute perpendicular offset vector (normalized, scaled by d) */
function perpOffset(ax: number, ay: number, bx: number, by: number, d: number): [number, number] {
  const dx = bx - ax, dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return [-dy / len * d, dx / len * d];
}

/** Shorten a line segment by `amt` pixels at each end */
function shortenLine(ax: number, ay: number, bx: number, by: number, amt: number): [number, number, number, number] {
  const dx = bx - ax, dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len, uy = dy / len;
  return [ax + ux * amt, ay + uy * amt, bx - ux * amt, by - uy * amt];
}

export default function MaxflowDemo() {
  const initPresetIdxMF = Math.min(Math.max(0, Math.round(init.params.preset ?? 0)), PRESET_KEYS_MF.length - 1);
  const [preset, setPreset] = useState<keyof typeof PRESETS>(PRESET_KEYS_MF[initPresetIdxMF]);
  const [viewMode, setViewMode] = useState<ViewMode>('original');
  const { net } = PRESETS[preset];
  const trace = useMemo(() => edmondsKarpTrace(net), [preset]);
  const t = useTrace(trace.frames.length, {
    onStep: (i) => {
      const pidx = PRESET_KEYS_MF.indexOf(preset as string);
      replaceUrl({ demo: 'maxflow', params: { preset: pidx }, step: i });
    },
  });

  // Apply URL-initialized step on first render
  useEffect(() => {
    const urlStep = Math.min(Math.max(0, init.step), trace.frames.length - 1);
    if (urlStep > 0) t.go(urlStep);
  }, []);

  const f = trace.frames[t.i];
  const inPath = (u:string,v:string) => f.augmentPath?.some((n,i)=> n===u && f.augmentPath![i+1]===v) ?? false;
  const inCut = (u:string,v:string) => f.minCut?.edges.some(e=>e.from===u&&e.to===v) ?? false;

  const activeLines = getActiveLines(f.phase, f.narration);

  /** Render the original network SVG */
  function OriginalSVG() {
    return (
      <svg role="img" aria-label={`最大流演示：${f.narration}`} viewBox="0 0 500 240" class="mf__svg">
        <defs>
          <marker id="arrow-orig" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L7,3 L0,6 Z" fill={COLORS.gray400}/>
          </marker>
        </defs>
        {net.edges.map(e => {
          const a = net.nodes.find(n=>n.id===e.from)!, b = net.nodes.find(n=>n.id===e.to)!;
          const cut = inCut(e.from,e.to), path = inPath(e.from,e.to);
          const stroke = cut ? COLORS.success : path ? COLORS.accent : COLORS.gray300;
          const [x1,y1,x2,y2] = shortenLine(a.x, a.y, b.x, b.y, 18);
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          return (
            <g key={`orig-${e.from}-${e.to}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} stroke-width={cut||path?3:1.5} marker-end="url(#arrow-orig)"/>
              <text x={mx} y={my - 4} text-anchor="middle" font-size="10" fill={COLORS.muted}>
                {f.flow[`${e.from}->${e.to}`]??0}/{e.cap}
              </text>
            </g>
          );
        })}
        {net.nodes.map(n => {
          const isS = f.minCut?.S.includes(n.id);
          return (
            <g key={`orig-node-${n.id}`} transform={`translate(${n.x},${n.y})`}>
              <circle r="16" fill={f.minCut ? (isS?COLORS.success:'#fff') : (f.bfsVisited.includes(n.id)?COLORS.accent:'#fff')} fill-opacity={f.minCut&&isS?0.15:1} stroke={COLORS.primary} stroke-width="2"/>
              <text dy="0.35em" text-anchor="middle" font-size="12" fill={COLORS.ink}>{n.id}</text>
            </g>
          );
        })}
      </svg>
    );
  }

  /** Render the residual network SVG */
  function ResidualSVG() {
    return (
      <svg role="img" aria-label={`残余网络：${f.narration}`} viewBox="0 0 500 240" class="mf__svg">
        <defs>
          <marker id="arrow-res" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L7,3 L0,6 Z" fill={COLORS.primary}/>
          </marker>
          <marker id="arrow-dashed" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L7,3 L0,6 Z" fill={COLORS.warning}/>
          </marker>
        </defs>
        {net.edges.map(e => {
          const a = net.nodes.find(n=>n.id===e.from)!, b = net.nodes.find(n=>n.id===e.to)!;
          const fwdCap = f.residual[`${e.from}->${e.to}`] ?? 0;
          const bwdCap = f.residual[`${e.to}->${e.from}`] ?? 0;
          const [ox, oy] = perpOffset(a.x, a.y, b.x, b.y, 5);
          const elements: JSX.Element[] = [];

          if (fwdCap > 0) {
            const [x1,y1,x2,y2] = shortenLine(a.x + ox, a.y + oy, b.x + ox, b.y + oy, 18);
            const inAugPath = inPath(e.from, e.to);
            const inMinCut = inCut(e.from, e.to);
            const stroke = inAugPath ? COLORS.accent : inMinCut ? COLORS.success : COLORS.primary;
            const mx = (a.x + ox + b.x + ox) / 2, my = (a.y + oy + b.y + oy) / 2;
            elements.push(
              <g key={`res-fwd-${e.from}-${e.to}`}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} stroke-width={inAugPath||inMinCut?3:1.5} marker-end="url(#arrow-res)"/>
                <text x={mx} y={my - 4} text-anchor="middle" font-size="10" fill={stroke}>{fwdCap}</text>
              </g>
            );
          }

          if (bwdCap > 0) {
            const [x1,y1,x2,y2] = shortenLine(b.x - ox, b.y - oy, a.x - ox, a.y - oy, 18);
            const mx = (b.x - ox + a.x - ox) / 2, my = (b.y - oy + a.y - oy) / 2;
            elements.push(
              <g key={`res-bwd-${e.from}-${e.to}`}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLORS.warning} stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#arrow-dashed)"/>
                <text x={mx} y={my - 4} text-anchor="middle" font-size="10" fill={COLORS.warning}>{bwdCap}</text>
              </g>
            );
          }

          return <>{elements}</>;
        })}
        {net.nodes.map(n => {
          const isS = f.minCut?.S.includes(n.id);
          return (
            <g key={`res-node-${n.id}`} transform={`translate(${n.x},${n.y})`}>
              <circle r="16" fill={f.minCut ? (isS?COLORS.success:'#fff') : (f.bfsVisited.includes(n.id)?COLORS.accent:'#fff')} fill-opacity={f.minCut&&isS?0.15:1} stroke={COLORS.primary} stroke-width="2"/>
              <text dy="0.35em" text-anchor="middle" font-size="12" fill={COLORS.ink}>{n.id}</text>
            </g>
          );
        })}
      </svg>
    );
  }

  const showOriginal = viewMode !== 'residual';
  const showResidual = viewMode !== 'original';
  const isSideBySide = viewMode === 'sidebyside';

  return (
    <div class="mf">
      <label class="mf__preset">预设
        <select value={preset} onChange={(e) => {
          const key = (e.target as HTMLSelectElement).value as keyof typeof PRESETS;
          setPreset(key);
          t.reset();
          const pidx = PRESET_KEYS_MF.indexOf(key as string);
          replaceUrl({ demo: 'maxflow', params: { preset: pidx }, step: 0 });
        }}>
          {Object.entries(PRESETS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </label>
      <label class="mf__viewmode">视图
        <select value={viewMode} onChange={(e) => setViewMode((e.target as HTMLSelectElement).value as ViewMode)}>
          <option value="original">原始网络</option>
          <option value="residual">残余网络</option>
          <option value="sidebyside">并排对比</option>
        </select>
      </label>

      <div class="mf__body">
        <div class="mf__main">
          <div class={`mf__views mf__views--${viewMode}`}>
            {showOriginal && (
              <div class="mf__view-wrap">
                {isSideBySide && <p class="mf__view-label">原始网络</p>}
                <OriginalSVG />
              </div>
            )}
            {showResidual && (
              <div class="mf__view-wrap">
                {isSideBySide && <p class="mf__view-label">残余网络 — <span style={`color:${COLORS.primary}`}>正向</span> <span style={`color:${COLORS.warning}`}>--- 反向</span></p>}
                <ResidualSVG />
              </div>
            )}
          </div>
          <p class="mf__val">当前最大流 |f| = <b>{f.value}</b></p>
          <PlayControls i={t.i} total={trace.frames.length} playing={t.playing} speed={t.speed}
            onPrev={t.prev} onNext={t.next} onToggle={() => t.setPlaying(!t.playing)} onReset={t.reset} onSpeed={t.setSpeed} />
          <StatusLog text={f.narration} />
          {/* 等价文本视图（DoD#6/PRD 8.5 无障碍可达） */}
          <details class="mf__alt">
            <summary>等价文本视图（无障碍）</summary>
            <p>当前步进解说：{f.narration}</p>
            <p>当前最大流 |f| = {f.value}</p>
            {f.augmentPath && <p>增广路径：{f.augmentPath.join(' → ')}</p>}
            {f.minCut && <p>最小割：S={f.minCut.S.join(',')} / T={f.minCut.T.join(',')}</p>}
          </details>
        </div>

        <div class="mf__pseudo">
          <p class="mf__pseudo-title">算法伪代码</p>
          <pre class="mf__pseudo-pre">
            {PSEUDO_LINES.map((line, i) => (
              <div key={i} class={`mf__pseudo-line${activeLines.has(i) ? ' mf__pseudo-line--active' : ''}`}>{line}</div>
            ))}
          </pre>
          <p class="mf__pseudo-phase">{phaseLabel(f.phase)}</p>
        </div>
      </div>

      <style>{`
        .mf__svg{width:100%;background:var(--demo-canvas);border-radius:var(--radius-sm);}
        .mf__val{color:var(--color-body);font-size:var(--fs-caption);}
        .mf__preset{display:block;margin:0 0 var(--space-2);color:var(--color-muted);font-size:var(--fs-caption);}
        .mf__alt{margin-top:var(--space-3);font-size:var(--fs-caption);color:var(--color-muted);}
        .mf__alt summary{cursor:pointer;color:var(--color-primary);}
        .mf__body{display:flex;gap:var(--space-4);align-items:flex-start;}
        .mf__main{flex:1;min-width:0;}
        .mf__pseudo{width:240px;flex-shrink:0;background:var(--color-surface,#f8f9fa);border-radius:var(--radius-sm);padding:var(--space-3);}
        .mf__pseudo-title{font-size:var(--fs-caption);font-weight:600;color:var(--color-body);margin:0 0 var(--space-2);}
        .mf__pseudo-pre{margin:0;font-size:11px;line-height:1.6;font-family:var(--font-mono,'ui-monospace',monospace);overflow-x:auto;}
        .mf__pseudo-line{padding:1px 4px;border-radius:2px;white-space:pre;color:var(--color-muted);}
        .mf__pseudo-line--active{background:rgba(180,83,9,0.12);color:var(--color-body);font-weight:600;}
        .mf__pseudo-phase{font-size:var(--fs-caption);color:var(--color-muted);margin:var(--space-2) 0 0;text-align:center;}
        .mf__viewmode{display:block;margin:var(--space-1) 0 var(--space-2);color:var(--color-muted);font-size:var(--fs-caption);}
        .mf__views{display:flex;gap:var(--space-3);}
        .mf__views--original,.mf__views--residual{flex-direction:column;}
        .mf__views--sidebyside{flex-direction:row;}
        .mf__view-wrap{flex:1;min-width:0;}
        .mf__view-label{font-size:var(--fs-caption);color:var(--color-muted);margin:0 0 var(--space-1);}
        .mf__legend{font-size:var(--fs-caption);color:var(--color-muted);}
        @media(max-width:768px){
          .mf__body{flex-direction:column;}
          .mf__pseudo{width:100%;}
        }
        @media(max-width:640px){
          .mf__views--sidebyside{flex-direction:column;}
        }
      `}</style>
    </div>
  );
}
