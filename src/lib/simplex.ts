import type { Point } from './geometry';
export type { Point };
export type LP = { c: number[]; A: number[][]; b: number[] };
export type SimplexFrame = {
  tableau: number[][]; basis: number[]; enter: number | null; leave: number | null;
  vertex: Point; z: number;
  phase: 'judge'|'ratio'|'pivot'|'move'|'optimal'|'unbounded'|'infeasible'; narration: string;
};
export type SimplexTrace = { frames: SimplexFrame[]; status: 'optimal'|'unbounded'|'infeasible'; optimum: { vertex: Point; z: number } | null };

export function solveSimplexTrace(lp: LP): SimplexTrace {
  const m = lp.A.length, n = lp.c.length;
  // 表：m 行约束 + 1 目标行；列：n 决策 + m 松弛 + 1 RHS
  const cols = n + m + 1;
  const T: number[][] = lp.A.map((row, i) => {
    const r = Array(cols).fill(0);
    for (let j = 0; j < n; j++) r[j] = row[j];
    r[n + i] = 1; r[cols - 1] = lp.b[i];
    return r;
  });
  const obj = Array(cols).fill(0);
  for (let j = 0; j < n; j++) obj[j] = -lp.c[j]; // 最大化 → 目标行存 -c
  T.push(obj);
  const basis = Array.from({ length: m }, (_, i) => n + i);
  const frames: SimplexFrame[] = [];
  const vertexOf = (): Point => {
    const val = (j: number) => { const r = basis.indexOf(j); return r === -1 ? 0 : T[r][cols - 1]; };
    return { x: val(0), y: n > 1 ? val(1) : 0 };
  };
  const zOf = () => T[m][cols - 1];
  const snap = (enter: number|null, leave: number|null, phase: SimplexFrame['phase'], narration: string) =>
    frames.push({ tableau: T.map(r => [...r]), basis: [...basis], enter, leave, vertex: vertexOf(), z: zOf(), phase, narration });

  snap(null, null, 'judge', `初始基本可行解：顶点 (0,0)，z=0`);
  let guard = 0;
  while (guard++ < 100) {
    // 判优：目标行最负（Bland：取首个 <0 的列）
    let enter = -1;
    for (let j = 0; j < cols - 1; j++) if (T[m][j] < -1e-9) { enter = j; break; }
    if (enter === -1) { snap(null, null, 'optimal', `所有检验数 ≤0，已最优：z=${zOf().toFixed(3)}`);
      return { frames, status: 'optimal', optimum: { vertex: vertexOf(), z: zOf() } }; }
    snap(enter, null, 'judge', `选入基列 x${enter+1}（检验数最负/Bland）`);
    // 最小比值
    let leave = -1, best = Infinity;
    for (let i = 0; i < m; i++) if (T[i][enter] > 1e-9) {
      const ratio = T[i][cols - 1] / T[i][enter];
      if (ratio < best - 1e-12) { best = ratio; leave = i; }
    }
    if (leave === -1) { snap(enter, null, 'unbounded', `入基列无正系数 → 无界`); return { frames, status: 'unbounded', optimum: null }; }
    snap(enter, leave, 'ratio', `最小比值检验：第 ${leave+1} 行出基（θ=${best.toFixed(3)}）`);
    // 主元消元 (Gauss-Jordan)
    const piv = T[leave][enter];
    for (let j = 0; j < cols; j++) T[leave][j] /= piv;
    for (let i = 0; i <= m; i++) if (i !== leave && Math.abs(T[i][enter]) > 1e-12) {
      const factor = T[i][enter];
      for (let j = 0; j < cols; j++) T[i][j] -= factor * T[leave][j];
    }
    // ③ pivot 帧：消元后表格，顶点尚未更新（basis 还未换）
    snap(enter, leave, 'pivot', `换基消元：x${enter+1} 入基，第 ${leave+1} 行归一化并消元，主元格已更新`);
    // 更新基
    basis[leave] = enter;
    // ④ move 帧：顶点已移动
    snap(enter, leave, 'move', `移动到顶点 (${vertexOf().x.toFixed(2)}, ${vertexOf().y.toFixed(2)})，z=${zOf().toFixed(3)}`);
  }
  return { frames, status: 'optimal', optimum: { vertex: vertexOf(), z: zOf() } };
}
