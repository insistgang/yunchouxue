import { useMemo, useState } from 'preact/hooks';
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
const PRESETS: Record<string,{net:FlowNetwork;label:string}> = {
  classic: { net: CLASSIC, label:'教学经典网（6 节点）' },
  reverse: { net: REVERSE, label:'反向边救场网（需反向边撤回）' },
};

const defaults: DemoState = { demo: 'maxflow', params: { step: 0 }, step: 0 };
const init = typeof location !== 'undefined' ? decodeState(location.search, 'maxflow', defaults) : defaults;

export default function MaxflowDemo() {
  const [preset, setPreset] = useState<keyof typeof PRESETS>('classic');
  const { net } = PRESETS[preset];
  const trace = useMemo(() => edmondsKarpTrace(net), [preset]);
  const t = useTrace(trace.frames.length, {
    onStep: (i) => {
      replaceUrl({ demo: 'maxflow', params: { step: i }, step: i });
    },
  });

  // Apply URL-initialized step on first render
  const _ = useMemo(() => {
    const urlStep = Math.min(Math.max(0, init.step), trace.frames.length - 1);
    if (urlStep > 0) t.go(urlStep);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const f = trace.frames[t.i];
  const inPath = (u:string,v:string) => f.augmentPath?.some((n,i)=> n===u && f.augmentPath![i+1]===v) ?? false;
  const inCut = (u:string,v:string) => f.minCut?.edges.some(e=>e.from===u&&e.to===v) ?? false;
  return (
    <div class="mf">
      <label class="mf__preset">预设
        <select value={preset} onChange={(e) => {
          setPreset((e.target as HTMLSelectElement).value as keyof typeof PRESETS);
          t.reset();
          replaceUrl({ demo: 'maxflow', params: { step: 0 }, step: 0 });
        }}>
          {Object.entries(PRESETS).map(([k,v]) => <option value={k}>{v.label}</option>)}
        </select>
      </label>
      <svg role="img" aria-label={`最大流演示：${f.narration}`} viewBox="0 0 500 240" class="mf__svg">
        <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill={COLORS.gray400}/></marker></defs>
        {net.edges.map(e => {
          const a = net.nodes.find(n=>n.id===e.from)!, b = net.nodes.find(n=>n.id===e.to)!;
          const cut = inCut(e.from,e.to), path = inPath(e.from,e.to);
          const stroke = cut ? COLORS.success : path ? COLORS.accent : COLORS.gray300;
          return <g>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} stroke-width={cut||path?3:1.5} marker-end="url(#arrow)"/>
            <text x={(a.x+b.x)/2} y={(a.y+b.y)/2-4} text-anchor="middle" font-size="10" fill={COLORS.muted}>{f.flow[`${e.from}->${e.to}`]??0}/{e.cap}</text>
          </g>;
        })}
        {net.nodes.map(n => {
          const isS = f.minCut?.S.includes(n.id);
          return <g transform={`translate(${n.x},${n.y})`}>
            <circle r="16" fill={f.minCut ? (isS?COLORS.success:'#fff') : (f.bfsVisited.includes(n.id)?COLORS.accent:'#fff')} fill-opacity={f.minCut&&isS?0.15:1} stroke={COLORS.primary} stroke-width="2"/>
            <text dy="0.35em" text-anchor="middle" font-size="12" fill={COLORS.ink}>{n.id}</text>
          </g>;
        })}
      </svg>
      <p class="mf__val">当前最大流 |f| = <b>{f.value}</b></p>
      <PlayControls i={t.i} total={trace.frames.length} playing={t.playing} speed={t.speed}
        onPrev={t.prev} onNext={t.next} onToggle={() => t.setPlaying(!t.playing)} onReset={t.reset} onSpeed={t.setSpeed} />
      <StatusLog text={f.narration} />
      <style>{`.mf__svg{width:100%;background:var(--color-paper);border-radius:var(--radius-sm);} .mf__val{color:var(--color-body);font-size:var(--fs-caption);}
        .mf__preset{display:block;margin:0 0 var(--space-2);color:var(--color-muted);font-size:var(--fs-caption);}`}</style>
    </div>
  );
}
