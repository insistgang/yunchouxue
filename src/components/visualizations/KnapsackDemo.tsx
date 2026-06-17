import { useMemo, useState } from 'preact/hooks';
import { knapsackTrace, type Item } from '@/lib/knapsack';
import { useTrace } from './_shared/useTrace';
import PlayControls from './_shared/PlayControls';
import StatusLog from './_shared/StatusLog';
import { COLORS } from './_shared/colorTokens';
import { decodeState, replaceUrl, type DemoState } from './_shared/urlState';

const PRESETS: Record<string, { items: Item[]; W: number; label: string }> = {
  textbook: { label: '正文手算例', W: 10, items: [{name:'A',w:2,v:3},{name:'B',w:3,v:4},{name:'C',w:4,v:5},{name:'D',w:5,v:6}] },
  greedyFail: { label: '贪心反例', W: 50, items: [{name:'X',w:10,v:60},{name:'Y',w:20,v:100},{name:'Z',w:30,v:120}] },
  mini: { label: '极简入门例', W: 5, items: [{name:'P',w:1,v:1},{name:'Q',w:2,v:6},{name:'R',w:3,v:10}] },
};
const PRESET_KEYS = Object.keys(PRESETS) as Array<keyof typeof PRESETS>;

const defaults: DemoState = { demo: 'knapsack', params: { preset: 0, step: 0 }, step: 0 };
const init = typeof location !== 'undefined' ? decodeState(location.search, 'knapsack', defaults) : defaults;

export default function KnapsackDemo() {
  const initPresetIdx = Math.min(Math.max(0, Math.round(init.params.preset ?? 0)), PRESET_KEYS.length - 1);
  const [preset, setPreset] = useState<keyof typeof PRESETS>(PRESET_KEYS[initPresetIdx]);
  const { items, W } = PRESETS[preset];
  const trace = useMemo(() => knapsackTrace(items, W), [preset]);
  const t = useTrace(trace.frames.length, {
    onStep: (i) => {
      const pidx = PRESET_KEYS.indexOf(preset as string);
      replaceUrl({ demo: 'knapsack', params: { preset: pidx, step: i }, step: i });
    },
  });
  const f = trace.frames[t.i];
  const cell = 38;
  const isBacktrackPhase = f.phase === 'backtrack' || f.phase === 'done';

  // 计算回溯路径的格坐标（chosen 集合对应的格，用于绿色高亮）
  // 我们需要从 trace 的最终结果反推每件已选物品在哪行哪格
  const chosenSet = new Set(f.chosen);
  // 对于回溯/完成阶段，标记 chosen 物品所在行的"决策格"
  // 用一个 Set 记录 (i, w) 坐标字符串
  const chosenCells = useMemo(() => {
    if (!isBacktrackPhase) return new Set<string>();
    const cells = new Set<string>();
    let ww = W;
    for (let ii = items.length; ii >= 1; ii--) {
      const item = items[ii - 1];
      const table = trace.frames[trace.frames.length - 1].table;
      if (table[ii][ww] !== table[ii - 1][ww]) {
        cells.add(`${ii},${ww}`);
        ww -= item.w;
      }
    }
    return cells;
  }, [isBacktrackPhase, preset]);

  // 计算已选物品的总重/总价值
  const chosenItems = items.filter(it => chosenSet.has(it.name));
  const totalW = chosenItems.reduce((s, it) => s + it.w, 0);
  const totalV = chosenItems.reduce((s, it) => s + it.v, 0);

  return (
    <div class="ks">
      <label class="ks__preset">预设
        <select value={preset} onChange={(e) => {
          const key = (e.target as HTMLSelectElement).value as keyof typeof PRESETS;
          setPreset(key);
          t.reset();
          replaceUrl({ demo: 'knapsack', params: { preset: PRESET_KEYS.indexOf(key as string), step: 0 }, step: 0 });
        }}>
          {Object.entries(PRESETS).map(([k, v]) => <option value={k}>{v.label}</option>)}
        </select>
      </label>
      <div class="ks__layout">
        <svg role="img" aria-label={`0-1 背包 DP 表，当前 ${f.narration}`}
          viewBox={`0 0 ${(W + 2) * cell} ${(items.length + 2) * cell}`} class="ks__svg">
          {f.table.map((row, i) => row.map((val, w) => {
            const isActive = f.active && f.active.i === i && f.active.w === w;
            const isChosen = isBacktrackPhase && chosenCells.has(`${i},${w}`);
            // 填表阶段只显示"已生长到"的格（逐格教学，PRD 7.4）；回溯/完成阶段全部显示
            const filled = f.phase !== 'fill' || i === 0
              || (f.active != null && (i < f.active.i || (i === f.active.i && w <= f.active.w)));
            const bgColor = isChosen ? COLORS.success : isActive ? COLORS.accent : COLORS.paper;
            return (
              <g transform={`translate(${(w + 1) * cell},${(i + 1) * cell})`}>
                <rect width={cell - 2} height={cell - 2} rx="3"
                  fill={bgColor} stroke={isChosen ? COLORS.success : COLORS.gray300}
                  stroke-width={isChosen ? 2 : 1} fill-opacity={isChosen ? 0.25 : 1} />
                {filled && <text x={cell/2} y={cell/2} dy="0.35em" text-anchor="middle"
                  fill={isActive ? '#fff' : isChosen ? COLORS.success : COLORS.body} font-size="13">{val}</text>}
              </g>
            );
          }))}
        </svg>
        {isBacktrackPhase && chosenItems.length > 0 && (
          <div class="ks__sidebar" role="region" aria-label="已选物品">
            <p class="ks__sidebar-title">已选物品</p>
            <ul class="ks__sidebar-list">
              {chosenItems.map(it => (
                <li class="ks__sidebar-item">
                  <span class="ks__item-name">{it.name}</span>
                  <span class="ks__item-detail">重 {it.w} · 值 {it.v}</span>
                </li>
              ))}
            </ul>
            <p class="ks__sidebar-sum">总重 {totalW} · 总价值 <b>{totalV}</b></p>
          </div>
        )}
      </div>
      <PlayControls i={t.i} total={trace.frames.length} playing={t.playing} speed={t.speed}
        onPrev={t.prev} onNext={t.next} onToggle={() => t.setPlaying(!t.playing)} onReset={t.reset} onSpeed={t.setSpeed} />
      <StatusLog text={f.narration} />
      <details class="ks__alt"><summary>等价文本视图（无障碍）</summary>
        <ol>{trace.frames.map((fr, k) => <li hidden={k !== t.i}>{fr.narration}</li>)}</ol>
      </details>
      <style>{`.ks__layout{display:flex;gap:var(--space-4);align-items:flex-start;flex-wrap:wrap;}
        .ks__svg{width:100%;max-height:480px;background:var(--demo-canvas);border-radius:var(--radius-sm);}
        .ks__preset,.ks__alt{display:block;margin:var(--space-2) 0;color:var(--color-muted);font-size:var(--fs-caption);}
        .ks__sidebar{min-width:120px;background:color-mix(in srgb,var(--color-success,#22c55e) 8%,var(--color-paper));border:1px solid color-mix(in srgb,var(--color-success,#22c55e) 30%,transparent);border-radius:var(--radius-sm);padding:var(--space-3);font-size:var(--fs-caption);}
        .ks__sidebar-title{font-weight:600;color:var(--color-success,#22c55e);margin:0 0 var(--space-2);}
        .ks__sidebar-list{list-style:none;padding:0;margin:0 0 var(--space-2);}
        .ks__sidebar-item{display:flex;justify-content:space-between;gap:var(--space-2);padding:2px 0;color:var(--color-body);}
        .ks__item-name{font-weight:600;}
        .ks__item-detail{color:var(--color-muted);}
        .ks__sidebar-sum{margin:0;border-top:1px solid color-mix(in srgb,var(--color-success,#22c55e) 20%,transparent);padding-top:var(--space-1);color:var(--color-body);}`}</style>
    </div>
  );
}
