import { describe, it, expect } from 'vitest';
import { edmondsKarpTrace, type FlowNetwork } from './maxflow';

const net: FlowNetwork = {
  source: 's', sink: 't',
  nodes: ['s','a','b','t'].map((id,i) => ({ id, x: i*100, y: 0 })),
  edges: [
    { from:'s', to:'a', cap:3 }, { from:'s', to:'b', cap:2 },
    { from:'a', to:'b', cap:1 }, { from:'a', to:'t', cap:2 }, { from:'b', to:'t', cap:3 },
  ],
};

describe('edmondsKarpTrace', () => {
  // 验算：s→a→t(2) + s→b→t(2) + s→a→b→t(1) = 5；s 出容量 3+2=5、t 入容量 2+3=5 均夹住 5
  it('最大流值正确', () => {
    expect(edmondsKarpTrace(net).maxValue).toBe(5);
  });
  it('最小割容量 == 最大流值', () => {
    const last = edmondsKarpTrace(net).frames.at(-1)!;
    const cutCap = last.minCut!.edges.reduce((s,e)=> s + (net.edges.find(x=>x.from===e.from&&x.to===e.to)!.cap), 0);
    expect(cutCap).toBe(5); // 最小割 {s}|其余 = s→a(3)+s→b(2)
  });
  it('无 s-t 路径 → 0', () => {
    const n2: FlowNetwork = { source:'s', sink:'t', nodes:[{id:'s',x:0,y:0},{id:'t',x:1,y:0}], edges:[] };
    expect(edmondsKarpTrace(n2).maxValue).toBe(0);
  });
});
