export type NodeId = string;
export type FlowNetwork = { nodes: { id: NodeId; x: number; y: number }[]; edges: { from: NodeId; to: NodeId; cap: number }[]; source: NodeId; sink: NodeId };
export type MaxflowFrame = {
  flow: Record<string, number>; residual: Record<string, number>;
  bfsVisited: NodeId[]; bfsQueue: NodeId[]; parent: Record<NodeId, NodeId | null>;
  augmentPath: NodeId[] | null; bottleneck: number | null; value: number;
  minCut: { S: NodeId[]; T: NodeId[]; edges: { from: NodeId; to: NodeId }[] } | null;
  phase: 'bfs' | 'augment' | 'optimal'; narration: string;
};
export type MaxflowTrace = { frames: MaxflowFrame[]; maxValue: number };

const key = (u: NodeId, v: NodeId) => `${u}->${v}`;

export function edmondsKarpTrace(net: FlowNetwork): MaxflowTrace {
  const res: Record<string, number> = {};
  const flow: Record<string, number> = {};
  const nbr: Record<NodeId, NodeId[]> = {};
  net.nodes.forEach(n => nbr[n.id] = []);
  for (const e of net.edges) {
    res[key(e.from, e.to)] = (res[key(e.from, e.to)] ?? 0) + e.cap;
    res[key(e.to, e.from)] = res[key(e.to, e.from)] ?? 0;
    flow[key(e.from, e.to)] = 0;
    if (!nbr[e.from].includes(e.to)) nbr[e.from].push(e.to);
    if (!nbr[e.to].includes(e.from)) nbr[e.to].push(e.from);
  }
  const frames: MaxflowFrame[] = [];
  let value = 0;
  const snap = (p: Partial<MaxflowFrame> & Pick<MaxflowFrame,'phase'|'narration'>) =>
    frames.push({ flow:{...flow}, residual:{...res}, bfsVisited:[], bfsQueue:[], parent:{}, augmentPath:null, bottleneck:null, value, minCut:null, ...p });

  while (true) {
    // BFS over residual
    const parent: Record<NodeId, NodeId | null> = {}; net.nodes.forEach(n => parent[n.id] = null);
    const visited: NodeId[] = [net.source]; const q: NodeId[] = [net.source];
    snap({ phase:'bfs', narration:'在残余网络上从 s 做 BFS 找增广路', bfsVisited:[...visited], bfsQueue:[...q], parent:{...parent} });
    let reached = false;
    while (q.length) {
      const u = q.shift()!;
      for (const v of nbr[u]) {
        if (!visited.includes(v) && (res[key(u, v)] ?? 0) > 0) {
          parent[v] = u; visited.push(v); q.push(v);
          if (v === net.sink) { reached = true; q.length = 0; break; }
        }
      }
    }
    if (!reached) {
      // 最小割：可达集 S
      const S = visited; const T = net.nodes.map(n => n.id).filter(id => !S.includes(id));
      const cutEdges = net.edges.filter(e => S.includes(e.from) && T.includes(e.to)).map(e => ({ from: e.from, to: e.to }));
      snap({ phase:'optimal', narration:`无增广路 → 已最优。最小割容量=最大流值=${value}`, minCut:{ S, T, edges: cutEdges } });
      break;
    }
    // augment path
    const path: NodeId[] = []; let cur: NodeId | null = net.sink;
    while (cur) { path.unshift(cur); cur = parent[cur]; }
    let delta = Infinity;
    for (let i = 0; i + 1 < path.length; i++) delta = Math.min(delta, res[key(path[i], path[i+1])]);
    snap({ phase:'augment', narration:`找到增广路 ${path.join('→')}，瓶颈 Δ=${delta}`, augmentPath:[...path], bottleneck:delta, parent:{...parent}, bfsVisited:[...visited] });
    for (let i = 0; i + 1 < path.length; i++) {
      const u = path[i], v = path[i+1];
      res[key(u, v)] -= delta; res[key(v, u)] = (res[key(v, u)] ?? 0) + delta;
      if (flow[key(u, v)] !== undefined) flow[key(u, v)] += delta; else flow[key(v, u)] -= delta;
    }
    value += delta;
    snap({ phase:'augment', narration:`沿增广路推送 ${delta}，当前 |f|=${value}`, augmentPath:[...path], bottleneck:delta, value });
  }
  return { frames, maxValue: value };
}
