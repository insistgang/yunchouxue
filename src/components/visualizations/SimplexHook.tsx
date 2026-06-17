/**
 * SimplexHook — 首页迷你钩子（PRD 6.1-4）
 * 仅 c1/c2 滑块 + 可行域多边形 + 过最优顶点的等值线；无步进、无单纯形表。
 * 复用 feasibleVertices / objectiveValue / COLORS，保持首页 JS 极小。
 */
import { useMemo, useState } from 'preact/hooks';
import { feasibleVertices, objectiveValue, type HalfPlane } from '@/lib/geometry';
import Slider from './_shared/Slider';
import { COLORS } from './_shared/colorTokens';

const CONSTRAINTS: HalfPlane[] = [{ a1: 2, a2: 1, b: 8 }, { a1: 1, a2: 2, b: 8 }];
const SCALE = 36, PAD = 28;
const sx = (x: number) => PAD + x * SCALE;
const sy = (y: number) => 280 - PAD - y * SCALE;

export default function SimplexHook() {
  const [c1, setC1] = useState(30);
  const [c2, setC2] = useState(20);

  const verts = useMemo(() => feasibleVertices(CONSTRAINTS), []);
  const best = useMemo(
    () => verts.reduce((b, p) => objectiveValue([c1, c2], p) > objectiveValue([c1, c2], b) ? p : b, verts[0]),
    [c1, c2, verts],
  );
  const z = objectiveValue([c1, c2], best);
  const poly = verts.map(p => `${sx(p.x)},${sy(p.y)}`).join(' ');

  // 等值线：c1*x + c2*y = z，过 (0, z/c2) 和 (z/c1, 0)
  const linePoints = (() => {
    if (c1 <= 0 || c2 <= 0) return null;
    return { x0: 0, y0: z / c2, x1: z / c1, y1: 0 };
  })();

  return (
    <div class="shk">
      <p class="shk__label" aria-live="polite">
        目标函数：<b>{c1}</b>x₁ + <b>{c2}</b>x₂，最优顶点&nbsp;
        ({best.x.toFixed(2)}, {best.y.toFixed(2)})，z = <b>{z.toFixed(1)}</b>
      </p>
      <svg
        role="img"
        aria-label={`可行域示意，目标系数 c1=${c1} c2=${c2}，最优值 z=${z.toFixed(1)}`}
        viewBox="0 0 360 280"
        class="shk__svg"
      >
        {/* 可行域填充 */}
        <polygon
          points={poly}
          fill={COLORS.primary}
          fill-opacity="0.12"
          stroke={COLORS.primary}
          stroke-width="1.5"
        />
        {/* 等值线（虚线） */}
        {linePoints && (
          <line
            x1={sx(linePoints.x0)} y1={sy(linePoints.y0)}
            x2={sx(linePoints.x1)} y2={sy(linePoints.y1)}
            stroke={COLORS.accent}
            stroke-width="2"
            stroke-dasharray="5 3"
          />
        )}
        {/* 顶点 */}
        {verts.map(p => (
          <circle cx={sx(p.x)} cy={sy(p.y)} r="4" fill={COLORS.primary} />
        ))}
        {/* 最优顶点高亮 */}
        <circle cx={sx(best.x)} cy={sy(best.y)} r="7" fill={COLORS.success} />
        <text x={sx(best.x) + 10} y={sy(best.y) - 8} font-size="11" fill={COLORS.success}>
          z={z.toFixed(1)}
        </text>
        {/* 坐标轴标签 */}
        <text x={sx(0) - 16} y={sy(4)} font-size="10" fill={COLORS.muted}>x₂</text>
        <text x={sx(4)} y={sy(0) + 16} font-size="10" fill={COLORS.muted}>x₁</text>
      </svg>
      <div class="shk__ctrl">
        <Slider label="c₁" min={0} max={50} value={c1} onInput={setC1} />
        <Slider label="c₂" min={0} max={50} value={c2} onInput={setC2} />
      </div>
      <p class="shk__hint">拖动系数体验目标函数如何改变最优角点 →&nbsp;
        <a href="/topics/linear-programming-simplex">完整单纯形演示</a>
      </p>
      <style>{`
        .shk { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-6); background: var(--color-surface); border-radius: var(--radius-lg); border: 1px solid var(--gray-200); }
        .shk__label { color: var(--color-body); font-size: var(--fs-caption); margin: 0; }
        .shk__svg { width: 100%; max-width: 400px; border-radius: var(--radius-sm); }
        .shk__ctrl { display: flex; gap: var(--space-5); flex-wrap: wrap; }
        .shk__hint { color: var(--color-muted); font-size: var(--fs-caption); margin: 0; }
        .shk__hint a { color: var(--color-primary); }
      `}</style>
    </div>
  );
}
