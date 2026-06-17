import { describe, it, expect } from 'vitest';
import { knapsackTrace } from './knapsack';

describe('knapsackTrace', () => {
  it('贪心反例 X(10,60) Y(20,100) Z(30,120), W=50 → 最优 220 (Y+Z)', () => {
    const r = knapsackTrace([{name:'X',w:10,v:60},{name:'Y',w:20,v:100},{name:'Z',w:30,v:120}], 50);
    expect(r.best).toBe(220);
    expect(r.chosen.sort()).toEqual(['Y','Z']);
  });
  it('正文例 A(2,3)B(3,4)C(4,5)D(5,6), W=10 → 13', () => {
    const r = knapsackTrace([{name:'A',w:2,v:3},{name:'B',w:3,v:4},{name:'C',w:4,v:5},{name:'D',w:5,v:6}], 10);
    expect(r.best).toBe(13);
  });
  it('全部超重 → 0、空解', () => {
    const r = knapsackTrace([{name:'P',w:10,v:5}], 3);
    expect(r.best).toBe(0); expect(r.chosen).toEqual([]);
  });
  it('frames 覆盖填表 + 回溯两阶段', () => {
    const r = knapsackTrace([{name:'P',w:1,v:1},{name:'Q',w:2,v:6}], 3);
    expect(r.frames.some(f => f.phase === 'fill')).toBe(true);
    expect(r.frames.some(f => f.phase === 'backtrack')).toBe(true);
    expect(r.frames.at(-1)!.phase).toBe('done');
  });
});
