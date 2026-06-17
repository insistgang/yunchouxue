import { describe, it, expect } from 'vitest';
import { dijkstraTrace, type Graph } from './dijkstra';

const g: Graph = {
  directed: false,
  nodes: [['A',0,0],['B',1,0],['C',1,1],['D',2,1]].map(([id,x,y]) => ({id:id as string,x:x as number,y:y as number})),
  edges: [
    { from:'A', to:'B', w:1 }, { from:'A', to:'C', w:4 },
    { from:'B', to:'C', w:2 }, { from:'C', to:'D', w:1 },
  ],
};

describe('dijkstraTrace', () => {
  it('正确最短距离', () => {
    const last = dijkstraTrace(g, 'A').frames.at(-1)!;
    expect(last.dist).toEqual({ A:0, B:1, C:3, D:4 });
    expect(last.prev.C).toBe('B');
  });
  it('不可达节点 dist=+Infinity', () => {
    const g2: Graph = { directed:true, nodes:[{id:'A',x:0,y:0},{id:'Z',x:1,y:0}], edges:[] };
    const last = dijkstraTrace(g2, 'A').frames.at(-1)!;
    expect(last.dist.Z).toBe(Infinity);
  });
  it('frames 单调推进，首帧 init 末帧 done', () => {
    const fr = dijkstraTrace(g, 'A').frames;
    expect(fr[0].phase).toBe('init');
    expect(fr.at(-1)!.phase).toBe('done');
  });
});
