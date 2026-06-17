export type Point = { x: number; y: number };
export type HalfPlane = { a1: number; a2: number; b: number };
export function objectiveValue(c: number[], p: Point): number {
  return c[0] * p.x + c[1] * p.y;
}

function intersect(p: HalfPlane, q: HalfPlane): Point | null {
  const det = p.a1 * q.a2 - q.a1 * p.a2;
  if (Math.abs(det) < 1e-12) return null;
  return { x: (p.b * q.a2 - q.b * p.a2) / det, y: (p.a1 * q.b - q.a1 * p.b) / det };
}
export function feasibleVertices(constraints: HalfPlane[]): Point[] {
  // 候选交点 = 约束直线两两相交 + 与坐标轴 x=0 / y=0 相交；再过滤满足全部约束且 x,y≥0 者
  const lines: HalfPlane[] = [...constraints, { a1: 1, a2: 0, b: 0 }, { a1: 0, a2: 1, b: 0 }];
  const pts: Point[] = [];
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++) {
      const p = intersect(lines[i], lines[j]);
      if (p && p.x >= -1e-9 && p.y >= -1e-9
        && constraints.every(c => c.a1 * p.x + c.a2 * p.y <= c.b + 1e-9))
        pts.push({ x: Math.max(0, p.x), y: Math.max(0, p.y) });
    }
  // 去重 + 按质心极角排序
  const uniq = pts.filter((p, k) => pts.findIndex(o => Math.abs(o.x-p.x)<1e-6 && Math.abs(o.y-p.y)<1e-6) === k);
  const cx = uniq.reduce((s,p)=>s+p.x,0)/uniq.length, cy = uniq.reduce((s,p)=>s+p.y,0)/uniq.length;
  return uniq.sort((a,b)=> Math.atan2(a.y-cy,a.x-cx) - Math.atan2(b.y-cy,b.x-cx));
}
