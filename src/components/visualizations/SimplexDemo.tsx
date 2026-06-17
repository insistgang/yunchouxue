import { useMemo, useState } from 'preact/hooks';
import { feasibleVertices, objectiveValue, type HalfPlane } from '@/lib/geometry';
import { solveSimplexTrace } from '@/lib/simplex';
import { useTrace } from './_shared/useTrace';
import PlayControls from './_shared/PlayControls';
import Slider from './_shared/Slider';
import StatusLog from './_shared/StatusLog';
import { COLORS } from './_shared/colorTokens';
import { decodeState, replaceUrl, type DemoState } from './_shared/urlState';

const CONSTRAINTS: HalfPlane[] = [{ a1:2,a2:1,b:8 }, { a1:1,a2:2,b:8 }];
const SCALE = 40, PAD = 30; // 坐标系 0..9
const sx = (x:number)=> PAD + x*SCALE, sy = (y:number)=> 300 - PAD - y*SCALE;

const defaults: DemoState = { demo: 'lp', params: { c1: 30, c2: 20, step: 0 }, step: 0 };
const init = typeof location !== 'undefined' ? decodeState(location.search, 'lp', defaults) : defaults;

export default function SimplexDemo() {
  const [c1, setC1] = useState(init.params.c1 ?? 30);
  const [c2, setC2] = useState(init.params.c2 ?? 20);
  const [mode, setMode] = useState<'explore'|'step'>('explore');
  const verts = useMemo(() => feasibleVertices(CONSTRAINTS), []);
  const best = useMemo(() => verts.reduce((b,p)=> objectiveValue([c1,c2],p) > objectiveValue([c1,c2],b) ? p : b, verts[0]), [c1,c2,verts]);
  const trace = useMemo(() => solveSimplexTrace({ c:[c1,c2], A:[[2,1],[1,2]], b:[8,8] }), [c1,c2]);
  const t = useTrace(trace.frames.length, {
    onStep: (i) => {
      replaceUrl({ demo: 'lp', params: { c1, c2, step: i }, step: i });
    },
  });
  const stepVertex = trace.frames[t.i]?.vertex ?? best;
  const poly = verts.map(p => `${sx(p.x)},${sy(p.y)}`).join(' ');
  const hi = mode==='step' ? stepVertex : best;

  const handleC1 = (v: number) => {
    setC1(v);
    t.reset();
    replaceUrl({ demo: 'lp', params: { c1: v, c2, step: 0 }, step: 0 });
  };
  const handleC2 = (v: number) => {
    setC2(v);
    t.reset();
    replaceUrl({ demo: 'lp', params: { c1, c2: v, step: 0 }, step: 0 });
  };

  return (
    <div class="sx">
      <svg role="img" aria-label={`线性规划可行域，目标 ${c1}x1+${c2}x2，最优顶点 (${hi.x.toFixed(2)},${hi.y.toFixed(2)})`} viewBox="0 0 400 300" class="sx__svg">
        <polygon points={poly} fill={COLORS.primary} fill-opacity="0.12" stroke={COLORS.primary} stroke-width="1.5"/>
        {/* 目标函数等值线（过最优顶点） */}
        {c2 > 0 && c1 > 0 && (() => { const z = objectiveValue([c1,c2], hi);
          const x0 = 0, y0 = z/c2, x1v = z/c1, y1 = 0;
          return <line x1={sx(x0)} y1={sy(y0)} x2={sx(x1v)} y2={sy(y1)} stroke={COLORS.accent} stroke-width="1.5" stroke-dasharray="4 3"/>; })()}
        {verts.map(p => <circle cx={sx(p.x)} cy={sy(p.y)} r="4" fill={COLORS.primary}/>)}
        <circle cx={sx(hi.x)} cy={sy(hi.y)} r="7" fill={COLORS.success}/>
        <text x={sx(hi.x)+10} y={sy(hi.y)-8} font-size="11" fill={COLORS.success}>z={objectiveValue([c1,c2],hi).toFixed(1)}</text>
      </svg>
      <div class="sx__ctrl">
        <Slider label="c₁" min={0} max={50} value={c1} onInput={handleC1} />
        <Slider label="c₂" min={0} max={50} value={c2} onInput={handleC2} />
        <label class="sx__mode">模式
          <select value={mode} onChange={(e)=>{ setMode((e.target as HTMLSelectElement).value as 'explore'|'step'); t.reset(); }}>
            <option value="explore">连续探索</option><option value="step">单纯形步进</option>
          </select>
        </label>
      </div>
      {mode==='step' && <PlayControls i={t.i} total={trace.frames.length} playing={t.playing} speed={t.speed}
        onPrev={t.prev} onNext={t.next} onToggle={()=>t.setPlaying(!t.playing)} onReset={t.reset} onSpeed={t.setSpeed} />}
      <StatusLog text={mode==='step' ? (trace.frames[t.i]?.narration ?? '') : `拖动系数：当前最优顶点 (${best.x.toFixed(2)}, ${best.y.toFixed(2)})，z=${objectiveValue([c1,c2],best).toFixed(1)}`} />
      {/* 等价文本视图（DoD#6/PRD 8.5 无障碍可达） */}
      <details class="sx__alt">
        <summary>等价文本视图（无障碍）</summary>
        <p>目标函数：最大化 {c1}x₁ + {c2}x₂</p>
        <p>约束：2x₁+x₂≤8，x₁+2x₂≤8，x₁,x₂≥0</p>
        <p>当前最优顶点：({hi.x.toFixed(2)}, {hi.y.toFixed(2)})，目标值 z={objectiveValue([c1,c2],hi).toFixed(1)}</p>
        {mode==='step' && <p>步进状态：{trace.frames[t.i]?.narration}</p>}
      </details>
      <style>{`.sx__svg{width:100%;max-width:480px;background:var(--color-paper);border-radius:var(--radius-sm);}
        .sx__ctrl{display:flex;gap:var(--space-5);flex-wrap:wrap;align-items:flex-end;margin-top:var(--space-3);}
        .sx__mode{display:flex;flex-direction:column;gap:var(--space-1);color:var(--color-muted);font-size:var(--fs-caption);}
        .sx__alt{margin-top:var(--space-3);font-size:var(--fs-caption);color:var(--color-muted);}
        .sx__alt summary{cursor:pointer;color:var(--color-primary);}`}</style>
    </div>
  );
}
