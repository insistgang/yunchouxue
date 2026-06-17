export type NodeId = string;
export type Edge = { from: NodeId; to: NodeId; w: number };
export type Graph = { nodes: { id: NodeId; x: number; y: number }[]; edges: Edge[]; directed: boolean };
export type DijkstraFrame = {
  dist: Record<NodeId, number>; prev: Record<NodeId, NodeId | null>;
  settled: NodeId[]; current: NodeId | null;
  relaxing: { edge: Edge; improved: boolean } | null;
  queue: NodeId[]; phase: 'init' | 'select' | 'relax' | 'done'; narration: string;
};
export type DijkstraTrace = { frames: DijkstraFrame[] };

export function dijkstraTrace(graph: Graph, source: NodeId): DijkstraTrace {
  const ids = graph.nodes.map(n => n.id);
  const dist: Record<NodeId, number> = {}, prev: Record<NodeId, NodeId | null> = {};
  ids.forEach(id => { dist[id] = Infinity; prev[id] = null; });
  dist[source] = 0;
  const settled: NodeId[] = [];
  const frames: DijkstraFrame[] = [];
  const adj = (u: NodeId) => graph.edges.flatMap(e =>
    e.from === u ? [e] : (!graph.directed && e.to === u ? [{ from: u, to: e.from, w: e.w }] : []));
  const queue = () => ids.filter(id => !settled.includes(id) && dist[id] < Infinity).sort((a,b)=> dist[a]-dist[b] || (a<b?-1:1));
  const snap = (cur: NodeId | null, relax: DijkstraFrame['relaxing'], phase: DijkstraFrame['phase'], narration: string) =>
    frames.push({ dist:{...dist}, prev:{...prev}, settled:[...settled], current:cur, relaxing:relax, queue:queue(), phase, narration });

  snap(null, null, 'init', `初始化：dist[${source}]=0，其余 +∞`);
  while (true) {
    const q = queue();
    if (q.length === 0) break;
    const u = q[0];
    settled.push(u);
    snap(u, null, 'select', `选出 dist 最小的 ${u}（dist=${dist[u]}），加入已确定集合`);
    for (const e of adj(u)) {
      if (settled.includes(e.to)) continue;
      const nd = dist[u] + e.w;
      const improved = nd < dist[e.to];
      if (improved) { dist[e.to] = nd; prev[e.to] = u; }
      snap(u, { edge: e, improved }, 'relax',
        improved ? `松弛 ${u}→${e.to}：${dist[u]}+${e.w}=${nd} < 旧值，更新` : `松弛 ${u}→${e.to}：未更短，保持`);
    }
  }
  snap(null, null, 'done', `完成：所有可达节点最短距离已确定`);
  return { frames };
}
