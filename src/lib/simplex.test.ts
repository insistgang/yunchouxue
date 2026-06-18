import { describe, it, expect } from 'vitest';
import { solveSimplexTrace } from './simplex';
// max 30x1+20x2 s.t. 2x1+x2<=8, x1+2x2<=8, x>=0 → 最优 z=400/3 at (8/3,8/3)
describe('solveSimplexTrace', () => {
  it('达到最优顶点与目标值', () => {
    const r = solveSimplexTrace({ c:[30,20], A:[[2,1],[1,2]], b:[8,8] });
    expect(r.status).toBe('optimal');
    expect(r.optimum!.z).toBeCloseTo(400/3, 4);
    expect(r.optimum!.vertex.x).toBeCloseTo(8/3, 4);
    expect(r.optimum!.vertex.y).toBeCloseTo(8/3, 4);
  });
  it('迭代不止一步（顶点轨迹经过 (4,0)）', () => {
    const r = solveSimplexTrace({ c:[30,20], A:[[2,1],[1,2]], b:[8,8] });
    const passes40 = r.frames.some(f => Math.abs(f.vertex.x-4)<1e-6 && Math.abs(f.vertex.y)<1e-6);
    expect(passes40).toBe(true);
  });
  it('四微步：每轮 ratio 帧之后有 pivot 帧再有 move 帧', () => {
    const r = solveSimplexTrace({ c:[30,20], A:[[2,1],[1,2]], b:[8,8] });
    // 找出所有 ratio 帧的索引
    const ratioIdxs = r.frames.map((f,i)=>f.phase==='ratio'?i:-1).filter(i=>i>=0);
    // 每个 ratio 帧之后必须是 pivot，pivot 之后是 move
    for (const ri of ratioIdxs) {
      expect(r.frames[ri+1]?.phase).toBe('pivot');
      expect(r.frames[ri+2]?.phase).toBe('move');
    }
    // 该用例有 2 次换基，所以至少 2 个 ratio 帧
    expect(ratioIdxs.length).toBeGreaterThanOrEqual(2);
  });
});
