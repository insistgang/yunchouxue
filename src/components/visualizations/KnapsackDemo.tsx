import { useEffect, useMemo, useState } from 'preact/hooks';
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

// SVG arrowhead marker id constants
const MARKER_SKIP = 'ks-arrow-skip';
const MARKER_TAKE = 'ks-arrow-take';
const MARKER_TAKE_WIN = 'ks-arrow-take-win';
const MARKER_SKIP_WIN = 'ks-arrow-skip-win';

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
  // Apply URL-initialized step on first render (clamp to valid range)
  useEffect(() => {
    const urlStep = Math.min(Math.max(0, init.step), trace.frames.length - 1);
    if (urlStep > 0) t.go(urlStep);
  }, []);
  const f = trace.frames[t.i];
  const cell = 38;
  const isBacktrackPhase = f.phase === 'backtrack' || f.phase === 'done';
  const isFillPhase = f.phase === 'fill';

  // 计算回溯路径的格坐标（chosen 集合对应的格，用于绿色高亮）
  const chosenSet = new Set(f.chosen);
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

  // ── 来源双箭头计算（仅 fill 阶段） ──────────────────────────────
  // 当前活动格 (ai, aw)，来源：正上方 (ai-1, aw) = skip；左上方 (ai-1, aw-wi) = take
  const arrows = useMemo(() => {
    if (!isFillPhase || !f.active || f.active.i < 1) return null;
    const { i: ai, w: aw } = f.active;
    const item = items[ai - 1]; // 第 ai 件物品（1-indexed）
    const skipVal = f.candidates.skip;
    const takeVal = f.candidates.take;
    const curVal = f.table[ai][aw];

    // 采纳了 take 还是 skip
    const tookTake = takeVal !== null && takeVal > skipVal;

    // SVG 坐标：格 (row, col) 的中心 = ((col+1)*cell + cell/2, (row+1)*cell + cell/2)
    // 活动格中心
    const tx = (aw + 1) * cell + cell / 2;
    const ty = (ai + 1) * cell + cell / 2;

    // 正上方格 (ai-1, aw) 中心
    const skipSrcX = (aw + 1) * cell + cell / 2;
    const skipSrcY = (ai - 1 + 1) * cell + cell / 2;

    // 箭头终点稍微收进目标格边缘（留 6px 给箭头头部）
    const margin = 8;

    // skip 箭头：正上方格 → 活动格（竖直向下）
    const skipArrow = {
      x1: skipSrcX,
      y1: skipSrcY + cell / 2 - 2,
      x2: tx,
      y2: ty - cell / 2 + margin,
      label: `不放=${skipVal}`,
      isWinner: !tookTake,
      srcRow: ai - 1,
      srcCol: aw,
    };

    // take 箭头：左上方格 (ai-1, aw-wi) → 活动格（斜向右下）
    let takeArrow: typeof skipArrow | null = null;
    if (takeVal !== null && aw >= item.w) {
      const takeSrcX = (aw - item.w + 1) * cell + cell / 2;
      const takeSrcY = (ai - 1 + 1) * cell + cell / 2;
      // 斜向箭头：从左上格右下角到活动格左上角方向
      const dx = tx - takeSrcX;
      const dy = ty - takeSrcY;
      const len = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / len;
      const uy = dy / len;
      takeArrow = {
        x1: takeSrcX + ux * (cell / 2 - 2),
        y1: takeSrcY + uy * (cell / 2 - 2),
        x2: tx - ux * margin,
        y2: ty - uy * margin,
        label: `放+${item.v}=${takeVal}`,
        isWinner: tookTake,
        srcRow: ai - 1,
        srcCol: aw - item.w,
      };
    }

    return { skipArrow, takeArrow, tookTake, curVal, ai, aw, item };
  }, [isFillPhase, f.active, f.candidates, f.table, items, cell]);

  // ── 方程面板文字（fill 阶段） ─────────────────────────────────────
  const eqPanel = useMemo(() => {
    if (!isFillPhase || !f.active || f.active.i < 1) return null;
    const { i: ai, w: aw } = f.active;
    const item = items[ai - 1];
    const skip = f.candidates.skip;
    const take = f.candidates.take;
    const result = f.table[ai][aw];
    return { ai, aw, item, skip, take, result };
  }, [isFillPhase, f.active, f.candidates, f.table, items]);

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
        {/* DP 表 SVG（含来源双箭头） */}
        <div
          class="ks__svg-wrap"
          tabIndex={0}
          role="region"
          aria-label={`0-1 背包 DP 表横向滚动区，当前 ${f.narration}`}
        >
          <svg role="img" aria-label={`0-1 背包 DP 表，当前 ${f.narration}`}
            viewBox={`0 0 ${(W + 2) * cell} ${(items.length + 2) * cell}`} class="ks__svg">
            <defs>
              {/* 普通箭头（未采纳分支，灰色） */}
              <marker id={MARKER_SKIP} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill={COLORS.gray400} />
              </marker>
              {/* take 未采纳箭头 */}
              <marker id={MARKER_TAKE} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill={COLORS.primary} />
              </marker>
              {/* skip 采纳箭头（强调） */}
              <marker id={MARKER_SKIP_WIN} markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto">
                <path d="M0,0 L0,8 L10,4 z" fill={COLORS.accent} />
              </marker>
              {/* take 采纳箭头（强调） */}
              <marker id={MARKER_TAKE_WIN} markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto">
                <path d="M0,0 L0,8 L10,4 z" fill={COLORS.accent} />
              </marker>
            </defs>

            {f.table.map((row, i) => row.map((val, w) => {
              const isActive = f.active && f.active.i === i && f.active.w === w;
              const isChosen = isBacktrackPhase && chosenCells.has(`${i},${w}`);
              // 填表阶段只显示"已生长到"的格
              const filled = f.phase !== 'fill' || i === 0
                || (f.active != null && (i < f.active.i || (i === f.active.i && w <= f.active.w)));
              // 来源格高亮（仅 fill 阶段）
              const isSkipSrc = arrows && i === arrows.skipArrow.srcRow && w === arrows.skipArrow.srcCol;
              const isTakeSrc = arrows?.takeArrow && i === arrows.takeArrow.srcRow && w === arrows.takeArrow.srcCol;
              const bgColor = isChosen ? COLORS.success : isActive ? COLORS.accent : COLORS.paper;
              const strokeColor = isSkipSrc || isTakeSrc
                ? COLORS.primary
                : isChosen ? COLORS.success : COLORS.gray300;
              const strokeW = (isSkipSrc || isTakeSrc) ? 2 : isChosen ? 2 : 1;
              return (
                <g transform={`translate(${(w + 1) * cell},${(i + 1) * cell})`}>
                  <rect width={cell - 2} height={cell - 2} rx="3"
                    fill={bgColor} stroke={strokeColor}
                    stroke-width={strokeW} fill-opacity={isChosen ? 0.25 : 1} />
                  {filled && <text x={cell/2} y={cell/2} dy="0.35em" text-anchor="middle"
                    fill={isActive ? '#fff' : isChosen ? COLORS.success : COLORS.body} font-size="13">{val}</text>}
                </g>
              );
            }))}

            {/* 来源双箭头（fill 阶段） */}
            {arrows && (() => {
              const { skipArrow, takeArrow } = arrows;
              return (
                <g class="ks__arrows" aria-hidden="true">
                  {/* skip 箭头（正上方） */}
                  <line
                    x1={skipArrow.x1} y1={skipArrow.y1}
                    x2={skipArrow.x2} y2={skipArrow.y2}
                    stroke={skipArrow.isWinner ? COLORS.accent : COLORS.gray400}
                    stroke-width={skipArrow.isWinner ? 2.5 : 1.5}
                    stroke-dasharray={skipArrow.isWinner ? undefined : '4,3'}
                    marker-end={skipArrow.isWinner ? `url(#${MARKER_SKIP_WIN})` : `url(#${MARKER_SKIP})`}
                  />
                  <text
                    x={(skipArrow.x1 + skipArrow.x2) / 2 + 14}
                    y={(skipArrow.y1 + skipArrow.y2) / 2}
                    dy="0.35em"
                    font-size="10"
                    fill={skipArrow.isWinner ? COLORS.accent : COLORS.muted}
                    font-weight={skipArrow.isWinner ? '700' : '400'}
                  >{skipArrow.label}</text>

                  {/* take 箭头（左上方斜线，若存在） */}
                  {takeArrow && (
                    <>
                      <line
                        x1={takeArrow.x1} y1={takeArrow.y1}
                        x2={takeArrow.x2} y2={takeArrow.y2}
                        stroke={takeArrow.isWinner ? COLORS.accent : COLORS.primary}
                        stroke-width={takeArrow.isWinner ? 2.5 : 1.5}
                        stroke-dasharray={takeArrow.isWinner ? undefined : '4,3'}
                        marker-end={takeArrow.isWinner ? `url(#${MARKER_TAKE_WIN})` : `url(#${MARKER_TAKE})`}
                      />
                      <text
                        x={(takeArrow.x1 + takeArrow.x2) / 2 - 4}
                        y={(takeArrow.y1 + takeArrow.y2) / 2 - 8}
                        font-size="10"
                        fill={takeArrow.isWinner ? COLORS.accent : COLORS.primary}
                        font-weight={takeArrow.isWinner ? '700' : '400'}
                      >{takeArrow.label}</text>
                    </>
                  )}
                </g>
              );
            })()}
          </svg>
        </div>

        {/* 侧边栏：已选物品（回溯阶段） 或 方程面板（填表阶段） */}
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

        {/* 方程面板（fill 阶段，具体数字代入） */}
        {eqPanel && (
          <div class="ks__eq" role="region" aria-label="转移方程代入面板">
            <p class="ks__eq-title">转移方程代入</p>
            <p class="ks__eq-coord">
              <b>f({eqPanel.ai},{eqPanel.aw})</b>
              {' '}= max(…)
            </p>
            <div class="ks__eq-body">
              {/* skip 分支 */}
              <div class={`ks__eq-branch ${eqPanel.take === null || eqPanel.take <= eqPanel.skip ? 'ks__eq-branch--win' : ''}`}>
                <span class="ks__eq-branch-label">不放</span>
                <span class="ks__eq-branch-expr">
                  f({eqPanel.ai - 1},{eqPanel.aw}) = <b>{eqPanel.skip}</b>
                </span>
              </div>
              {/* take 分支（若放得下） */}
              {eqPanel.take !== null ? (
                <div class={`ks__eq-branch ${eqPanel.take > eqPanel.skip ? 'ks__eq-branch--win' : ''}`}>
                  <span class="ks__eq-branch-label">放 {eqPanel.item.name}</span>
                  <span class="ks__eq-branch-expr">
                    f({eqPanel.ai - 1},{eqPanel.aw - eqPanel.item.w})+{eqPanel.item.v} = <b>{eqPanel.take}</b>
                  </span>
                </div>
              ) : (
                <div class="ks__eq-branch ks__eq-branch--disabled">
                  <span class="ks__eq-branch-label">放不下</span>
                  <span class="ks__eq-branch-expr">w{eqPanel.item.w} &gt; 容量{eqPanel.aw}</span>
                </div>
              )}
            </div>
            <p class="ks__eq-result">
              = <b class="ks__eq-result-val">{eqPanel.result}</b>
            </p>
          </div>
        )}
      </div>
      <PlayControls i={t.i} total={trace.frames.length} playing={t.playing} speed={t.speed}
        onPrev={t.prev} onNext={t.next} onToggle={() => t.setPlaying(!t.playing)} onReset={t.reset} onSpeed={t.setSpeed} />
      <StatusLog text={f.narration} />
      <details class="ks__alt"><summary>等价文本视图（无障碍）</summary>
        <ol>{trace.frames.map((fr, k) => <li hidden={k !== t.i}>{fr.narration}</li>)}</ol>
      </details>
      <style>{`
        .ks__layout{display:flex;gap:var(--space-4);align-items:flex-start;flex-wrap:wrap;}
        .ks__svg-wrap{flex:1 1 0;min-width:0;overflow-x:auto;background:var(--demo-canvas);border-radius:var(--radius-sm);}
        .ks__svg-wrap:focus{outline:2px solid var(--color-primary);outline-offset:2px;}
        .ks__svg{width:100%;max-height:480px;display:block;}
        .ks__preset,.ks__alt{display:block;margin:var(--space-2) 0;color:var(--color-muted);font-size:var(--fs-caption);}
        .ks__sidebar{min-width:120px;background:color-mix(in srgb,var(--color-success,#22c55e) 8%,var(--color-paper));border:1px solid color-mix(in srgb,var(--color-success,#22c55e) 30%,transparent);border-radius:var(--radius-sm);padding:var(--space-3);font-size:var(--fs-caption);}
        .ks__sidebar-title{font-weight:600;color:var(--color-success,#22c55e);margin:0 0 var(--space-2);}
        .ks__sidebar-list{list-style:none;padding:0;margin:0 0 var(--space-2);}
        .ks__sidebar-item{display:flex;justify-content:space-between;gap:var(--space-2);padding:2px 0;color:var(--color-body);}
        .ks__item-name{font-weight:600;}
        .ks__item-detail{color:var(--color-muted);}
        .ks__sidebar-sum{margin:0;border-top:1px solid color-mix(in srgb,var(--color-success,#22c55e) 20%,transparent);padding-top:var(--space-1);color:var(--color-body);}
        .ks__eq{min-width:160px;max-width:220px;background:color-mix(in srgb,var(--color-accent,#B45309) 6%,var(--color-paper));border:1px solid color-mix(in srgb,var(--color-accent,#B45309) 25%,transparent);border-radius:var(--radius-sm);padding:var(--space-3);font-size:var(--fs-caption);}
        .ks__eq-title{font-weight:600;color:var(--color-accent,#B45309);margin:0 0 var(--space-2);font-size:var(--fs-caption);}
        .ks__eq-coord{margin:0 0 var(--space-2);color:var(--color-body);font-family:var(--font-mono,monospace);}
        .ks__eq-body{display:flex;flex-direction:column;gap:var(--space-1);margin-bottom:var(--space-2);}
        .ks__eq-branch{display:flex;flex-direction:column;gap:2px;padding:var(--space-1) var(--space-2);border-radius:var(--radius-sm);border:1px solid var(--color-gray-200,#E2E8F0);background:var(--color-paper);color:var(--color-muted);}
        .ks__eq-branch--win{border-color:var(--color-accent,#B45309);background:color-mix(in srgb,var(--color-accent,#B45309) 10%,var(--color-paper));color:var(--color-body);}
        .ks__eq-branch--win .ks__eq-branch-label{color:var(--color-accent,#B45309);font-weight:700;}
        .ks__eq-branch--disabled{opacity:0.5;}
        .ks__eq-branch-label{font-size:10px;text-transform:uppercase;letter-spacing:.04em;}
        .ks__eq-branch-expr{font-family:var(--font-mono,monospace);font-size:11px;}
        .ks__eq-result{margin:0;font-family:var(--font-mono,monospace);font-size:var(--fs-caption);color:var(--color-body);}
        .ks__eq-result-val{color:var(--color-accent,#B45309);font-size:1.1em;}
        @media(max-width:480px){.ks__eq{max-width:100%;width:100%;}.ks__layout{gap:var(--space-2);}}`}
      </style>
    </div>
  );
}
