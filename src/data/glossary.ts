export type Term = { zh: string; en: string; def: string; id: string };
export const glossary: Term[] = [
  { id: 'feasible-region', zh: '可行域', en: 'feasible region', def: '满足全部约束的解的集合，线性约束下为凸多面体。' },
  { id: 'extreme-point', zh: '极点 / 顶点', en: 'extreme point / vertex', def: '可行域不可被内部线段表示的角点，对应基本可行解。' },
  { id: 'slack-variable', zh: '松弛变量', en: 'slack variable', def: '把 ≤ 不等式化为等式引入的非负变量，其值=资源剩余量。' },
  { id: 'reduced-cost', zh: '检验数', en: 'reduced cost', def: '单纯形法判优依据，最大化下全 ≤0 即最优。' },
  { id: 'shadow-price', zh: '影子价格', en: 'shadow price', def: '约束右端项每增一单位带来的目标增量，资源边际价值。' },
  { id: 'relaxation', zh: '松弛（操作）', en: 'relaxation', def: '最短路中用 dist[u]+w<dist[v] 更新距离上界。' },
  { id: 'distance-label', zh: '距离标号', en: 'distance label', def: 'Dijkstra 中 dist[v]，已知源到 v 的最短距离上界。' },
  { id: 'residual-network', zh: '残余网络', en: 'residual network', def: '含反向边、残余容量的网络，表示可继续推送/撤回的流。' },
  { id: 'augmenting-path', zh: '增广路径', en: 'augmenting path', def: '残余网络上 s→t 的路径，可沿其增加流量。' },
  { id: 'minimum-cut', zh: '最小割', en: 'minimum cut', def: '容量之和最小的 s-t 割，等于最大流值。' },
  { id: 'optimal-substructure', zh: '最优子结构', en: 'optimal substructure', def: '整体最优解由子问题最优解拼装而成。' },
  { id: 'overlapping-subproblems', zh: '重叠子问题', en: 'overlapping subproblems', def: '朴素递归反复求解同一子问题，DP 用记忆化避免。' },
  { id: 'pseudo-polynomial', zh: '伪多项式', en: 'pseudo-polynomial', def: '复杂度依数值大小（如 W）而非输入位数，0-1 背包本质 NP-hard。' },
];
