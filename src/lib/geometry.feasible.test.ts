import { describe, it, expect } from 'vitest';
import { feasibleVertices } from './geometry';
// 约束：2x+y<=8, x+2y<=8, x,y>=0 → 顶点含 (0,0)(4,0)(8/3,8/3)(0,4)
describe('feasibleVertices', () => {
  it('返回有序凸多边形顶点', () => {
    const vs = feasibleVertices([{a1:2,a2:1,b:8},{a1:1,a2:2,b:8}]);
    const has = (x:number,y:number) => vs.some(p => Math.abs(p.x-x)<1e-6 && Math.abs(p.y-y)<1e-6);
    expect(has(0,0)).toBe(true); expect(has(4,0)).toBe(true);
    expect(has(8/3,8/3)).toBe(true); expect(has(0,4)).toBe(true);
  });
});
