/**
 * check-island-budget.mjs
 * 逐 island gzip 体积门禁（PRD 10.5 / DoD#5）
 *
 * 用完整组件名作 LIMITS 键，按 ^组件名\. 正则定位入口 chunk，
 * 沿 import 链递归收集所有依赖 chunk，合并 gzip 后与硬上限比较。
 * 超限则退出码 1（CI 失败）。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

// 硬上限（bytes，含 Preact + _shared 共享 chunk）
const LIMITS = {
  SimplexDemo:  30_000,
  DijkstraDemo: 40_000,
  MaxflowDemo:  45_000,
  KnapsackDemo: 28_000,
};

const dir = 'dist/_astro';
let files;
try {
  files = readdirSync(dir).filter(f => f.endsWith('.js'));
} catch {
  console.error(`✗ dist/_astro 目录不存在，请先运行 pnpm astro build`);
  process.exit(1);
}

/**
 * 从入口 chunk 沿 import / import() 链递归收集所有依赖文件名（相对于 dir）。
 * 正则匹配 Rollup/Vite 产物中的形如：
 *   from "./foo.bar.js"
 *   import("./foo.bar.js")
 */
function collect(entry, seen = new Set()) {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const code = readFileSync(join(dir, entry), 'utf8');
  // hash 文件名含字母/数字/- 和 .，如 preact.module.D_O1FYKR.js
  const re = /(?:from\s*|import\s*\(\s*)["']\.\/([\w.\-]+\.js)["']/g;
  for (const m of code.matchAll(re)) {
    if (files.includes(m[1])) collect(m[1], seen);
  }
  return seen;
}

let fail = false;
for (const [name, limit] of Object.entries(LIMITS)) {
  const entry = files.find(f => new RegExp(`^${name}\\.`).test(f));
  if (!entry) {
    console.error(`✗ 未找到 ${name} 的入口产物（期望文件名以 ${name}. 开头）`);
    fail = true;
    continue;
  }
  const all = [...collect(entry)];
  const gz = all.reduce((s, f) => s + gzipSync(readFileSync(join(dir, f))).length, 0);
  const ok = gz <= limit;
  const symbol = ok ? '✓' : '✗';
  console.log(
    `${symbol} ${name}: ${(gz / 1024).toFixed(1)} KB gzip` +
    `（${all.length} chunk，上限 ${(limit / 1024).toFixed(0)} KB）` +
    (ok ? '' : `  ← 超出 ${((gz - limit) / 1024).toFixed(1)} KB`),
  );
  if (!ok) fail = true;
}
process.exit(fail ? 1 : 0);
