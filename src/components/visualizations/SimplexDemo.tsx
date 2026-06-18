import { useEffect, useMemo, useState } from 'preact/hooks';
import { feasibleVertices, objectiveValue, type HalfPlane } from '@/lib/geometry';
import { solveSimplexTrace } from '@/lib/simplex';
import { useTrace } from './_shared/useTrace';
import PlayControls from './_shared/PlayControls';
import Slider from './_shared/Slider';
import StatusLog from './_shared/StatusLog';
import { COLORS } from './_shared/colorTokens';
import { decodeState, replaceUrl, type DemoState } from './_shared/urlState';

const SCALE = 40, PAD = 30; // 坐标系 0..9
const sx = (x: number) => PAD + x * SCALE;
const sy = (y: number) => 300 - PAD - y * SCALE;
const VIEW_W = 400, VIEW_H = 300;

const BASE_CONSTRAINTS: HalfPlane[] = [{ a1: 2, a2: 1, b: 8 }, { a1: 1, a2: 2, b: 8 }];
const UNBOUNDED_CONSTRAINTS: HalfPlane[] = [{ a1: -1, a2: 1, b: 1 }];

type PresetKey = 'standard' | 'multiOptimum' | 'unbounded';
const PRESETS: Record<PresetKey, { label: string; c: [number, number]; constraints: HalfPlane[]; note?: string }> = {
  standard:     { label: '桌椅工坊（唯一最优）',  c: [30, 20], constraints: BASE_CONSTRAINTS },
  multiOptimum: { label: '多重最优（整条边最优）', c: [2, 1],   constraints: BASE_CONSTRAINTS, note: '多重最优：目标梯度 (2,1) 与约束 2x₁+x₂≤8 法向平行，整条约束边均为最优解。' },
  unbounded:    { label: '无界（目标可无限增大）', c: [1, 1],   constraints: UNBOUNDED_CONSTRAINTS, note: '无界：入基列无正系数，目标函数可无限增大，不存在有限最优解。' },
};
const PRESET_KEYS = Object.keys(PRESETS) as PresetKey[];

const defaults: DemoState = { demo: 'lp', params: { preset: 0, c1: 30, c2: 20 }, step: 0 };
const init = typeof location !== 'undefined' ? decodeState(location.search, 'lp', defaults) : defaults;

function initPresetKey(): PresetKey {
  const idx = Math.min(Math.max(0, Math.round(init.params.preset ?? 0)), PRESET_KEYS.length - 1);
  return PRESET_KEYS[idx];
}

export default function SimplexDemo() {
  const [preset, setPreset] = useState<PresetKey>(initPresetKey());
  const presetDef = PRESETS[preset];
  const [c1, setC1] = useState(init.params.c1 ?? presetDef.c[0]);
  const [c2, setC2] = useState(init.params.c2 ?? presetDef.c[1]);
  const [mode, setMode] = useState<'explore' | 'step'>('explore');

  // Layer toggles (PRD 7.1 controls) — all default on
  const [showContour,     setShowContour]     = useState(true);
  const [showGradient,    setShowGradient]    = useState(true);
  const [showTrajectory,  setShowTrajectory]  = useState(true);
  const [showConstLabels, setShowConstLabels] = useState(true);
  const [showTableau,     setShowTableau]     = useState(true);

  const constraints = presetDef.constraints;
  const verts = useMemo(() => feasibleVertices(constraints), [preset]);
  const best = useMemo(() => {
    if (verts.length === 0) return { x: 0, y: 0 };
    return verts.reduce((b, p) => objectiveValue([c1, c2], p) > objectiveValue([c1, c2], b) ? p : b, verts[0]);
  }, [c1, c2, verts]);
  const A     = useMemo(() => constraints.map(k => [k.a1, k.a2]), [preset]);
  const bVec  = useMemo(() => constraints.map(k => k.b),          [preset]);
  const trace = useMemo(() => solveSimplexTrace({ c: [c1, c2], A, b: bVec }), [c1, c2, preset]);

  const t = useTrace(trace.frames.length, {
    onStep: (i) => {
      const pidx = PRESET_KEYS.indexOf(preset);
      replaceUrl({ demo: 'lp', params: { preset: pidx, c1, c2 }, step: i });
    },
  });
  // Restore URL-initialised step on first render (clamp to valid range)
  useEffect(() => {
    const urlStep = Math.min(Math.max(0, init.step), trace.frames.length - 1);
    if (urlStep > 0) t.go(urlStep);
  }, []);

  const frame      = trace.frames[t.i];
  const stepVertex = frame?.vertex ?? best;
  const poly       = verts.map(p => `${sx(p.x)},${sy(p.y)}`).join(' ');
  const hi         = mode === 'step' ? stepVertex : best;

  // Vertex trajectory in step mode — collect unique consecutive vertices
  const trajectoryPoints = useMemo(() => {
    if (mode !== 'step') return [];
    const pts: Array<{ x: number; y: number }> = [];
    for (let k = 0; k <= t.i && k < trace.frames.length; k++) {
      const v = trace.frames[k].vertex;
      const last = pts[pts.length - 1];
      if (!last || Math.abs(last.x - v.x) > 1e-6 || Math.abs(last.y - v.y) > 1e-6) {
        pts.push(v);
      }
    }
    return pts;
  }, [mode, t.i, trace]);

  // Gradient arrow — normalised (c1,c2), 1.5-unit length in data space
  const gradLen = Math.sqrt(c1 * c1 + c2 * c2);
  const gradDx  = gradLen > 1e-9 ? (c1 / gradLen) * 1.5 : 0;
  const gradDy  = gradLen > 1e-9 ? (c2 / gradLen) * 1.5 : 0;
  const arrowX0 = 3, arrowY0 = 3; // fixed anchor in data-space

  // Handlers
  const handlePreset = (key: PresetKey) => {
    setPreset(key);
    const pd = PRESETS[key];
    setC1(pd.c[0]); setC2(pd.c[1]);
    t.reset();
    const pidx = PRESET_KEYS.indexOf(key);
    replaceUrl({ demo: 'lp', params: { preset: pidx, c1: pd.c[0], c2: pd.c[1] }, step: 0 });
  };
  const handleC1 = (v: number) => {
    setC1(v); t.reset();
    const pidx = PRESET_KEYS.indexOf(preset);
    replaceUrl({ demo: 'lp', params: { preset: pidx, c1: v, c2 }, step: 0 });
  };
  const handleC2 = (v: number) => {
    setC2(v); t.reset();
    const pidx = PRESET_KEYS.indexOf(preset);
    replaceUrl({ demo: 'lp', params: { preset: pidx, c1, c2: v }, step: 0 });
  };

  const isUnbounded = trace.status === 'unbounded';

  const statusText = mode === 'step'
    ? (frame?.narration ?? '')
    : `拖动系数：最优顶点 (${best.x.toFixed(2)}, ${best.y.toFixed(2)})，z=${objectiveValue([c1, c2], best).toFixed(1)}${presetDef.note ? '　【' + presetDef.note + '】' : ''}`;

  // Tableau helpers
  const m       = constraints.length;
  const n       = 2;
  const cols    = n + m + 1;
  const tableau = frame?.tableau ?? [];
  const basis   = frame?.basis ?? [];
  const enterCol = frame?.enter;
  const leaveRow = frame?.leave;
  const phase    = frame?.phase;

  function varName(j: number): string {
    return j < n ? `x${j + 1}` : `s${j - n + 1}`;
  }

  // Cell background for tableau highlighting (PRD 7.1 + PRD 8.4 colours)
  function cellBg(row: number, col: number): string {
    if (col === cols - 1) return 'transparent'; // RHS column — no highlight
    const isPivot = enterCol !== null && leaveRow !== null && row === leaveRow && col === enterCol;
    if (isPivot && (phase === 'ratio' || phase === 'pivot' || phase === 'move')) return COLORS.accent;
    const isEnter = enterCol !== null && col === enterCol;
    const isLeave = leaveRow !== null && row === leaveRow;
    if (isEnter && (phase === 'judge' || phase === 'ratio' || phase === 'pivot' || phase === 'move')) return '#FEF3C7';
    if (isLeave && (phase === 'ratio' || phase === 'pivot' || phase === 'move')) return '#ECFDF5';
    return 'transparent';
  }

  function cellFg(row: number, col: number): string {
    const isPivot = enterCol !== null && leaveRow !== null && row === leaveRow && col === enterCol;
    if (isPivot && (phase === 'ratio' || phase === 'pivot' || phase === 'move')) return '#fff';
    return 'inherit';
  }

  function fmtNum(v: number): string {
    if (Math.abs(v) < 1e-10) return '0';
    // Show up to 3 decimal places, strip trailing zeros
    const s = v.toFixed(3);
    return s.replace(/\.?0+$/, '');
  }

  return (
    <div class="sx">
      {/* Preset selector */}
      <label class="sx__preset">预设
        <select value={preset} onChange={(e) => handlePreset((e.target as HTMLSelectElement).value as PresetKey)}>
          {PRESET_KEYS.map(k => <option value={k}>{PRESETS[k].label}</option>)}
        </select>
      </label>

      <div class="sx__main">
        {/* ── SVG canvas ── */}
        <div class="sx__canvas-wrap">
          <svg
            role="img"
            aria-label={`线性规划可行域，目标 ${c1}x₁+${c2}x₂，当前顶点 (${hi.x.toFixed(2)},${hi.y.toFixed(2)})`}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            class="sx__svg"
          >
            <defs>
              <marker id="grad-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill={COLORS.accent} />
              </marker>
            </defs>

            {/* Constraint boundary lines + labels */}
            {showConstLabels && constraints.map((c, ci) => {
              let lx0: number, ly0: number, lx1: number, ly1: number;
              if (Math.abs(c.a2) > 1e-9) {
                lx0 = 0;  ly0 = c.b / c.a2;
                lx1 = 9;  ly1 = (c.b - c.a1 * 9) / c.a2;
              } else if (Math.abs(c.a1) > 1e-9) {
                lx0 = c.b / c.a1; ly0 = 0;
                lx1 = c.b / c.a1; ly1 = 9;
              } else {
                return null;
              }
              const lmx = (lx0 + lx1) / 2, lmy = (ly0 + ly1) / 2;
              const lbl = `${c.a1}x₁${c.a2 >= 0 ? '+' : ''}${c.a2}x₂≤${c.b}`;
              return (
                <g key={ci}>
                  <line
                    x1={sx(lx0)} y1={sy(ly0)} x2={sx(lx1)} y2={sy(ly1)}
                    stroke={COLORS.primary} stroke-width="1" stroke-dasharray="6 4" opacity="0.5"
                  />
                  <text x={sx(lmx) + 4} y={sy(lmy) - 6} font-size="10" fill={COLORS.primary} opacity="0.8">
                    {lbl}
                  </text>
                </g>
              );
            })}

            {/* Feasible region polygon */}
            {verts.length >= 3 && (
              <polygon
                points={poly}
                fill={COLORS.primary} fill-opacity="0.10"
                stroke={COLORS.primary} stroke-width="1.5"
              />
            )}
            {/* Unbounded: show partial boundary as dashed line */}
            {verts.length >= 2 && verts.length < 3 && (
              <line
                x1={sx(verts[0].x)} y1={sy(verts[0].y)}
                x2={sx(verts[1].x)} y2={sy(verts[1].y)}
                stroke={COLORS.primary} stroke-width="1.5" stroke-dasharray="4 3"
              />
            )}

            {/* Isocurve (contour line through current/optimal vertex) */}
            {showContour && c1 > 0 && c2 > 0 && (() => {
              const z = objectiveValue([c1, c2], hi);
              return (
                <line
                  x1={sx(0)} y1={sy(z / c2)}
                  x2={sx(z / c1)} y2={sy(0)}
                  stroke={COLORS.accent} stroke-width="1.5" stroke-dasharray="4 3"
                />
              );
            })()}

            {/* Gradient arrow */}
            {showGradient && gradLen > 1e-9 && (
              <line
                x1={sx(arrowX0)} y1={sy(arrowY0)}
                x2={sx(arrowX0 + gradDx)} y2={sy(arrowY0 + gradDy)}
                stroke={COLORS.accent} stroke-width="2.5"
                marker-end="url(#grad-arrow)"
              />
            )}

            {/* Vertex-visit trajectory polyline (step mode) */}
            {showTrajectory && mode === 'step' && trajectoryPoints.length >= 2 && (
              <polyline
                points={trajectoryPoints.map(p => `${sx(p.x)},${sy(p.y)}`).join(' ')}
                fill="none"
                stroke={COLORS.success} stroke-width="2"
                stroke-dasharray="5 3" opacity="0.8"
              />
            )}

            {/* All vertex dots */}
            {verts.map((p, pi) => (
              <circle key={pi} cx={sx(p.x)} cy={sy(p.y)} r="4" fill={COLORS.primary} opacity="0.7" />
            ))}

            {/* Highlighted current/optimal vertex */}
            <circle
              cx={sx(hi.x)} cy={sy(hi.y)} r="7"
              fill={
                trace.status === 'optimal' && mode === 'explore'
                  ? COLORS.success
                  : mode === 'step' && (phase === 'move' || phase === 'optimal')
                    ? COLORS.success
                    : COLORS.accent
              }
            />
            <text x={sx(hi.x) + 10} y={sy(hi.y) - 8} font-size="11"
              fill={
                trace.status === 'optimal' && mode === 'explore' ? COLORS.success : COLORS.accent
              }>
              z={objectiveValue([c1, c2], hi).toFixed(1)}
            </text>

            {/* Axis labels */}
            <text x={sx(0) - 4} y={sy(8.5)} font-size="10" fill={COLORS.muted} text-anchor="end">x₂</text>
            <text x={sx(8.5)} y={sy(0) + 16} font-size="10" fill={COLORS.muted}>x₁</text>

            {/* Unbounded region indicator — arrow pointing to +∞ direction */}
            {isUnbounded && mode === 'step' && (
              <g>
                <line
                  x1={sx(1)} y1={sy(1)} x2={sx(4)} y2={sy(4)}
                  stroke={COLORS.warning} stroke-width="2" stroke-dasharray="4 3"
                  marker-end="url(#grad-arrow)"
                />
                <text x={sx(3.5)} y={sy(4) - 8} font-size="12" fill={COLORS.warning} font-weight="700">∞</text>
              </g>
            )}
          </svg>

          {/* Unbounded badge */}
          {isUnbounded && mode === 'step' && t.i === trace.frames.length - 1 && (
            <div class="sx__badge sx__badge--unbounded" role="status" aria-live="polite">
              无界
              <small>{presetDef.note}</small>
            </div>
          )}
        </div>

        {/* ── Simplex tableau sidebar (step mode + showTableau) ── */}
        {showTableau && mode === 'step' && tableau.length > 0 && (
          <div class="sx__tableau-wrap">
            <div class="sx__tableau-title">
              单纯形表 &mdash; 第 {t.i + 1}&thinsp;/&thinsp;{trace.frames.length} 步
              {phase && <span class="sx__phase-badge">{phase}</span>}
            </div>
            <div class="sx__tableau-scroll">
              <table class="sx__tableau" aria-label="单纯形表">
                <thead>
                  <tr>
                    <th class="sx__th-basis">基</th>
                    {Array.from({ length: cols }, (_, j) => (
                      <th
                        key={j}
                        style={{
                          background: enterCol !== null && j === enterCol && j < cols - 1
                            ? '#FEF3C7' : 'transparent',
                          color: enterCol !== null && j === enterCol && j < cols - 1
                            ? COLORS.accent : 'inherit',
                          fontWeight: enterCol !== null && j === enterCol ? 'bold' : 'normal',
                        }}
                      >
                        {j < cols - 1 ? varName(j) : 'RHS'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Constraint rows */}
                  {tableau.slice(0, m).map((row, ri) => (
                    <tr
                      key={ri}
                      style={{ background: leaveRow !== null && ri === leaveRow ? '#ECFDF5' : 'transparent' }}
                    >
                      <td
                        class="sx__td-basis"
                        style={{ color: leaveRow !== null && ri === leaveRow ? COLORS.success : COLORS.muted }}
                      >
                        {basis[ri] !== undefined ? varName(basis[ri]) : `r${ri}`}
                      </td>
                      {row.map((val, ci) => (
                        <td
                          key={ci}
                          style={{
                            background: cellBg(ri, ci),
                            color: cellFg(ri, ci),
                            fontWeight: enterCol !== null && leaveRow !== null && ri === leaveRow && ci === enterCol
                              ? 'bold' : 'normal',
                          }}
                        >
                          {fmtNum(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* Objective row */}
                  <tr class="sx__obj-row">
                    <td class="sx__td-basis" style={{ color: COLORS.muted }}>目标</td>
                    {(tableau[m] ?? []).map((val, ci) => (
                      <td
                        key={ci}
                        style={{
                          background: enterCol !== null && ci === enterCol && ci < cols - 1
                            ? '#FEF3C7' : 'transparent',
                          color: enterCol !== null && ci === enterCol && ci < cols - 1
                            ? COLORS.accent : 'inherit',
                        }}
                      >
                        {fmtNum(val)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Sliders + mode switch ── */}
      <div class="sx__ctrl">
        <Slider label="c₁" min={0} max={50} value={c1} onInput={handleC1} />
        <Slider label="c₂" min={0} max={50} value={c2} onInput={handleC2} />
        <label class="sx__mode">模式
          <select
            value={mode}
            onChange={(e) => { setMode((e.target as HTMLSelectElement).value as 'explore' | 'step'); t.reset(); }}
          >
            <option value="explore">连续探索</option>
            <option value="step">单纯形步进</option>
          </select>
        </label>
      </div>

      {/* ── Layer toggles (PRD 7.1) ── */}
      <div class="sx__layers" role="group" aria-label="图层显示控制">
        <span class="sx__layers-label">图层：</span>
        {([
          ['等值线',   showContour,     setShowContour],
          ['梯度箭头', showGradient,    setShowGradient],
          ['顶点轨迹', showTrajectory,  setShowTrajectory],
          ['约束标签', showConstLabels, setShowConstLabels],
          ['单纯形表', showTableau,     setShowTableau],
        ] as [string, boolean, (v: boolean) => void][]).map(([lbl, val, setter]) => (
          <label key={lbl} class="sx__layer-toggle">
            <input
              type="checkbox"
              checked={val}
              onChange={(e) => setter((e.target as HTMLInputElement).checked)}
            />
            {lbl}
          </label>
        ))}
      </div>

      {mode === 'step' && (
        <PlayControls
          i={t.i} total={trace.frames.length}
          playing={t.playing} speed={t.speed}
          onPrev={t.prev} onNext={t.next}
          onToggle={() => t.setPlaying(!t.playing)}
          onReset={t.reset} onSpeed={t.setSpeed}
        />
      )}

      <StatusLog text={statusText} />

      {/* Equivalent text view (PRD 8.5 / DoD#6 — screen reader accessible) */}
      <details class="sx__alt">
        <summary>等价文本视图（无障碍）</summary>
        <p>当前预设：{presetDef.label}</p>
        <p>目标函数：最大化 {c1}x₁ + {c2}x₂</p>
        <p>约束：{constraints.map(c => `${c.a1}x₁+${c.a2}x₂≤${c.b}`).join('，')}，x₁,x₂≥0</p>
        <p>当前顶点：({hi.x.toFixed(2)}, {hi.y.toFixed(2)})，z={objectiveValue([c1, c2], hi).toFixed(1)}</p>
        {presetDef.note && <p>{presetDef.note}</p>}
        {mode === 'step' && <p>步进状态：{frame?.narration}</p>}
        {mode === 'step' && isUnbounded && <p>无界提示：{presetDef.note}</p>}
        {mode === 'step' && frame && (
          <table>
            <caption>单纯形表（步 {t.i + 1}）</caption>
            <thead>
              <tr>
                <th>基</th>
                {Array.from({ length: cols }, (_, j) => <th key={j}>{j < cols - 1 ? varName(j) : 'RHS'}</th>)}
              </tr>
            </thead>
            <tbody>
              {frame.tableau.slice(0, m).map((row, ri) => (
                <tr key={ri}>
                  <td>{basis[ri] !== undefined ? varName(basis[ri]) : `r${ri}`}</td>
                  {row.map((v, ci) => <td key={ci}>{fmtNum(v)}</td>)}
                </tr>
              ))}
              <tr>
                <td>目标</td>
                {(frame.tableau[m] ?? []).map((v, ci) => <td key={ci}>{fmtNum(v)}</td>)}
              </tr>
            </tbody>
          </table>
        )}
      </details>

      <style>{`
        .sx__svg { width:100%; max-width:480px; background:var(--demo-canvas); border-radius:var(--radius-sm); display:block; }
        .sx__main { display:flex; gap:var(--space-4); align-items:flex-start; flex-wrap:wrap; margin-top:var(--space-2); }
        .sx__canvas-wrap { position:relative; flex:1 1 280px; }
        .sx__tableau-wrap { flex:1 1 260px; max-width:420px; }
        .sx__tableau-title { font-size:var(--fs-caption); color:var(--color-muted); margin-bottom:var(--space-2); display:flex; gap:var(--space-2); align-items:center; }
        .sx__phase-badge { background:var(--color-surface,#F8FAFC); border:1px solid var(--color-gray-200,#E2E8F0); border-radius:3px; padding:1px 5px; font-size:11px; font-family:var(--font-mono,'JetBrains Mono',monospace); color:var(--color-accent,#B45309); }
        .sx__tableau-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; }
        .sx__tableau { border-collapse:collapse; font-size:12px; width:100%; font-family:var(--font-mono,'JetBrains Mono',monospace); }
        .sx__tableau th, .sx__tableau td { border:1px solid var(--color-gray-200,#E2E8F0); padding:3px 7px; text-align:right; white-space:nowrap; transition:background 0.2s,color 0.2s; }
        .sx__tableau th { background:var(--color-surface,#F8FAFC); font-weight:600; text-align:center; }
        .sx__th-basis, .sx__td-basis { text-align:left !important; font-weight:700; min-width:36px; background:var(--color-surface,#F8FAFC) !important; }
        .sx__obj-row td { border-top:2px solid var(--color-primary,#1D4E89); font-style:italic; background:var(--color-surface,#F8FAFC); }
        .sx__ctrl { display:flex; gap:var(--space-5); flex-wrap:wrap; align-items:flex-end; margin-top:var(--space-3); }
        .sx__preset { display:flex; flex-direction:column; gap:var(--space-1); color:var(--color-muted); font-size:var(--fs-caption); margin-bottom:var(--space-2); }
        .sx__mode { display:flex; flex-direction:column; gap:var(--space-1); color:var(--color-muted); font-size:var(--fs-caption); }
        .sx__layers { display:flex; flex-wrap:wrap; gap:var(--space-3); align-items:center; margin-top:var(--space-3); font-size:var(--fs-caption); color:var(--color-muted); }
        .sx__layers-label { font-weight:600; color:var(--color-body); }
        .sx__layer-toggle { display:flex; gap:var(--space-1); align-items:center; cursor:pointer; user-select:none; }
        .sx__layer-toggle input { width:15px; height:15px; accent-color:var(--color-primary); cursor:pointer; }
        .sx__alt { margin-top:var(--space-3); font-size:var(--fs-caption); color:var(--color-muted); }
        .sx__alt summary { cursor:pointer; color:var(--color-primary); }
        .sx__badge { position:absolute; top:8px; right:8px; padding:5px 10px; border-radius:var(--radius-sm); font-weight:700; font-size:13px; line-height:1.4; text-align:center; }
        .sx__badge--unbounded { background:#FEF2F2; color:var(--color-danger,#B91C1C); border:1px solid var(--color-danger,#B91C1C); }
        .sx__badge--unbounded small { font-weight:400; font-size:11px; display:block; max-width:180px; word-break:break-all; margin-top:2px; }
      `}</style>
    </div>
  );
}
