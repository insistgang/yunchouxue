export type Item = { name: string; w: number; v: number };
export type KnapsackFrame = {
  table: number[][];
  active: { i: number; w: number } | null;
  candidates: { skip: number; take: number | null };
  chosen: string[];
  phase: 'fill' | 'backtrack' | 'done';
  narration: string;
};
export type KnapsackTrace = { frames: KnapsackFrame[]; best: number; chosen: string[] };

export function knapsackTrace(items: Item[], W: number): KnapsackTrace {
  const n = items.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(W + 1).fill(0));
  const frames: KnapsackFrame[] = [];
  const snap = (active: KnapsackFrame['active'], cand: KnapsackFrame['candidates'], chosen: string[], phase: KnapsackFrame['phase'], narration: string) =>
    frames.push({ table: dp.map(r => [...r]), active, candidates: cand, chosen: [...chosen], phase, narration });

  for (let i = 1; i <= n; i++) {
    const it = items[i - 1];
    for (let w = 0; w <= W; w++) {
      const skip = dp[i - 1][w];
      const take = w >= it.w ? dp[i - 1][w - it.w] + it.v : null;
      dp[i][w] = take !== null ? Math.max(skip, take) : skip;
      snap({ i, w }, { skip, take }, [], 'fill',
        take !== null
          ? `f(${i},${w})=max(不放 ${skip}, 放${it.name} ${dp[i-1][w-it.w]}+${it.v}=${take})=${dp[i][w]}`
          : `f(${i},${w})：${it.name} 放不下，继承上一行 ${skip}`);
    }
  }
  // 回溯
  const chosen: string[] = [];
  let w = W;
  for (let i = n; i >= 1; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      chosen.push(items[i - 1].name);
      const wOld = w; // 保存决策格的旧 w，让 snap 指向被决策的格 (i, wOld)
      w -= items[i - 1].w;
      snap({ i, w: wOld }, { skip: dp[i - 1][wOld], take: null }, chosen, 'backtrack', `选中 ${items[i-1].name}，剩余容量 ${w}`);
    } else {
      snap({ i, w }, { skip: dp[i - 1][w], take: null }, chosen, 'backtrack', `第 ${i} 件未选`);
    }
  }
  snap(null, { skip: 0, take: null }, chosen, 'done', `最优值 ${dp[n][W]}，选中 {${chosen.join(', ')}}`);
  return { frames, best: dp[n][W], chosen: chosen.reverse() };
}
