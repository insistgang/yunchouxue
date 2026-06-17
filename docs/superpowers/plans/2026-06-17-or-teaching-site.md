# 运筹学教学/科普官网 v1 实施计划（Implementation Plan）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 PRD（`PRD.md` v1.0）所定义的"运筹学教学/科普官网 v1 精品 MVP"——一个 Astro 静态站，含完整设计系统、首页、专题列表、术语表、4 个图文专题及各自的交互可视化演示。

**Architecture:** Astro 5.x（`output: 'static'`）+ Content Collections（zod 校验内容）+ islands 架构。教程正文以零 JS 静态 HTML + 构建期 KaTeX 公式交付；仅 4 个交互演示作为 island 经 `client:visible` 按需水合。所有算法逻辑下沉到 `src/lib/` 纯函数模块（一次性产出"帧/事件序列"，UI 仅按索引渲染第 i 帧，前进/后退只移指针），用 vitest 单测覆盖典型/退化/边界并与 PRD 手算示例交叉验证。视觉用原生 CSS + `tokens.css` 单一真相源，复杂状态 island 用 Preact(~4KB)。

**Tech Stack:** Astro 5 · TypeScript(strict) · MDX · remark-math + rehype-katex + KaTeX · Preact · d3-selection/scale/shape（子包） · 原生 CSS 变量 · vitest · @astrojs/sitemap · astro:assets(Sharp) · pnpm · Vercel + GitHub Actions CI。

---

## 关键共享契约（Cross-Task Contracts — 所有任务必须严格一致）

这些名字/签名/路径是全计划的单一真相源。任何任务引用它们时**必须逐字一致**（路径、类型名、函数名、props 名、CSS 变量名）。

### 包管理与命令
- 包管理器：**pnpm**（带 lockfile）。
- 测试：`pnpm vitest run`（lib 纯函数 + _shared 工具）。
- 类型/内容校验：`pnpm astro check`。
- 构建：`pnpm astro build`。
- 本地预览：`pnpm astro dev`（端口 4321）。

### 目录结构（PRD 10.1，权威）
```
src/
├── content.config.ts            # 'topics' collection + zod schema
├── content/topics/*.mdx         # 4 个旗舰专题
├── data/glossary.ts             # 术语表数据
├── components/
│   ├── ui/                      # Button, Badge, Callout, TopicCard, Breadcrumb, TOC, CodeBlock, MathBlock, Prose
│   ├── layout/                  # Header(Navbar), Footer, MobileMenu
│   ├── seo/                     # BaseHead, JsonLd
│   └── visualizations/          # 4 个 island（.tsx, Preact）+ Figure.astro + _shared/
│       ├── Figure.astro
│       ├── SimplexDemo.tsx
│       ├── DijkstraDemo.tsx
│       ├── MaxflowDemo.tsx
│       ├── KnapsackDemo.tsx
│       └── _shared/             # PlayControls.tsx, Slider.tsx, StatusLog.tsx, colorTokens.ts, reducedMotion.ts, urlState.ts, useTrace.ts
├── layouts/                     # BaseLayout.astro, TopicLayout.astro
├── pages/                       # index.astro, about.astro, glossary.astro, 404.astro, topics/index.astro, topics/[slug].astro
├── styles/                      # tokens.css, global.css, katex-overrides.css
└── lib/                         # simplex.ts, dijkstra.ts, maxflow.ts, knapsack.ts, geometry.ts, types.ts （纯逻辑，可单测）
```

### lib 算法模块 API（权威签名 — 所有 island 据此消费）
所有 trace 函数返回**可序列化的帧数组**，帧含完整状态快照，UI 用 `frames[i]` 渲染、前进/后退移动 `i`。

```ts
// src/lib/types.ts
export type Point = { x: number; y: number };
export type NodeId = string;

// src/lib/simplex.ts
export type LP = {
  c: number[];                         // 目标系数（最大化）
  A: number[][];                       // 约束系数（≤）
  b: number[];                         // 右端项
};
export type SimplexFrame = {
  tableau: number[][];                 // 当前单纯形表
  basis: number[];                     // 基变量索引
  enter: number | null;                // 入基列
  leave: number | null;                // 出基行
  vertex: Point;                       // 对应可行域顶点
  z: number;                           // 当前目标值
  phase: 'judge' | 'ratio' | 'pivot' | 'move' | 'optimal' | 'unbounded' | 'infeasible';
  narration: string;                   // 一句自然语言解说（aria-live）
};
export type SimplexTrace = {
  frames: SimplexFrame[];
  status: 'optimal' | 'unbounded' | 'infeasible';
  optimum: { vertex: Point; z: number } | null;
};
export function solveSimplexTrace(lp: LP): SimplexTrace;

// src/lib/geometry.ts （二维可行域几何，供 SimplexDemo 渲染）
export type HalfPlane = { a1: number; a2: number; b: number }; // a1*x + a2*y <= b
export function feasibleVertices(constraints: HalfPlane[]): Point[];      // 有序凸多边形顶点（含 x,y≥0）
export function objectiveValue(c: number[], p: Point): number;

// src/lib/dijkstra.ts
export type Edge = { from: NodeId; to: NodeId; w: number };
export type Graph = { nodes: { id: NodeId; x: number; y: number }[]; edges: Edge[]; directed: boolean };
export type DijkstraFrame = {
  dist: Record<NodeId, number>;        // +Infinity 表示不可达
  prev: Record<NodeId, NodeId | null>;
  settled: NodeId[];                   // 已确定集合 S
  current: NodeId | null;              // 当前选出的 u*
  relaxing: { edge: Edge; improved: boolean } | null;
  queue: NodeId[];                     // 候选
  phase: 'init' | 'select' | 'relax' | 'done';
  narration: string;
};
export type DijkstraTrace = { frames: DijkstraFrame[] };
export function dijkstraTrace(graph: Graph, source: NodeId): DijkstraTrace;

// src/lib/maxflow.ts
export type FlowNetwork = { nodes: { id: NodeId; x: number; y: number }[]; edges: { from: NodeId; to: NodeId; cap: number }[]; source: NodeId; sink: NodeId };
export type MaxflowFrame = {
  flow: Record<string, number>;        // key `${from}->${to}`
  residual: Record<string, number>;
  bfsVisited: NodeId[];
  bfsQueue: NodeId[];
  parent: Record<NodeId, NodeId | null>;
  augmentPath: NodeId[] | null;        // 当前增广路（节点序列）
  bottleneck: number | null;           // Δ
  value: number;                       // 累计 |f|
  minCut: { S: NodeId[]; T: NodeId[]; edges: { from: NodeId; to: NodeId }[] } | null;
  phase: 'bfs' | 'augment' | 'optimal';
  narration: string;
};
export type MaxflowTrace = { frames: MaxflowFrame[]; maxValue: number };
export function edmondsKarpTrace(net: FlowNetwork): MaxflowTrace;

// src/lib/knapsack.ts
export type Item = { name: string; w: number; v: number };
export type KnapsackFrame = {
  table: number[][];                   // (n+1) x (W+1) DP 表，初始化用 0 填充（与实现一致）
  active: { i: number; w: number } | null;
  candidates: { skip: number; take: number | null };
  chosen: string[];                    // 回溯阶段已选物品
  phase: 'fill' | 'backtrack' | 'done';
  narration: string;
};
export type KnapsackTrace = { frames: KnapsackFrame[]; best: number; chosen: string[] };
export function knapsackTrace(items: Item[], W: number): KnapsackTrace;
```

### _shared 工具 API（权威）
```ts
// src/components/visualizations/_shared/reducedMotion.ts
export function prefersReducedMotion(): boolean;   // 读 matchMedia('(prefers-reduced-motion: reduce)')

// src/components/visualizations/_shared/urlState.ts
export type DemoState = { demo: string; params: Record<string, number>; step: number };
export function encodeState(s: DemoState): string;          // -> 'demo=lp&c1=30&c2=20&step=2'
export function decodeState(search: string, demo: string, defaults: DemoState): DemoState; // 非法/越界回退 defaults
export function replaceUrl(s: DemoState): void;             // history.replaceState，不污染历史栈

// src/components/visualizations/_shared/colorTokens.ts
// 与 tokens.css 8.4 语义色逐一对应（hex 常量），供 SVG/canvas 着色
export const COLORS = { paper:'#FFFFFF', ink:'#1A1A2E', body:'#2D3748', muted:'#4A5568',
  primary:'#1D4E89', accent:'#B45309', success:'#15803D', warning:'#A16207', danger:'#B91C1C', gray200:'#E2E8F0', gray300:'#CBD5E1' } as const;
```

### 设计 token（CSS 变量名，权威 — 见 M0 Task 0.4，对应 PRD 8.4/9.2/9.3/9.4）
`--color-paper --color-canvas --color-surface --color-ink --color-body --color-muted --color-primary --color-primary-700 --color-accent --color-success --color-warning --color-danger --color-focus-ring`；灰阶 `--gray-50..--gray-900`；字号 `--fs-display --fs-h1 --fs-h2 --fs-h3 --fs-body --fs-caption --fs-code --fs-overline`；间距 `--space-1..--space-32`（4px 基准）；圆角 `--radius-sm/-md/-lg`；阴影 `--shadow-xs/-sm/-md/-lg`。

### 内容模型（zod schema 字段，PRD 11.4，权威 — 见 M0 Task 0.7）
`title, summary, difficulty('入门'|'进阶'|'高级'), readingTime?, tags[], theme('线性规划'|'图论'|'网络流'|'动态规划'), cover, coverAlt, hasInteractive, interactiveComponent?, publishDate, updatedDate, prerequisites[], references[{label,url}], draft, order`。专题 URL slug **不入 schema**，由 Astro 5 glob loader 从文件名派生（`topic.id`），路由用 `topic.id`；MDX 文件名即 slug（如 `linear-programming-simplex.mdx`）。

### 提交规范
每个 Task 末尾提交一次。提交信息用 `feat:`/`chore:`/`test:`/`style:` 前缀。每次提交前确保 `pnpm astro check` 与相关 `pnpm vitest run` 通过。

### 验证策略（不同层用不同手段）
- **lib/ + _shared 纯逻辑** → vitest 单测（严格 TDD：先写失败测试）。
- **.astro 组件/页面** → `pnpm astro check` 通过 + 页面构建出 HTML + 对照 PRD 验收编号（如 6.1-1）人工/脚本核对。
- **island 交互** → webapp-testing（Playwright）核对步进/键盘/aria-live；4 演示边界预设逐一过。
- **性能/无障碍** → Lighthouse CI + 逐 island gzip 体积脚本（M5）。

---

## 前置说明

- Node ≥ 20，pnpm ≥ 9。
- 项目当前目录已含 `PRD.md`、`docs/`、`.claude/`。先 `git init` 纳入版本控制（见 M0 Task 0.1）。
- 所有路径以仓库根 `/Users/insistgang/Desktop/zx/yunchouxue/` 为基准；下文写相对路径。

---

# 里程碑 M0 — 地基（Foundation）

**产出**：可构建、可本地预览、可部署的 Astro 空骨架；tokens.css；BaseLayout；content schema；vitest 跑通；CI + Vercel 打通。

### Task 0.1：git 初始化 + 基础忽略

**Files:**
- Create: `.gitignore`
- Create: `.nvmrc`

- [ ] **Step 1: 初始化仓库**

Run:
```bash
cd /Users/insistgang/Desktop/zx/yunchouxue
git init
git branch -M main
```

- [ ] **Step 2: 写 `.gitignore`**

```
node_modules/
dist/
.astro/
.vercel/
*.log
.DS_Store
.env
.env.*
```

- [ ] **Step 3: 写 `.nvmrc`**

```
20
```

- [ ] **Step 4: 首次提交**

```bash
git add .gitignore .nvmrc PRD.md docs/
git commit -m "chore: init repo with PRD and plan"
```

### Task 0.2：pnpm + Astro 脚手架 + 依赖

**Files:**
- Create: `package.json`
- Create: `pnpm-lock.yaml`（由安装生成）

- [ ] **Step 1: 初始化 package.json**

```bash
pnpm init
```

- [ ] **Step 2: 安装 Astro 与集成**

Run:
```bash
pnpm add astro@^5 @astrojs/mdx @astrojs/preact @astrojs/sitemap preact
pnpm add remark-math rehype-katex katex
pnpm add d3-selection d3-scale d3-shape
pnpm add -D typescript @types/node vitest @astrojs/check
```
Expected: 安装成功，生成 `pnpm-lock.yaml`、`node_modules/`。

- [ ] **Step 3: 设置 scripts**

编辑 `package.json` 的 `scripts`：
```json
{
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add astro, katex, preact, vitest deps"
```

### Task 0.3：Astro 配置（静态导出 + KaTeX 构建期渲染 + 集成）

**Files:**
- Create: `astro.config.mjs`
- Create: `tsconfig.json`

- [ ] **Step 1: 写 `tsconfig.json`（strict + Preact JSX）**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "*.config.mjs", "*.config.ts"]
}
```

- [ ] **Step 2: 写 `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://yunchouxue.example.com', // 部署后改为真实域名
  output: 'static',
  integrations: [mdx(), preact({ compat: false }), sitemap()],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [[rehypeKatex, { throwOnError: true, output: 'htmlAndMathml' }]],
  },
});
```

- [ ] **Step 3: 验证脚手架可构建**

Run: `pnpm astro check`
Expected: 0 errors（此刻无 src 也应通过；若提示无页面属正常）。

- [ ] **Step 4: 提交**

```bash
git add astro.config.mjs tsconfig.json
git commit -m "chore: astro static config with build-time KaTeX"
```

### Task 0.4：设计 token（`styles/tokens.css` — 单一真相源）

**Files:**
- Create: `src/styles/tokens.css`

- [ ] **Step 1: 写 tokens.css（颜色/字号/间距/圆角/阴影，对应 PRD 8.4/9.2/9.3/9.4）**

```css
:root {
  /* 背景 */
  --color-paper: #FFFFFF;
  --color-canvas: #FAFAF7;
  --color-surface: #F8FAFC;
  /* 文本 */
  --color-ink: #1A1A2E;
  --color-body: #2D3748;
  --color-muted: #4A5568;
  /* 语义（8.4 唯一真相源） */
  --color-primary: #1D4E89;
  --color-primary-700: #163D6B;
  --color-accent: #B45309;     /* 当前处理中 */
  --color-success: #15803D;    /* 已确定/最优/正确结果/最小割 */
  --color-warning: #A16207;    /* 注意/前提（与 accent 区分） */
  --color-danger: #B91C1C;     /* 失败/不可行（不用于正确结论） */
  --color-focus-ring: #1D4E89;
  /* 灰阶 */
  --gray-50:#F8FAFC; --gray-100:#F1F5F9; --gray-200:#E2E8F0; --gray-300:#CBD5E1;
  --gray-400:#94A3B8; --gray-500:#64748B; --gray-600:#475569; --gray-700:#334155;
  --gray-800:#1E293B; --gray-900:#0F172A;
  /* 字体栈（9.3，全站黑体，无衬线副栈） */
  --font-sans: "Source Han Sans SC","Noto Sans SC","PingFang SC","Inter","Helvetica Neue",Arial,sans-serif;
  --font-mono: "JetBrains Mono","Fira Code",ui-monospace,monospace;
  /* 字号 */
  --fs-display: clamp(2.25rem, 5vw, 3rem); --lh-display:1.15;
  --fs-h1: 2rem;    --lh-h1:1.25;
  --fs-h2: 1.5rem;  --lh-h2:1.3;
  --fs-h3: 1.25rem; --lh-h3:1.35;
  --fs-body: 1.0625rem; --lh-body:1.75;  /* 17px */
  --fs-caption: 0.8125rem; --lh-caption:1.5;
  --fs-code: 0.875rem; --lh-code:1.6;
  --fs-overline: 0.75rem;
  /* 间距 4px 基准 */
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:20px;
  --space-6:24px; --space-8:32px; --space-10:40px; --space-12:48px; --space-16:64px;
  --space-20:80px; --space-24:96px; --space-32:128px;
  /* 圆角 */
  --radius-sm:4px; --radius-md:8px; --radius-lg:12px;
  /* 阴影（极轻） */
  --shadow-xs: 0 1px 2px rgba(15,23,42,.04);
  --shadow-sm: 0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04);
  --shadow-md: 0 4px 12px rgba(15,23,42,.08);
  --shadow-lg: 0 12px 32px rgba(15,23,42,.12);
  /* 布局 */
  --content-width: 720px; --wide-width: 1080px; --nav-height: 64px;
  --transition: 150ms ease;
}
@media (prefers-color-scheme: dark) {
  :root {
    --color-paper:#0F172A; --color-canvas:#0B1220; --color-surface:#1E293B;
    --color-ink:#F1F5F9; --color-body:#E2E8F0; --color-muted:#94A3B8;
    --color-primary:#5B9BD5; --color-primary-700:#7FB3E0;
    --color-accent:#E08A3C; --color-success:#4ADE80; --color-warning:#D9A441; --color-danger:#F87171;
    --color-focus-ring:#5B9BD5;
  }
}
```
> 注：暗色为"可读不破线"档（PRD 9.6/DoD#10），非完整精修。

- [ ] **Step 2: 提交**

```bash
git add src/styles/tokens.css
git commit -m "style: design tokens single source of truth"
```

### Task 0.5：全局基样式（`styles/global.css`）

**Files:**
- Create: `src/styles/global.css`

- [ ] **Step 1: 写 global.css（reset + 排版 + 可达 focus + reduced-motion）**

```css
@import "./tokens.css";
*,*::before,*::after{box-sizing:border-box;}
html{-webkit-text-size-adjust:100%;}
body{margin:0;background:var(--color-paper);color:var(--color-body);
  font-family:var(--font-sans);font-size:var(--fs-body);line-height:var(--lh-body);
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}
h1,h2,h3{color:var(--color-ink);font-weight:700;margin:0 0 var(--space-4);}
h1{font-size:var(--fs-h1);line-height:var(--lh-h1);}
h2{font-size:var(--fs-h2);line-height:var(--lh-h2);}
h3{font-size:var(--fs-h3);line-height:var(--lh-h3);}
a{color:var(--color-primary);text-decoration:none;}
a:hover{text-decoration:underline;}
code,pre{font-family:var(--font-mono);font-size:var(--fs-code);}
:focus-visible{outline:3px solid var(--color-focus-ring);outline-offset:2px;border-radius:var(--radius-sm);}
img{max-width:100%;height:auto;}
.skip-link{position:absolute;left:-999px;top:0;background:var(--color-primary);color:#fff;padding:var(--space-2) var(--space-4);z-index:100;}
.skip-link:focus{left:var(--space-2);top:var(--space-2);}
.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;}
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important;}
}
```

- [ ] **Step 2: 提交**

```bash
git add src/styles/global.css
git commit -m "style: global base styles, focus, reduced-motion"
```

### Task 0.6：SEO head + BaseLayout

**Files:**
- Create: `src/components/seo/BaseHead.astro`
- Create: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: 写 `BaseHead.astro`（title/desc/canonical/OG，PRD 10.6）**

```astro
---
interface Props { title: string; description: string; image?: string; }
const { title, description, image = '/og-default.png' } = Astro.props;
const canonical = new URL(Astro.url.pathname, Astro.site).href;
---
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title}</title>
<meta name="description" content={description} />
<link rel="canonical" href={canonical} />
<meta property="og:type" content="website" />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:image" content={new URL(image, Astro.site).href} />
<meta name="twitter:card" content="summary_large_image" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css" integrity="sha384-..." crossorigin="anonymous" />
```
> KaTeX CSS：M3/M4 改为自托管 + preload（PRD 10.3）；此处临时 CDN 占位以先跑通，自托管在 Task 4.x 落实。

- [ ] **Step 2: 写 `BaseLayout.astro`**

```astro
---
import BaseHead from '@/components/seo/BaseHead.astro';
import '@/styles/global.css';
interface Props { title: string; description: string; image?: string; }
const { title, description, image } = Astro.props;
---
<!doctype html>
<html lang="zh-CN">
  <head><BaseHead title={title} description={description} image={image} /></head>
  <body>
    <a class="skip-link" href="#main">跳到主内容</a>
    <slot name="header" />
    <main id="main"><slot /></main>
    <slot name="footer" />
  </body>
</html>
```

- [ ] **Step 3: 临时首页验证构建**

Create `src/pages/index.astro`:
```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
---
<BaseLayout title="运筹学教学站" description="把运筹学讲清楚的交互式教学站">
  <h1>运筹学教学站</h1>
  <p>地基已就位。</p>
</BaseLayout>
```

Run: `pnpm astro check && pnpm astro build`
Expected: 构建成功，`dist/index.html` 生成，含 `<html lang="zh-CN">` 与 H1。

- [ ] **Step 4: 提交**

```bash
git add src/components/seo/BaseHead.astro src/layouts/BaseLayout.astro src/pages/index.astro
git commit -m "feat: BaseHead SEO + BaseLayout + smoke homepage"
```

### Task 0.7：内容集合 schema（`content.config.ts`）

**Files:**
- Create: `src/content.config.ts`

- [ ] **Step 1: 写 topics 集合 + zod schema（PRD 11.4）**

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const topics = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/topics' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    summary: z.string().max(160),
    difficulty: z.enum(['入门', '进阶', '高级']),
    readingTime: z.number().optional(),
    tags: z.array(z.string()).default([]),
    theme: z.enum(['线性规划', '图论', '网络流', '动态规划']),
    cover: image().optional(),
    coverAlt: z.string().default(''),
    hasInteractive: z.boolean().default(true),
    interactiveComponent: z.enum(['SimplexDemo','DijkstraDemo','MaxflowDemo','KnapsackDemo']).optional(),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date(),
    prerequisites: z.array(z.string()).default([]),
    references: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
    draft: z.boolean().default(false),
    order: z.number().default(0),
  }),
});
export const collections = { topics };
```

- [ ] **Step 2: 占位内容文件让 schema 生效**

Create `src/content/topics/_placeholder.mdx`:
```mdx
---
title: 占位
summary: 占位摘要
difficulty: 入门
theme: 图论
publishDate: 2026-06-17
updatedDate: 2026-06-17
draft: true
---
占位。
```

Run: `pnpm astro check`
Expected: 通过；改坏某字段（如 difficulty 设为非法值）应构建失败 → 验证 schema 生效 → 改回。

- [ ] **Step 3: 提交**

```bash
git add src/content.config.ts src/content/topics/_placeholder.mdx
git commit -m "feat: topics content collection with zod schema"
```

### Task 0.8：vitest 跑通（首个 lib 测试）

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/geometry.ts`
- Create: `src/lib/geometry.test.ts`

- [ ] **Step 1: 写 `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.test.ts'], environment: 'node' } });
```

- [ ] **Step 2: 写失败测试 `src/lib/geometry.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { objectiveValue } from './geometry';

describe('objectiveValue', () => {
  it('计算 c·p', () => {
    expect(objectiveValue([30, 20], { x: 4, y: 0 })).toBe(120);
    expect(objectiveValue([30, 20], { x: 8/3, y: 8/3 })).toBeCloseTo(400/3, 6);
  });
});
```

- [ ] **Step 3: 运行验证失败**

Run: `pnpm vitest run src/lib/geometry.test.ts`
Expected: FAIL（`objectiveValue` 未定义/未导出）。

- [ ] **Step 4: 最小实现 `src/lib/geometry.ts`**

```ts
export type Point = { x: number; y: number };
export type HalfPlane = { a1: number; a2: number; b: number };
export function objectiveValue(c: number[], p: Point): number {
  return c[0] * p.x + c[1] * p.y;
}
```

- [ ] **Step 5: 运行验证通过**

Run: `pnpm vitest run src/lib/geometry.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add vitest.config.ts src/lib/geometry.ts src/lib/geometry.test.ts
git commit -m "test: vitest harness + geometry objectiveValue (TDD)"
```

### Task 0.9：CI + 部署打通

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `vercel.json`

- [ ] **Step 1: 写 CI（PRD 10.4）**

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm astro check
      - run: pnpm vitest run
      - run: pnpm astro build
```

- [ ] **Step 2: 写 `vercel.json`**

```json
{ "buildCommand": "pnpm astro build", "outputDirectory": "dist", "framework": "astro" }
```

- [ ] **Step 3: 提交并推送（用户提供远端后）**

```bash
git add .github/workflows/ci.yml vercel.json
git commit -m "chore: GitHub Actions CI + Vercel config"
```
> 推送与 Vercel 接入需用户提供 GitHub 远端/Vercel 项目（决策门 15.2，M0 前确认）。CI 在远端建立后自动生效。

**M0 完成判据**：`pnpm astro check`、`pnpm vitest run`、`pnpm astro build` 三连通过；`dist/` 生成合法首页；tokens/global 样式与 content schema 就位。

---

# 里程碑 M1 — 设计系统 + 首页 + 术语表

**产出**：10 个核心 UI 组件、完整首页（含 1 个迷你交互钩子）、术语表页。

> 约定：所有组件用 `.astro` + scoped `<style>`，颜色/间距一律引用 tokens 变量，**禁止硬编码颜色**（DoD#4）。

### Task 1.1：Button 组件

**Files:**
- Create: `src/components/ui/Button.astro`

- [ ] **Step 1: 写组件（三级：primary/secondary/text，统一高 40px，PRD 9.5）**

```astro
---
interface Props { href?: string; variant?: 'primary'|'secondary'|'text'; type?: 'button'|'submit'; class?: string; }
const { href, variant = 'primary', type = 'button', class: cls = '' } = Astro.props;
const Tag = href ? 'a' : 'button';
---
<Tag class:list={['btn', `btn--${variant}`, cls]} href={href} type={href ? undefined : type}>
  <slot />
</Tag>
<style>
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--space-2);
    height:40px;padding:0 var(--space-5);border-radius:var(--radius-sm);font-size:var(--fs-body);
    font-weight:600;cursor:pointer;border:1px solid transparent;transition:var(--transition);text-decoration:none;}
  .btn--primary{background:var(--color-primary);color:#fff;}
  .btn--primary:hover{background:var(--color-primary-700);text-decoration:none;}
  .btn--secondary{background:transparent;color:var(--color-primary);border-color:var(--color-primary);}
  .btn--secondary:hover{background:var(--color-surface);}
  .btn--text{background:transparent;color:var(--color-primary);height:auto;padding:var(--space-1) var(--space-2);}
</style>
```

- [ ] **Step 2: 验证**

Run: `pnpm astro check`
Expected: 0 errors。

- [ ] **Step 3: 提交**

```bash
git add src/components/ui/Button.astro
git commit -m "feat: Button component (primary/secondary/text)"
```

### Task 1.2：Badge / overline（分类徽标 + 难度角标）

**Files:**
- Create: `src/components/ui/Badge.astro`

- [ ] **Step 1: 写组件**

```astro
---
interface Props { variant?: 'overline'|'difficulty'|'interactive'; }
const { variant = 'overline' } = Astro.props;
---
<span class:list={['badge', `badge--${variant}`]}><slot /></span>
<style>
  .badge{display:inline-flex;align-items:center;font-size:var(--fs-overline);font-weight:600;}
  .badge--overline{color:var(--color-muted);letter-spacing:.08em;text-transform:uppercase;}
  .badge--difficulty{padding:2px var(--space-2);border-radius:var(--radius-sm);background:var(--gray-100);color:var(--color-muted);}
  .badge--interactive{padding:2px var(--space-2);border-radius:999px;background:var(--color-surface);color:var(--color-primary);border:1px solid var(--color-primary);}
</style>
```

- [ ] **Step 2: 验证 + 提交**

Run: `pnpm astro check`
```bash
git add src/components/ui/Badge.astro && git commit -m "feat: Badge component"
```

### Task 1.3：Callout（info/success/warning/danger）

**Files:**
- Create: `src/components/ui/Callout.astro`

- [ ] **Step 1: 写组件（左 4px 语义边 + 浅底，PRD 9.2/8.4）**

```astro
---
interface Props { type?: 'info'|'success'|'warning'|'danger'; title?: string; }
const { type = 'info', title } = Astro.props;
---
<aside class:list={['callout', `callout--${type}`]} role="note">
  {title && <p class="callout__title">{title}</p>}
  <div class="callout__body"><slot /></div>
</aside>
<style>
  .callout{border-left:4px solid;border-radius:var(--radius-md);padding:var(--space-4) var(--space-5);margin:var(--space-6) 0;}
  .callout__title{font-weight:700;margin:0 0 var(--space-2);color:var(--color-ink);}
  .callout__body{color:var(--color-body);}
  .callout--info{border-color:var(--color-primary);background:color-mix(in srgb,var(--color-primary) 6%,transparent);}
  .callout--success{border-color:var(--color-success);background:color-mix(in srgb,var(--color-success) 8%,transparent);}
  .callout--warning{border-color:var(--color-warning);background:color-mix(in srgb,var(--color-warning) 8%,transparent);}
  .callout--danger{border-color:var(--color-danger);background:color-mix(in srgb,var(--color-danger) 7%,transparent);}
</style>
```

- [ ] **Step 2: 验证 + 提交**

Run: `pnpm astro check`
```bash
git add src/components/ui/Callout.astro && git commit -m "feat: Callout (info/success/warning/danger)"
```

### Task 1.4：CodeBlock + MathBlock

**Files:**
- Create: `src/components/ui/CodeBlock.astro`
- Create: `src/components/ui/MathBlock.astro`

- [ ] **Step 1: 写 CodeBlock（PRD 11.3）**

```astro
---
interface Props { lang?: string; }
const { lang } = Astro.props;
---
<figure class="code">
  {lang && <figcaption class="code__lang">{lang}</figcaption>}
  <pre><slot /></pre>
</figure>
<style>
  .code{margin:var(--space-6) 0;border:1px solid var(--gray-200);border-radius:var(--radius-md);background:var(--gray-100);overflow:hidden;}
  .code__lang{font-size:var(--fs-overline);color:var(--color-muted);padding:var(--space-2) var(--space-4);border-bottom:1px solid var(--gray-200);}
  pre{margin:0;padding:var(--space-4);overflow-x:auto;line-height:var(--lh-code);}
</style>
```

- [ ] **Step 2: 写 MathBlock（块级公式容器，横向可滚，PRD 11.2）**

```astro
---
// 用于在 .astro 中包裹 KaTeX 渲染后的块级公式；MDX 中直接用 $$ 由 rehype-katex 处理
---
<div class="mathblock"><slot /></div>
<style>
  .mathblock{margin:var(--space-6) 0;overflow-x:auto;padding-left:var(--space-4);border-left:1px solid var(--color-primary);}
</style>
```

- [ ] **Step 3: 验证 + 提交**

Run: `pnpm astro check`
```bash
git add src/components/ui/CodeBlock.astro src/components/ui/MathBlock.astro
git commit -m "feat: CodeBlock + MathBlock"
```

### Task 1.5：TopicCard

**Files:**
- Create: `src/components/ui/TopicCard.astro`

- [ ] **Step 1: 写组件（整卡可点 + hover 上移，PRD 6.1-3/6.1-7）**

```astro
---
import Badge from './Badge.astro';
interface Props {
  href: string; theme: string; title: string; summary: string;
  difficulty: string; readingTime?: number; hasInteractive: boolean; coverAlt?: string;
}
const { href, theme, title, summary, difficulty, readingTime, hasInteractive } = Astro.props;
---
<a class="card" href={href}>
  <Badge variant="overline">{theme}</Badge>
  <h3 class="card__title">{title}</h3>
  <p class="card__summary">{summary}</p>
  <div class="card__meta">
    <Badge variant="difficulty">{difficulty}</Badge>
    {readingTime && <span class="card__time">{readingTime} 分钟</span>}
    {hasInteractive && <Badge variant="interactive">含交互</Badge>}
  </div>
</a>
<style>
  .card{display:flex;flex-direction:column;gap:var(--space-2);padding:var(--space-6);
    background:var(--color-surface);border:1px solid var(--gray-200);border-radius:var(--radius-lg);
    transition:var(--transition);text-decoration:none;}
  .card:hover{border-color:var(--color-primary);box-shadow:var(--shadow-md);transform:translateY(-2px);text-decoration:none;}
  .card__title{margin:var(--space-1) 0;color:var(--color-ink);}
  .card:hover .card__title{color:var(--color-primary);}
  .card__summary{color:var(--color-muted);font-size:var(--fs-body);margin:0;}
  .card__meta{display:flex;gap:var(--space-3);align-items:center;margin-top:var(--space-2);}
  .card__time{font-size:var(--fs-caption);color:var(--color-muted);}
</style>
```

- [ ] **Step 2: 验证 + 提交**

Run: `pnpm astro check`
```bash
git add src/components/ui/TopicCard.astro && git commit -m "feat: TopicCard"
```

### Task 1.6：Breadcrumb + TOC

**Files:**
- Create: `src/components/ui/Breadcrumb.astro`
- Create: `src/components/ui/TOC.astro`

- [ ] **Step 1: 写 Breadcrumb**

```astro
---
interface Props { items: { label: string; href?: string }[]; }
const { items } = Astro.props;
---
<nav class="bc" aria-label="面包屑">
  <ol>
    {items.map((it, i) => (
      <li>
        {it.href ? <a href={it.href}>{it.label}</a> : <span aria-current="page">{it.label}</span>}
        {i < items.length - 1 && <span class="bc__sep" aria-hidden="true">/</span>}
      </li>
    ))}
  </ol>
</nav>
<style>
  .bc ol{display:flex;gap:var(--space-2);list-style:none;padding:0;margin:0;font-size:var(--fs-caption);color:var(--color-muted);}
  .bc li{display:flex;gap:var(--space-2);align-items:center;}
</style>
```

- [ ] **Step 2: 写 TOC（IntersectionObserver 高亮当前项，PRD 6.3-5；`≥lg` 显示）**

```astro
---
interface Props { headings: { depth: number; slug: string; text: string }[]; }
const { headings } = Astro.props;
const toc = headings.filter(h => h.depth === 2 || h.depth === 3);
---
<nav class="toc" aria-label="目录">
  <p class="toc__title">目录</p>
  <ul>
    {toc.map(h => <li class={`toc__d${h.depth}`}><a href={`#${h.slug}`} data-slug={h.slug}>{h.text}</a></li>)}
  </ul>
</nav>
<script>
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.toc a')];
  const map = new Map(links.map(l => [l.dataset.slug!, l]));
  const obs = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) {
      links.forEach(l => l.removeAttribute('aria-current'));
      map.get((e.target as HTMLElement).id)?.setAttribute('aria-current', 'true');
    }
  }, { rootMargin: '-80px 0px -70% 0px' });
  document.querySelectorAll('main h2[id], main h3[id]').forEach(h => obs.observe(h));
</script>
<style>
  .toc{position:sticky;top:calc(var(--nav-height) + var(--space-4));font-size:var(--fs-caption);}
  .toc__title{font-weight:700;color:var(--color-ink);margin:0 0 var(--space-2);}
  .toc ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:var(--space-1);}
  .toc__d3{padding-left:var(--space-3);}
  .toc a{color:var(--color-muted);}
  .toc a[aria-current="true"]{color:var(--color-primary);font-weight:600;}
  @media (max-width:1023px){ .toc{display:none;} }
</style>
```

- [ ] **Step 3: 验证 + 提交**

Run: `pnpm astro check`
```bash
git add src/components/ui/Breadcrumb.astro src/components/ui/TOC.astro
git commit -m "feat: Breadcrumb + sticky TOC with scrollspy"
```

### Task 1.7：Header（Navbar）+ MobileMenu + Footer

**Files:**
- Create: `src/components/layout/Header.astro`
- Create: `src/components/layout/MobileMenu.astro`
- Create: `src/components/layout/Footer.astro`

- [ ] **Step 1: 写 Header（sticky 64px、激活下划线、`aria-current`，PRD 6.6-1）**

```astro
---
const path = Astro.url.pathname;
const links = [
  { href: '/topics', label: '专题' },
  { href: '/glossary', label: '术语表' },
  { href: '/about', label: '关于' },
];
const isActive = (href: string) => path === href || path.startsWith(href + '/');
import MobileMenu from './MobileMenu.astro';
---
<header class="nav">
  <div class="nav__inner">
    <a class="nav__brand" href="/">运筹学<span>·教学站</span></a>
    <nav class="nav__links" aria-label="主导航">
      {links.map(l => (
        <a href={l.href} aria-current={isActive(l.href) ? 'page' : undefined}>{l.label}</a>
      ))}
      <a class="nav__gh" href="https://github.com/" target="_blank" rel="noopener" aria-label="GitHub 源码">GitHub</a>
    </nav>
    <MobileMenu links={links} />
  </div>
</header>
<script>
  const nav = document.querySelector('.nav');
  const onScroll = () => nav?.classList.toggle('nav--scrolled', window.scrollY > 4);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
</script>
<style>
  .nav{position:sticky;top:0;z-index:50;height:var(--nav-height);background:var(--color-paper);border-bottom:1px solid var(--gray-200);transition:box-shadow var(--transition);}
  .nav--scrolled{box-shadow:var(--shadow-sm);}
  .nav__inner{max-width:var(--wide-width);height:100%;margin:0 auto;padding:0 var(--space-4);display:flex;align-items:center;justify-content:space-between;}
  .nav__brand{font-weight:700;color:var(--color-ink);}
  .nav__brand span{color:var(--color-muted);font-weight:400;}
  .nav__links{display:flex;gap:var(--space-5);align-items:center;}
  .nav__links a{color:var(--color-body);padding:var(--space-2) 0;border-bottom:2px solid transparent;}
  .nav__links a[aria-current="page"]{color:var(--color-primary);border-bottom-color:var(--color-primary);}
  @media (max-width:1023px){ .nav__links{display:none;} }
</style>
```

- [ ] **Step 2: 写 MobileMenu（汉堡 + 全屏抽屉 + 焦点陷阱 + Esc，PRD 6.6-2）**

```astro
---
interface Props { links: { href: string; label: string }[]; }
const { links } = Astro.props;
---
<button class="hamburger" aria-label="打开菜单" aria-expanded="false" aria-controls="mobile-drawer">☰</button>
<div id="mobile-drawer" class="drawer" hidden>
  <button class="drawer__close" aria-label="关闭菜单">✕</button>
  <nav aria-label="移动导航">
    {links.map(l => <a href={l.href}>{l.label}</a>)}
  </nav>
</div>
<script>
  const btn = document.querySelector<HTMLButtonElement>('.hamburger')!;
  const drawer = document.getElementById('mobile-drawer')!;
  const close = drawer.querySelector<HTMLButtonElement>('.drawer__close')!;
  const open = () => { drawer.hidden = false; btn.setAttribute('aria-expanded','true'); close.focus(); };
  const shut = () => { drawer.hidden = true; btn.setAttribute('aria-expanded','false'); btn.focus(); };
  btn.addEventListener('click', open);
  close.addEventListener('click', shut);
  drawer.addEventListener('keydown', (e) => { if (e.key === 'Escape') shut(); });
</script>
<style>
  .hamburger{display:none;font-size:1.5rem;background:none;border:none;cursor:pointer;color:var(--color-ink);}
  .drawer{position:fixed;inset:0;background:var(--color-paper);z-index:60;padding:var(--space-8);display:flex;flex-direction:column;gap:var(--space-5);}
  .drawer a{font-size:var(--fs-h3);color:var(--color-ink);}
  .drawer__close{align-self:flex-end;font-size:1.5rem;background:none;border:none;cursor:pointer;}
  @media (max-width:1023px){ .hamburger{display:block;} }
</style>
```

- [ ] **Step 3: 写 Footer（多列，PRD 6.6-3）**

```astro
---
const year = new Date().getFullYear();
---
<footer class="ft">
  <div class="ft__inner">
    <div><p class="ft__brand">运筹学·教学站</p><p class="ft__desc">把运筹学讲清楚的交互式教学站。</p></div>
    <nav aria-label="专题"><p class="ft__h">专题</p>
      <a href="/topics/linear-programming-simplex">线性规划</a>
      <a href="/topics/shortest-path-dijkstra">最短路径</a>
      <a href="/topics/max-flow-min-cut">最大流最小割</a>
      <a href="/topics/dynamic-programming-knapsack">动态规划背包</a>
    </nav>
    <nav aria-label="关于"><p class="ft__h">关于</p>
      <a href="/about">关于本站</a><a href="/glossary">术语表</a>
    </nav>
    <div><p class="ft__h">许可</p><p class="ft__desc">代码 MIT · 内容 CC BY-SA 4.0</p><p class="ft__desc">© {year}</p></div>
  </div>
</footer>
<style>
  .ft{border-top:1px solid var(--gray-200);background:var(--color-canvas);margin-top:var(--space-24);}
  .ft__inner{max-width:var(--wide-width);margin:0 auto;padding:var(--space-12) var(--space-4);display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:var(--space-8);}
  .ft__brand{font-weight:700;color:var(--color-ink);margin:0;}
  .ft__h{font-weight:600;color:var(--color-ink);margin:0 0 var(--space-2);}
  .ft nav{display:flex;flex-direction:column;gap:var(--space-1);}
  .ft__desc{color:var(--color-muted);font-size:var(--fs-caption);margin:var(--space-1) 0;}
  @media (max-width:767px){ .ft__inner{grid-template-columns:1fr;} }
</style>
```

- [ ] **Step 4: 把 Header/Footer 接入 BaseLayout 的具名 slot**

Modify `src/layouts/BaseLayout.astro`：在 `<body>` 内用 `<Header />` 填 header slot、`<Footer />` 填 footer slot（import 两组件，替换原 `<slot name=...>` 为直接渲染）。

```astro
---
import BaseHead from '@/components/seo/BaseHead.astro';
import Header from '@/components/layout/Header.astro';
import Footer from '@/components/layout/Footer.astro';
import '@/styles/global.css';
interface Props { title: string; description: string; image?: string; }
const { title, description, image } = Astro.props;
---
<!doctype html>
<html lang="zh-CN">
  <head><BaseHead title={title} description={description} image={image} /></head>
  <body>
    <a class="skip-link" href="#main">跳到主内容</a>
    <Header />
    <main id="main"><slot /></main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 5: 验证 + 提交**

Run: `pnpm astro check && pnpm astro build`
Expected: 构建成功；首页含 sticky 导航与页脚。
```bash
git add src/components/layout/ src/layouts/BaseLayout.astro
git commit -m "feat: Header/Navbar + MobileMenu + Footer wired into layout"
```

### Task 1.8：术语表数据 + 页面

**Files:**
- Create: `src/data/glossary.ts`
- Create: `src/pages/glossary.astro`

- [ ] **Step 1: 写术语数据（PRD 16.1，13 条）**

```ts
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
```

- [ ] **Step 2: 写 glossary 页（PRD 6.5-1：每条含中/英/释义 + 稳定锚点）**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import Breadcrumb from '@/components/ui/Breadcrumb.astro';
import { glossary } from '@/data/glossary';
---
<BaseLayout title="术语表 — 运筹学教学站" description="运筹学核心术语中英对照与释义。">
  <div class="wrap">
    <Breadcrumb items={[{label:'首页',href:'/'},{label:'术语表'}]} />
    <h1>术语表</h1>
    <p class="lead">运筹学核心术语的中英对照与简短释义，正文术语可跳转至此。</p>
    <dl class="glossary">
      {glossary.map(t => (
        <div class="term" id={t.id}>
          <dt>{t.zh} <span class="term__en">{t.en}</span></dt>
          <dd>{t.def}</dd>
        </div>
      ))}
    </dl>
  </div>
</BaseLayout>
<style>
  .wrap{max-width:var(--content-width);margin:0 auto;padding:var(--space-12) var(--space-4);}
  .lead{color:var(--color-muted);}
  .glossary{display:flex;flex-direction:column;gap:var(--space-5);margin-top:var(--space-8);}
  .term{padding-bottom:var(--space-4);border-bottom:1px solid var(--gray-200);scroll-margin-top:calc(var(--nav-height) + var(--space-4));}
  .term dt{font-weight:700;color:var(--color-ink);}
  .term__en{font-weight:400;color:var(--color-muted);font-style:italic;}
  .term dd{margin:var(--space-2) 0 0;color:var(--color-body);}
</style>
```

- [ ] **Step 3: 验证 + 提交**

Run: `pnpm astro check && pnpm astro build`
Expected: `/glossary` 生成，13 条术语各带 `id` 锚点。
```bash
git add src/data/glossary.ts src/pages/glossary.astro
git commit -m "feat: glossary data + page with anchors"
```

### Task 1.9：首页（Hero + 专题网格 + 学习路径 + 迷你钩子占位）

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: 写完整首页（PRD 6.1；迷你交互钩子先用静态占位，M3 后替换为裁剪版 SimplexDemo）**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import TopicCard from '@/components/ui/TopicCard.astro';
import { getCollection } from 'astro:content';

const topics = (await getCollection('topics', t => !t.data.draft))
  .sort((a, b) => a.data.order - b.data.order);
---
<BaseLayout title="运筹学教学站 — 把运筹学讲清楚" description="面向大学生与自学者的运筹学交互式教学站：先建立直觉，再亲手验证，最后形式化。">
  <section class="hero">
    <p class="hero__over">交互式教学 · Explorable Explanations</p>
    <h1 class="hero__title">把运筹学，<br/>讲到看得见、玩得动、能验证</h1>
    <p class="hero__lead">先用具体例子建立几何直觉，再亲手拖动参数验证，最后形式化为定义与公式。</p>
    <div class="hero__cta">
      <a class="btn btn--primary" href="/topics">浏览专题</a>
      <a class="btn btn--secondary" href="/about">了解理念</a>
    </div>
  </section>

  <section class="grid-section">
    <h2>四大旗舰专题</h2>
    <div class="grid">
      {topics.map(t => (
        <TopicCard href={`/topics/${t.id}`} theme={t.data.theme} title={t.data.title}
          summary={t.data.summary} difficulty={t.data.difficulty}
          readingTime={t.data.readingTime} hasInteractive={t.data.hasInteractive} />
      ))}
    </div>
  </section>

  <section class="path">
    <h2>学习路径</h2>
    <ol class="path__list">
      <li>线性规划与单纯形法 — 优化的语言与几何</li>
      <li>最短路径 Dijkstra — 图上的贪心与松弛</li>
      <li>最大流与最小割 — 网络流的对偶之美</li>
      <li>动态规划与 0-1 背包 — 用表换重复</li>
    </ol>
  </section>
</BaseLayout>
<style>
  .hero{max-width:var(--wide-width);margin:0 auto;padding:var(--space-24) var(--space-4) var(--space-16);text-align:left;}
  .hero__over{color:var(--color-muted);font-size:var(--fs-overline);letter-spacing:.08em;text-transform:uppercase;}
  .hero__title{font-size:var(--fs-display);line-height:var(--lh-display);margin:var(--space-4) 0;}
  .hero__lead{color:var(--color-muted);max-width:60ch;font-size:1.125rem;}
  .hero__cta{display:flex;gap:var(--space-4);margin-top:var(--space-8);}
  .btn{display:inline-flex;align-items:center;height:40px;padding:0 var(--space-5);border-radius:var(--radius-sm);font-weight:600;border:1px solid transparent;}
  .btn--primary{background:var(--color-primary);color:#fff;}
  .btn--secondary{color:var(--color-primary);border-color:var(--color-primary);}
  .grid-section, .path{max-width:var(--wide-width);margin:0 auto;padding:var(--space-12) var(--space-4);}
  .grid{display:grid;grid-template-columns:1fr;gap:var(--space-6);margin-top:var(--space-6);}
  @media (min-width:768px){ .grid{grid-template-columns:1fr 1fr;} }
  @media (min-width:1024px){ .grid{grid-template-columns:1fr 1fr 1fr;} }
  .path__list{max-width:60ch;color:var(--color-body);line-height:2;}
</style>
```

- [ ] **Step 2: 验证（PRD 6.1-2 列数断点；6.1-1 唯一 H1）**

Run: `pnpm astro build`
Expected: 首页生成；草稿专题不出现；网格 1/2/3 列随断点（手动在浏览器或 Playwright 核对，M5 统一回归）。
> 此刻 topics 集合仅有 `_placeholder`（draft），网格可能为空——属正常，M4 加入真实专题后填充。

- [ ] **Step 3: 提交**

```bash
git add src/pages/index.astro
git commit -m "feat: homepage hero + topic grid + learning path"
```

**M1 完成判据**：10 个核心组件（Button/Badge/Callout/CodeBlock/MathBlock/TopicCard/Breadcrumb/TOC/Header/Footer，外加 MobileMenu）就位；首页与术语表页构建通过；颜色全部走 token；`pnpm astro check` 0 error。

---

# 里程碑 M2 — 专题模板 + 列表 + 关于 + 404

**产出**：`TopicLayout`（专题详情模板）、`/topics` 可筛选列表（含空状态）、`/about`、`/404`。

### Task 2.1：TopicLayout（专题详情模板）

**Files:**
- Create: `src/layouts/TopicLayout.astro`

- [ ] **Step 1: 写模板（PRD 6.3-1 结构：面包屑→H1+元信息→导语→双栏正文+sticky TOC→文末小结+上下篇→页脚）**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import Breadcrumb from '@/components/ui/Breadcrumb.astro';
import TOC from '@/components/ui/TOC.astro';
import Callout from '@/components/ui/Callout.astro';
import type { CollectionEntry } from 'astro:content';

interface Props {
  topic: CollectionEntry<'topics'>;
  headings: { depth: number; slug: string; text: string }[];
  prev?: { slug: string; title: string };
  next?: { slug: string; title: string };
}
const { topic, headings, prev, next } = Astro.props;
const d = topic.data;
const dateStr = d.updatedDate.toISOString().slice(0, 10);
---
<BaseLayout title={`${d.title} — 运筹学教学站`} description={d.summary} image={d.cover?.src}>
  <div class="topic">
    <Breadcrumb items={[{label:'首页',href:'/'},{label:'专题',href:'/topics'},{label:d.title}]} />
    <header class="topic__head">
      <h1>{d.title}</h1>
      <p class="topic__meta">{d.theme} · {d.difficulty}{d.readingTime ? ` · ${d.readingTime} 分钟` : ''} · 更新于 {dateStr}</p>
      <p class="topic__lead">{d.summary}</p>
    </header>
    <div class="topic__grid">
      <article class="prose"><slot /></article>
      <aside class="topic__toc"><TOC headings={headings} /></aside>
    </div>
    <nav class="topic__nav" aria-label="上下篇">
      {prev && <a class="topic__navlink" href={`/topics/${prev.slug}`}>← {prev.title}</a>}
      {next && <a class="topic__navlink topic__navlink--next" href={`/topics/${next.slug}`}>{next.title} →</a>}
    </nav>
  </div>
</BaseLayout>
<style>
  .topic{max-width:var(--wide-width);margin:0 auto;padding:var(--space-8) var(--space-4) var(--space-16);}
  .topic__head{margin:var(--space-4) 0 var(--space-8);}
  .topic__meta{color:var(--color-muted);font-size:var(--fs-caption);}
  .topic__lead{color:var(--color-body);font-size:1.125rem;max-width:68ch;}
  .topic__grid{display:grid;grid-template-columns:1fr;gap:var(--space-12);}
  @media (min-width:1024px){ .topic__grid{grid-template-columns:minmax(0,var(--content-width)) 1fr;} }
  .topic__nav{display:flex;justify-content:space-between;gap:var(--space-4);margin-top:var(--space-16);padding-top:var(--space-8);border-top:1px solid var(--gray-200);}
  .topic__navlink--next{margin-left:auto;text-align:right;}
</style>
```

- [ ] **Step 2: 写 prose 样式（行宽 68–70ch、H2 衡线、PRD 6.3-2）**

Create `src/styles/prose.css` and `@import` it in `global.css`:
```css
.prose{max-width:70ch;color:var(--color-body);font-size:var(--fs-body);line-height:var(--lh-body);}
.prose h2{margin-top:var(--space-12);padding-top:var(--space-6);border-top:1px solid var(--gray-200);scroll-margin-top:calc(var(--nav-height) + var(--space-4));}
.prose h3{margin-top:var(--space-8);scroll-margin-top:calc(var(--nav-height) + var(--space-4));}
.prose p,.prose ul,.prose ol{margin:var(--space-4) 0;}
.prose .katex-display{overflow-x:auto;overflow-y:hidden;padding:var(--space-2) 0;}
```
Add `@import "./prose.css";` to top of `src/styles/global.css`.

- [ ] **Step 3: 验证 + 提交**

Run: `pnpm astro check`
```bash
git add src/layouts/TopicLayout.astro src/styles/prose.css src/styles/global.css
git commit -m "feat: TopicLayout template + prose styles"
```

### Task 2.2：专题详情路由 `/topics/[slug]`

**Files:**
- Create: `src/pages/topics/[slug].astro`

- [ ] **Step 1: 写动态路由（getStaticPaths + render + headings + 上下篇）**

```astro
---
import { getCollection, render } from 'astro:content';
import TopicLayout from '@/layouts/TopicLayout.astro';

export async function getStaticPaths() {
  const topics = (await getCollection('topics', t => !t.data.draft))
    .sort((a, b) => a.data.order - b.data.order);
  return topics.map((topic, i) => ({
    params: { slug: topic.id },
    props: {
      topic,
      prev: topics[i - 1] && { slug: topics[i - 1].id, title: topics[i - 1].data.title },
      next: topics[i + 1] && { slug: topics[i + 1].id, title: topics[i + 1].data.title },
    },
  }));
}
const { topic, prev, next } = Astro.props;
const { Content, headings } = await render(topic);
---
<TopicLayout topic={topic} headings={headings} prev={prev} next={next}>
  <Content />
</TopicLayout>
```

- [ ] **Step 2: 验证 + 提交**

Run: `pnpm astro check && pnpm astro build`
Expected: 构建通过（此刻无非草稿专题 → 0 条路由，正常）。
```bash
git add src/pages/topics/[slug].astro
git commit -m "feat: topic detail dynamic route"
```

### Task 2.3：专题列表 `/topics`（筛选 + 空状态）

**Files:**
- Create: `src/pages/topics/index.astro`

- [ ] **Step 1: 写列表页（PRD 6.2：主题/难度/含交互筛选，纯前端，JS 关默认全显，空状态 6.2-6）**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import Breadcrumb from '@/components/ui/Breadcrumb.astro';
import TopicCard from '@/components/ui/TopicCard.astro';
import { getCollection } from 'astro:content';
const topics = (await getCollection('topics', t => !t.data.draft)).sort((a,b)=>a.data.order-b.data.order);
const themes = [...new Set(topics.map(t => t.data.theme))];
const difficulties = ['入门','进阶','高级'];
---
<BaseLayout title="专题 — 运筹学教学站" description="全部运筹学专题，可按主题、难度、是否含交互筛选。">
  <div class="wrap">
    <Breadcrumb items={[{label:'首页',href:'/'},{label:'专题'}]} />
    <h1>专题</h1>
    <form class="filters" id="filters">
      <label>主题
        <select name="theme"><option value="">全部</option>{themes.map(t=><option value={t}>{t}</option>)}</select>
      </label>
      <label>难度
        <select name="difficulty"><option value="">全部</option>{difficulties.map(d=><option value={d}>{d}</option>)}</select>
      </label>
      <label class="filters__check"><input type="checkbox" name="interactive" /> 仅含交互</label>
    </form>
    <div class="grid" id="grid">
      {topics.map(t => (
        <div class="grid__item" data-theme={t.data.theme} data-difficulty={t.data.difficulty} data-interactive={String(t.data.hasInteractive)}>
          <TopicCard href={`/topics/${t.id}`} theme={t.data.theme} title={t.data.title}
            summary={t.data.summary} difficulty={t.data.difficulty}
            readingTime={t.data.readingTime} hasInteractive={t.data.hasInteractive} />
        </div>
      ))}
    </div>
    <p class="empty" id="empty" hidden>没有符合条件的专题。<button type="button" id="clear" class="btn btn--text">清除筛选</button></p>
  </div>
</BaseLayout>
<script>
  const form = document.getElementById('filters') as HTMLFormElement;
  const items = [...document.querySelectorAll<HTMLElement>('.grid__item')];
  const empty = document.getElementById('empty')!;
  function apply() {
    const fd = new FormData(form);
    const theme = fd.get('theme'), diff = fd.get('difficulty'), inter = fd.get('interactive');
    let shown = 0;
    for (const it of items) {
      const ok = (!theme || it.dataset.theme === theme)
        && (!diff || it.dataset.difficulty === diff)
        && (!inter || it.dataset.interactive === 'true');
      it.hidden = !ok; if (ok) shown++;
    }
    empty.hidden = shown !== 0;
  }
  form.addEventListener('change', apply);
  document.getElementById('clear')!.addEventListener('click', () => { form.reset(); apply(); });
</script>
<style>
  .wrap{max-width:var(--wide-width);margin:0 auto;padding:var(--space-12) var(--space-4);}
  .filters{display:flex;gap:var(--space-6);flex-wrap:wrap;margin:var(--space-6) 0;align-items:center;}
  .filters label{display:flex;gap:var(--space-2);align-items:center;color:var(--color-muted);font-size:var(--fs-caption);}
  .filters select{padding:var(--space-2);border:1px solid var(--gray-300);border-radius:var(--radius-sm);}
  .grid{display:grid;grid-template-columns:1fr;gap:var(--space-6);}
  @media (min-width:768px){ .grid{grid-template-columns:1fr 1fr;} }
  @media (min-width:1024px){ .grid{grid-template-columns:1fr 1fr 1fr;} }
  .grid__item[hidden]{display:none;}
  .empty{color:var(--color-muted);text-align:center;padding:var(--space-12);}
</style>
```

- [ ] **Step 2: 验证 + 提交**

Run: `pnpm astro check && pnpm astro build`
```bash
git add src/pages/topics/index.astro
git commit -m "feat: topics index with client filtering + empty state"
```

### Task 2.4：关于页 + 404

**Files:**
- Create: `src/pages/about.astro`
- Create: `src/pages/404.astro`

- [ ] **Step 1: 写 about（PRD 6.4-1 七部分）**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import Breadcrumb from '@/components/ui/Breadcrumb.astro';
---
<BaseLayout title="关于 — 运筹学教学站" description="项目定位、内容理念、技术栈与开源许可。">
  <div class="wrap prose">
    <Breadcrumb items={[{label:'首页',href:'/'},{label:'关于'}]} />
    <h1>关于本站</h1>
    <h2>我们做什么</h2><p>把运筹学做成"一本活的入门书"：先建立直觉、再亲手验证、最后形式化。</p>
    <h2>面向谁</h2><p>在校大学生、自学者/转专业者、运筹学与算法爱好者。</p>
    <h2>内容理念</h2><p>遵循 explorable explanations：交互是"轻推已给的例子并主动引导注意现象"，而非空白沙盒。</p>
    <h2>技术栈</h2><p>Astro 静态站 · 构建期 KaTeX 公式 · islands 按需水合 · 零后端。</p>
    <h2>内容许可</h2><p>代码 <a href="https://opensource.org/license/mit" rel="noopener">MIT</a>；内容 <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="noopener">CC BY-SA 4.0</a>。</p>
    <h2>参考资料</h2><p>Bret Victor《Explorable Explanations》、Setosa、VisuAlgo、MIT OpenCourseWare、KaTeX。</p>
    <h2>联系</h2><p>GitHub Issues 反馈与共建。</p>
  </div>
</BaseLayout>
<style>.wrap{max-width:var(--content-width);margin:0 auto;padding:var(--space-12) var(--space-4);}</style>
```

- [ ] **Step 2: 写 404**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
---
<BaseLayout title="页面未找到 — 运筹学教学站" description="未找到该页面。">
  <div class="wrap">
    <h1>404</h1><p>没找到这个页面。</p>
    <p><a class="btn btn--primary" href="/">回首页</a> <a class="btn btn--secondary" href="/topics">浏览专题</a></p>
  </div>
</BaseLayout>
<style>.wrap{max-width:var(--content-width);margin:0 auto;padding:var(--space-24) var(--space-4);text-align:center;}
.btn{display:inline-flex;height:40px;align-items:center;padding:0 var(--space-5);border-radius:var(--radius-sm);font-weight:600;border:1px solid transparent;}
.btn--primary{background:var(--color-primary);color:#fff;}.btn--secondary{color:var(--color-primary);border-color:var(--color-primary);}</style>
```

- [ ] **Step 3: 验证 + 提交**

Run: `pnpm astro check && pnpm astro build`
```bash
git add src/pages/about.astro src/pages/404.astro
git commit -m "feat: about + 404 pages"
```

**M2 完成判据**：`/topics`（筛选+空状态）、`/about`、`/404` 上线；`TopicLayout` 就绪待接内容；构建通过。

---

# 里程碑 M3 — 四个交互演示（lib 算法 TDD + 共享控件 + island）

**产出**：4 个 `lib/*.ts` 纯算法模块（含 vitest 单测，与 PRD 手算示例交叉验证）、`_shared/` 控件与工具、4 个 Preact island。

> 核心模式：lib 的 `*Trace()` 一次性产出 `frames[]`，island 仅渲染 `frames[i]`，前进/后退移动 `i`，零重复计算（PRD 8.3）。先做 lib（可严格 TDD），再做 shared，再做 island。

## M3-A：共享工具与控件

### Task 3.1：reducedMotion + urlState（TDD）

**Files:**
- Create: `src/components/visualizations/_shared/reducedMotion.ts`
- Create: `src/components/visualizations/_shared/urlState.ts`
- Create: `src/components/visualizations/_shared/urlState.test.ts`

- [ ] **Step 1: 写失败测试 urlState.test.ts（PRD 8.7：编码/解码/非法回退）**

```ts
import { describe, it, expect } from 'vitest';
import { encodeState, decodeState } from './urlState';

const defaults = { demo: 'lp', params: { c1: 30, c2: 20 }, step: 0 };

describe('urlState', () => {
  it('encode 产出稳定 query', () => {
    expect(encodeState({ demo: 'lp', params: { c1: 30, c2: 20 }, step: 2 }))
      .toBe('demo=lp&c1=30&c2=20&step=2');
  });
  it('decode 还原状态', () => {
    expect(decodeState('demo=lp&c1=10&c2=5&step=1', 'lp', defaults))
      .toEqual({ demo: 'lp', params: { c1: 10, c2: 5 }, step: 1 });
  });
  it('非法/越界回退默认（step 负、未知参数）', () => {
    expect(decodeState('demo=lp&c1=abc&step=-3', 'lp', defaults)).toEqual(defaults);
  });
  it('demo 不匹配回退默认', () => {
    expect(decodeState('demo=xx&step=1', 'lp', defaults)).toEqual(defaults);
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `pnpm vitest run src/components/visualizations/_shared/urlState.test.ts`
Expected: FAIL（未实现）。

- [ ] **Step 3: 实现 urlState.ts**

```ts
export type DemoState = { demo: string; params: Record<string, number>; step: number };

export function encodeState(s: DemoState): string {
  const parts = [`demo=${s.demo}`];
  for (const [k, v] of Object.entries(s.params)) parts.push(`${k}=${v}`);
  parts.push(`step=${s.step}`);
  return parts.join('&');
}

export function decodeState(search: string, demo: string, defaults: DemoState): DemoState {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if ((q.get('demo') ?? demo) !== demo) return defaults;
  const params: Record<string, number> = {};
  for (const k of Object.keys(defaults.params)) {
    const raw = q.get(k);
    if (raw === null) { params[k] = defaults.params[k]; continue; }
    const n = Number(raw);
    if (!Number.isFinite(n)) return defaults;
    params[k] = n;
  }
  const step = Number(q.get('step') ?? defaults.step);
  if (!Number.isInteger(step) || step < 0) return defaults;
  return { demo, params, step };
}

export function replaceUrl(s: DemoState): void {
  if (typeof history === 'undefined') return;
  history.replaceState(null, '', `?${encodeState(s)}`);
}
```

- [ ] **Step 4: 实现 reducedMotion.ts**

```ts
export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
```

- [ ] **Step 5: 运行验证通过 + 提交**

Run: `pnpm vitest run src/components/visualizations/_shared/urlState.test.ts`
Expected: PASS（4 个用例）。
```bash
git add src/components/visualizations/_shared/urlState.ts src/components/visualizations/_shared/urlState.test.ts src/components/visualizations/_shared/reducedMotion.ts
git commit -m "test: urlState encode/decode/fallback + reducedMotion (TDD)"
```

### Task 3.2：colorTokens + useTrace hook + PlayControls + Slider + StatusLog

**Files:**
- Create: `src/components/visualizations/_shared/colorTokens.ts`
- Create: `src/components/visualizations/_shared/useTrace.ts`
- Create: `src/components/visualizations/_shared/PlayControls.tsx`
- Create: `src/components/visualizations/_shared/Slider.tsx`
- Create: `src/components/visualizations/_shared/StatusLog.tsx`

- [ ] **Step 1: colorTokens.ts（与 tokens.css 8.4 逐一对应）**

```ts
export const COLORS = {
  paper:'#FFFFFF', ink:'#1A1A2E', body:'#2D3748', muted:'#4A5568',
  primary:'#1D4E89', accent:'#B45309', success:'#15803D', warning:'#A16207',
  danger:'#B91C1C', gray200:'#E2E8F0', gray300:'#CBD5E1', gray400:'#94A3B8',
} as const;
```

- [ ] **Step 2: useTrace.ts（帧指针 + 播放/速度/双向步进，统一 0.25x–4x，PRD 8.2；尊重 reduced-motion）**

```ts
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { prefersReducedMotion } from './reducedMotion';

export function useTrace(total: number, opts?: { onStep?: (i: number) => void }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);            // 0.25..4
  const timer = useRef<number | null>(null);

  const clamp = (n: number) => Math.max(0, Math.min(total - 1, n));
  const go = useCallback((n: number) => { const c = clamp(n); setI(c); opts?.onStep?.(c); }, [total]);
  const next = useCallback(() => go(i + 1), [i, go]);
  const prev = useCallback(() => go(i - 1), [i, go]);
  const reset = useCallback(() => { setPlaying(false); go(0); }, [go]);

  useEffect(() => {
    if (!playing) { if (timer.current) clearTimeout(timer.current); return; }
    if (i >= total - 1) { setPlaying(false); return; }
    if (prefersReducedMotion()) { go(i + 1); return; } // 瞬时步进
    const base = 900;
    timer.current = window.setTimeout(() => go(i + 1), base / speed);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [playing, i, speed, total, go]);

  // 键盘：空格播放/暂停、←→ 单步、+/- 调速（PRD 8.2）
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === '+' || e.key === '=') setSpeed(s => Math.min(4, s * 2));
      else if (e.key === '-') setSpeed(s => Math.max(0.25, s / 2));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [next, prev]);

  return { i, playing, speed, setSpeed, setPlaying, next, prev, reset, go };
}
```

- [ ] **Step 3: PlayControls.tsx（上一步/下一步/播放/暂停/重置/速度，原生 button，可见焦点）**

```tsx
interface Props {
  i: number; total: number; playing: boolean; speed: number;
  onPrev: () => void; onNext: () => void; onToggle: () => void; onReset: () => void; onSpeed: (s: number) => void;
}
export default function PlayControls(p: Props) {
  return (
    <div class="pc" role="group" aria-label="演示播放控制">
      <button onClick={p.onPrev} disabled={p.i === 0} aria-label="上一步">⏮ 上一步</button>
      <button onClick={p.onToggle} aria-label={p.playing ? '暂停' : '播放'}>{p.playing ? '⏸ 暂停' : '▶ 播放'}</button>
      <button onClick={p.onNext} disabled={p.i >= p.total - 1} aria-label="下一步">下一步 ⏭</button>
      <button onClick={p.onReset} aria-label="重置">↺ 重置</button>
      <label class="pc__speed">速度
        <select value={String(p.speed)} onChange={(e) => p.onSpeed(Number((e.target as HTMLSelectElement).value))}>
          <option value="0.25">0.25x</option><option value="0.5">0.5x</option>
          <option value="1">1x</option><option value="2">2x</option><option value="4">4x</option>
        </select>
      </label>
      <span class="pc__pos" aria-live="off">{p.i + 1} / {p.total}</span>
      <style>{`
        .pc{display:flex;gap:var(--space-2);flex-wrap:wrap;align-items:center;margin-top:var(--space-4);}
        .pc button{height:40px;padding:0 var(--space-4);border:1px solid var(--color-primary);background:transparent;color:var(--color-primary);border-radius:var(--radius-sm);cursor:pointer;font-size:var(--fs-caption);}
        .pc button:disabled{opacity:.4;cursor:not-allowed;}
        .pc__speed{display:flex;gap:var(--space-1);align-items:center;color:var(--color-muted);font-size:var(--fs-caption);}
        .pc__pos{margin-left:auto;color:var(--color-muted);font-size:var(--fs-caption);}
      `}</style>
    </div>
  );
}
```

- [ ] **Step 4: Slider.tsx（连续参数，实时显值，触摸友好 ≥44px）**

```tsx
interface Props { label: string; min: number; max: number; step?: number; value: number; onInput: (v: number) => void; }
export default function Slider({ label, min, max, step = 1, value, onInput }: Props) {
  return (
    <label class="sld">
      <span class="sld__label">{label}<b>{value}</b></span>
      <input type="range" min={min} max={max} step={step} value={value}
        onInput={(e) => onInput(Number((e.target as HTMLInputElement).value))} />
      <style>{`
        .sld{display:flex;flex-direction:column;gap:var(--space-1);min-width:160px;}
        .sld__label{display:flex;justify-content:space-between;color:var(--color-muted);font-size:var(--fs-caption);}
        .sld input{width:100%;height:44px;accent-color:var(--color-primary);touch-action:none;}
      `}</style>
    </label>
  );
}
```

- [ ] **Step 5: StatusLog.tsx（状态解说栏，写入 aria-live，PRD 8.1/8.5）**

```tsx
export default function StatusLog({ text }: { text: string }) {
  return (
    <p class="status" role="status" aria-live="polite">{text}
      <style>{`.status{margin:var(--space-4) 0 0;padding:var(--space-3) var(--space-4);background:var(--color-surface);border-left:4px solid var(--color-accent);border-radius:var(--radius-sm);color:var(--color-body);font-size:var(--fs-caption);min-height:2.5em;}`}</style>
    </p>
  );
}
```

- [ ] **Step 6: 验证 + 提交**

Run: `pnpm astro check`
```bash
git add src/components/visualizations/_shared/
git commit -m "feat: shared demo controls (useTrace, PlayControls, Slider, StatusLog, colorTokens)"
```

### Task 3.3：Figure 外壳（统一演示容器）

**Files:**
- Create: `src/components/visualizations/Figure.astro`

- [ ] **Step 1: 写外壳（PRD 8.1：标题条/画布/控制/解说/caption）**

```astro
---
interface Props { n: number; title: string; }
const { n, title } = Astro.props;
---
<figure class="figure">
  <figcaption class="figure__head">
    <span class="figure__over">交互演示 / Figure {n}</span>
    <span class="figure__title">{title}</span>
  </figcaption>
  <div class="figure__body"><slot /></div>
  <noscript><p class="figure__noscript">本交互演示需 JavaScript。静态替代图与完整文字说明见下方正文。</p></noscript>
</figure>
<style>
  .figure{margin:var(--space-8) 0;background:var(--color-surface);border:1px solid var(--gray-200);border-radius:var(--radius-md);padding:var(--space-5);}
  .figure__head{display:flex;flex-direction:column;margin-bottom:var(--space-4);}
  .figure__over{font-size:var(--fs-overline);color:var(--color-muted);letter-spacing:.08em;text-transform:uppercase;}
  .figure__title{font-size:var(--fs-h3);color:var(--color-ink);font-weight:700;}
  .figure__noscript{color:var(--color-muted);}
</style>
```

- [ ] **Step 2: 验证 + 提交**

Run: `pnpm astro check`
```bash
git add src/components/visualizations/Figure.astro
git commit -m "feat: reusable Figure demo shell"
```

## M3-B：算法 lib 模块（严格 TDD）+ 对应 island

> 每个演示分两步：先 `lib/*.ts`（写失败测试→实现→通过，用例取自 PRD 手算示例），再 `*Demo.tsx`（消费 `frames[]` 渲染 SVG）。

### Task 3.4：背包 lib（`lib/knapsack.ts`，TDD）

**Files:**
- Create: `src/lib/knapsack.ts`
- Create: `src/lib/knapsack.test.ts`

- [ ] **Step 1: 写失败测试（用例取自 PRD 7.4 预设：贪心反例与正文例）**

```ts
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
```

- [ ] **Step 2: 运行验证失败**

Run: `pnpm vitest run src/lib/knapsack.test.ts` → FAIL。

- [ ] **Step 3: 实现 knapsack.ts（产帧 + 回溯）**

```ts
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
      w -= items[i - 1].w;
      snap({ i, w }, { skip: dp[i - 1][w], take: null }, chosen, 'backtrack', `选中 ${items[i-1].name}，剩余容量 ${w}`);
    } else {
      snap({ i, w }, { skip: dp[i - 1][w], take: null }, chosen, 'backtrack', `第 ${i} 件未选`);
    }
  }
  snap(null, { skip: 0, take: null }, chosen, 'done', `最优值 ${dp[n][W]}，选中 {${chosen.join(', ')}}`);
  return { frames, best: dp[n][W], chosen: chosen.reverse() };
}
```

- [ ] **Step 4: 运行验证通过 + 提交**

Run: `pnpm vitest run src/lib/knapsack.test.ts` → PASS。
```bash
git add src/lib/knapsack.ts src/lib/knapsack.test.ts
git commit -m "test: knapsackTrace with frames + backtrack (TDD)"
```

### Task 3.5：背包 island（`KnapsackDemo.tsx`）

**Files:**
- Create: `src/components/visualizations/KnapsackDemo.tsx`

- [ ] **Step 1: 写 island（SVG DP 网格 + 来源箭头 + 回溯高亮，消费 knapsackTrace；预设 PRD 7.4）**

```tsx
import { useMemo, useState } from 'preact/hooks';
import { knapsackTrace, type Item } from '@/lib/knapsack';
import { useTrace } from './_shared/useTrace';
import PlayControls from './_shared/PlayControls';
import StatusLog from './_shared/StatusLog';
import { COLORS } from './_shared/colorTokens';

const PRESETS: Record<string, { items: Item[]; W: number; label: string }> = {
  textbook: { label: '正文手算例', W: 10, items: [{name:'A',w:2,v:3},{name:'B',w:3,v:4},{name:'C',w:4,v:5},{name:'D',w:5,v:6}] },
  greedyFail: { label: '贪心反例', W: 50, items: [{name:'X',w:10,v:60},{name:'Y',w:20,v:100},{name:'Z',w:30,v:120}] },
  mini: { label: '极简入门例', W: 5, items: [{name:'P',w:1,v:1},{name:'Q',w:2,v:6},{name:'R',w:3,v:10}] },
};

export default function KnapsackDemo() {
  const [preset, setPreset] = useState<keyof typeof PRESETS>('textbook');
  const { items, W } = PRESETS[preset];
  const trace = useMemo(() => knapsackTrace(items, W), [preset]);
  const t = useTrace(trace.frames.length);
  const f = trace.frames[t.i];
  const cell = 38;
  return (
    <div class="ks">
      <label class="ks__preset">预设
        <select value={preset} onChange={(e) => { setPreset((e.target as HTMLSelectElement).value as any); t.reset(); }}>
          {Object.entries(PRESETS).map(([k, v]) => <option value={k}>{v.label}</option>)}
        </select>
      </label>
      <svg role="img" aria-label={`0-1 背包 DP 表，当前 ${f.narration}`}
        viewBox={`0 0 ${(W + 2) * cell} ${(items.length + 2) * cell}`} class="ks__svg">
        {f.table.map((row, i) => row.map((val, w) => {
          const isActive = f.active && f.active.i === i && f.active.w === w;
          // 填表阶段只显示"已生长到"的格（逐格教学，PRD 7.4）；回溯/完成阶段全部显示
          const filled = f.phase !== 'fill' || i === 0
            || (f.active != null && (i < f.active.i || (i === f.active.i && w <= f.active.w)));
          return (
            <g transform={`translate(${(w + 1) * cell},${(i + 1) * cell})`}>
              <rect width={cell - 2} height={cell - 2} rx="3"
                fill={isActive ? COLORS.accent : COLORS.paper} stroke={COLORS.gray300} />
              {filled && <text x={cell/2} y={cell/2} dy="0.35em" text-anchor="middle"
                fill={isActive ? '#fff' : COLORS.body} font-size="13">{val}</text>}
            </g>
          );
        }))}
      </svg>
      <PlayControls i={t.i} total={trace.frames.length} playing={t.playing} speed={t.speed}
        onPrev={t.prev} onNext={t.next} onToggle={() => t.setPlaying(!t.playing)} onReset={t.reset} onSpeed={t.setSpeed} />
      <StatusLog text={f.narration} />
      <details class="ks__alt"><summary>等价文本视图（无障碍）</summary>
        <ol>{trace.frames.map((fr, k) => <li hidden={k !== t.i}>{fr.narration}</li>)}</ol>
      </details>
      <style>{`.ks__svg{width:100%;max-height:480px;background:var(--color-paper);border-radius:var(--radius-sm);}
        .ks__preset,.ks__alt{display:block;margin:var(--space-2) 0;color:var(--color-muted);font-size:var(--fs-caption);}`}</style>
    </div>
  );
}
```
> 说明：来源箭头（正上/左上）与采纳闪烁为增强细节，可在 Step 完善；核心"按帧渲染 + 解说 + 等价文本 + 键盘控制"先达标 DoD#3/#6。URL 同步在 Task 3.12 统一接入。

- [ ] **Step 2: 验证 + 提交**

Run: `pnpm astro check`
```bash
git add src/components/visualizations/KnapsackDemo.tsx
git commit -m "feat: KnapsackDemo island (DP table by frame)"
```

### Task 3.6：Dijkstra lib（`lib/dijkstra.ts`，TDD）

**Files:**
- Create: `src/lib/dijkstra.ts`
- Create: `src/lib/dijkstra.test.ts`

- [ ] **Step 1: 写失败测试（含可达/不可达/相等距离按 ID 字典序）**

```ts
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
```

- [ ] **Step 2: 运行 → FAIL**

Run: `pnpm vitest run src/lib/dijkstra.test.ts`

- [ ] **Step 3: 实现 dijkstra.ts（朴素 O(V²)，产帧；相等按 ID 字典序）**

```ts
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
```

- [ ] **Step 4: 运行 → PASS + 提交**

Run: `pnpm vitest run src/lib/dijkstra.test.ts` → PASS。
```bash
git add src/lib/dijkstra.ts src/lib/dijkstra.test.ts
git commit -m "test: dijkstraTrace with frames (TDD)"
```

### Task 3.7：Dijkstra island（`DijkstraDemo.tsx`）

**Files:**
- Create: `src/components/visualizations/DijkstraDemo.tsx`

- [ ] **Step 1: 写 island（SVG 图 + dist 标号 + 已确定/当前/松弛边着色，消费 dijkstraTrace；预设手工坐标）**

```tsx
import { useMemo, useState } from 'preact/hooks';
import { dijkstraTrace, type Graph } from '@/lib/dijkstra';
import { useTrace } from './_shared/useTrace';
import PlayControls from './_shared/PlayControls';
import StatusLog from './_shared/StatusLog';
import { COLORS } from './_shared/colorTokens';

const TEXTBOOK: Graph = {
  directed: false,
  nodes: [
    {id:'A',x:60,y:120},{id:'B',x:180,y:60},{id:'C',x:180,y:180},
    {id:'D',x:300,y:60},{id:'E',x:300,y:180},{id:'F',x:420,y:120},
  ],
  edges: [
    {from:'A',to:'B',w:2},{from:'A',to:'C',w:4},{from:'B',to:'C',w:1},
    {from:'B',to:'D',w:7},{from:'C',to:'E',w:3},{from:'D',to:'F',w:1},
    {from:'E',to:'D',w:2},{from:'E',to:'F',w:5},
  ],
};
const NEG: Graph = {
  directed: true,
  nodes: [{id:'A',x:60,y:120},{id:'B',x:220,y:60},{id:'C',x:220,y:180},{id:'D',x:380,y:120}],
  edges: [{from:'A',to:'B',w:1},{from:'A',to:'C',w:4},{from:'B',to:'C',w:-3},{from:'C',to:'D',w:1}],
};
const PRESETS: Record<string, { g: Graph; s: string; label: string; warn?: string }> = {
  textbook: { g: TEXTBOOK, s: 'A', label: '教科书小图（6 节点）' },
  negTrap: { g: NEG, s: 'A', label: '负权陷阱（Dijkstra 失效）',
    warn: '含负权边 B→C(-3)：Dijkstra 不保证正确——观察节点出堆"已确定"后又出现更短路却无法修正，应改用 Bellman-Ford。' },
};

export default function DijkstraDemo() {
  const [preset, setPreset] = useState<keyof typeof PRESETS>('textbook');
  const { g, s, warn } = PRESETS[preset];
  const trace = useMemo(() => dijkstraTrace(g, s), [preset]);
  const t = useTrace(trace.frames.length);
  const f = trace.frames[t.i];
  const colorOf = (id: string) =>
    f.settled.includes(id) ? COLORS.success : id === f.current ? COLORS.accent
    : f.queue.includes(id) ? COLORS.primary : COLORS.gray400;
  return (
    <div class="dj">
      <label class="dj__preset">预设
        <select value={preset} onChange={(e)=>{ setPreset((e.target as HTMLSelectElement).value as any); t.reset(); }}>
          {Object.entries(PRESETS).map(([k,v]) => <option value={k}>{v.label}</option>)}
        </select>
      </label>
      {warn && <p class="dj__warn" role="note">⚠ {warn}</p>}
      <svg role="img" aria-label={`最短路演示：${f.narration}`} viewBox="0 0 480 240" class="dj__svg">
        {g.edges.map(e => {
          const a = g.nodes.find(n => n.id === e.from)!, b = g.nodes.find(n => n.id === e.to)!;
          const hot = f.relaxing && f.relaxing.edge.from === e.from && f.relaxing.edge.to === e.to;
          return <g>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hot ? COLORS.accent : COLORS.gray300} stroke-width={hot ? 3 : 1.5} />
            <text x={(a.x+b.x)/2} y={(a.y+b.y)/2 - 4} text-anchor="middle" font-size="11" fill={COLORS.muted}>{e.w}</text>
          </g>;
        })}
        {g.nodes.map(n => (
          <g transform={`translate(${n.x},${n.y})`}>
            <circle r="18" fill="#fff" stroke={colorOf(n.id)} stroke-width="3" />
            <text dy="0.35em" text-anchor="middle" font-size="13" fill={COLORS.ink}>{n.id}</text>
            <text y="-26" text-anchor="middle" font-size="11" fill={COLORS.primary}>{f.dist[n.id] === Infinity ? '∞' : f.dist[n.id]}</text>
          </g>
        ))}
      </svg>
      <PlayControls i={t.i} total={trace.frames.length} playing={t.playing} speed={t.speed}
        onPrev={t.prev} onNext={t.next} onToggle={() => t.setPlaying(!t.playing)} onReset={t.reset} onSpeed={t.setSpeed} />
      <StatusLog text={f.narration} />
      <details class="dj__alt"><summary>等价文本视图（无障碍）</summary>
        <table><thead><tr><th>节点</th><th>dist</th><th>prev</th></tr></thead>
          <tbody>{g.nodes.map(n => <tr><td>{n.id}</td><td>{f.dist[n.id]===Infinity?'∞':f.dist[n.id]}</td><td>{f.prev[n.id]??'—'}</td></tr>)}</tbody>
        </table>
      </details>
      <style>{`.dj__svg{width:100%;background:var(--color-paper);border-radius:var(--radius-sm);}
        .dj__preset{display:block;margin:0 0 var(--space-2);color:var(--color-muted);font-size:var(--fs-caption);}
        .dj__warn{margin:var(--space-1) 0 var(--space-2);padding:var(--space-2) var(--space-3);background:color-mix(in srgb,var(--color-warning) 8%,transparent);border-left:4px solid var(--color-warning);border-radius:var(--radius-sm);font-size:var(--fs-caption);color:var(--color-body);}
        .dj__alt{margin-top:var(--space-2);color:var(--color-muted);font-size:var(--fs-caption);}
        .dj__alt table{border-collapse:collapse;} .dj__alt td,.dj__alt th{border:1px solid var(--gray-200);padding:2px 8px;}`}</style>
    </div>
  );
}
```

- [ ] **Step 2: 验证 + 提交**

Run: `pnpm astro check`
```bash
git add src/components/visualizations/DijkstraDemo.tsx
git commit -m "feat: DijkstraDemo island (graph by frame)"
```

### Task 3.8：最大流 lib（`lib/maxflow.ts`，TDD）

**Files:**
- Create: `src/lib/maxflow.ts`
- Create: `src/lib/maxflow.test.ts`

- [ ] **Step 1: 写失败测试（经典网；验证最大流值与最小割容量相等）**

```ts
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
```

- [ ] **Step 2: 运行 → FAIL**

Run: `pnpm vitest run src/lib/maxflow.test.ts`

- [ ] **Step 3: 实现 maxflow.ts（Edmonds-Karp，残余 + BFS 增广 + 终态最小割，产帧）**

```ts
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
```

- [ ] **Step 4: 运行 → PASS + 提交**

Run: `pnpm vitest run src/lib/maxflow.test.ts` → PASS。
```bash
git add src/lib/maxflow.ts src/lib/maxflow.test.ts
git commit -m "test: edmondsKarpTrace with residual + min-cut (TDD)"
```

### Task 3.9：最大流 island（`MaxflowDemo.tsx`）

**Files:**
- Create: `src/components/visualizations/MaxflowDemo.tsx`

- [ ] **Step 1: 写 island（SVG 有向网络 + 流量/容量标签 + 增广路加粗 + 最小割 success 绿；不用 danger 红标正确结论，PRD 8.4/7.3）**

```tsx
import { useMemo, useState } from 'preact/hooks';
import { edmondsKarpTrace, type FlowNetwork } from '@/lib/maxflow';
import { useTrace } from './_shared/useTrace';
import PlayControls from './_shared/PlayControls';
import StatusLog from './_shared/StatusLog';
import { COLORS } from './_shared/colorTokens';

const CLASSIC: FlowNetwork = {
  source:'s', sink:'t',
  nodes:[{id:'s',x:40,y:120},{id:'a',x:180,y:50},{id:'b',x:180,y:190},{id:'c',x:320,y:50},{id:'d',x:320,y:190},{id:'t',x:460,y:120}],
  edges:[{from:'s',to:'a',cap:10},{from:'s',to:'b',cap:8},{from:'a',to:'c',cap:6},{from:'a',to:'b',cap:2},
    {from:'b',to:'d',cap:9},{from:'c',to:'t',cap:8},{from:'d',to:'c',cap:3},{from:'d',to:'t',cap:7}],
};
const REVERSE: FlowNetwork = {
  source:'s', sink:'t',
  nodes:[{id:'s',x:40,y:120},{id:'u',x:230,y:60},{id:'v',x:230,y:180},{id:'t',x:420,y:120}],
  edges:[{from:'s',to:'u',cap:3},{from:'s',to:'v',cap:2},{from:'u',to:'v',cap:3},{from:'u',to:'t',cap:2},{from:'v',to:'t',cap:3}],
};
const PRESETS: Record<string,{net:FlowNetwork;label:string}> = {
  classic: { net: CLASSIC, label:'教学经典网（6 节点）' },
  reverse: { net: REVERSE, label:'反向边救场网（需反向边撤回）' },
};

export default function MaxflowDemo() {
  const [preset, setPreset] = useState<keyof typeof PRESETS>('classic');
  const { net } = PRESETS[preset];
  const trace = useMemo(() => edmondsKarpTrace(net), [preset]);
  const t = useTrace(trace.frames.length);
  const f = trace.frames[t.i];
  const inPath = (u:string,v:string) => f.augmentPath?.some((n,i)=> n===u && f.augmentPath![i+1]===v) ?? false;
  const inCut = (u:string,v:string) => f.minCut?.edges.some(e=>e.from===u&&e.to===v) ?? false;
  return (
    <div class="mf">
      <label class="mf__preset">预设
        <select value={preset} onChange={(e)=>{ setPreset((e.target as HTMLSelectElement).value as any); t.reset(); }}>
          {Object.entries(PRESETS).map(([k,v]) => <option value={k}>{v.label}</option>)}
        </select>
      </label>
      <svg role="img" aria-label={`最大流演示：${f.narration}`} viewBox="0 0 500 240" class="mf__svg">
        <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill={COLORS.gray400}/></marker></defs>
        {net.edges.map(e => {
          const a = net.nodes.find(n=>n.id===e.from)!, b = net.nodes.find(n=>n.id===e.to)!;
          const cut = inCut(e.from,e.to), path = inPath(e.from,e.to);
          const stroke = cut ? COLORS.success : path ? COLORS.accent : COLORS.gray300;
          return <g>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} stroke-width={cut||path?3:1.5} marker-end="url(#arrow)"/>
            <text x={(a.x+b.x)/2} y={(a.y+b.y)/2-4} text-anchor="middle" font-size="10" fill={COLORS.muted}>{f.flow[`${e.from}->${e.to}`]??0}/{e.cap}</text>
          </g>;
        })}
        {net.nodes.map(n => {
          const isS = f.minCut?.S.includes(n.id);
          return <g transform={`translate(${n.x},${n.y})`}>
            <circle r="16" fill={f.minCut ? (isS?COLORS.success:'#fff') : (f.bfsVisited.includes(n.id)?COLORS.accent:'#fff')} fill-opacity={f.minCut&&isS?0.15:1} stroke={COLORS.primary} stroke-width="2"/>
            <text dy="0.35em" text-anchor="middle" font-size="12" fill={COLORS.ink}>{n.id}</text>
          </g>;
        })}
      </svg>
      <p class="mf__val">当前最大流 |f| = <b>{f.value}</b></p>
      <PlayControls i={t.i} total={trace.frames.length} playing={t.playing} speed={t.speed}
        onPrev={t.prev} onNext={t.next} onToggle={() => t.setPlaying(!t.playing)} onReset={t.reset} onSpeed={t.setSpeed} />
      <StatusLog text={f.narration} />
      <style>{`.mf__svg{width:100%;background:var(--color-paper);border-radius:var(--radius-sm);} .mf__val{color:var(--color-body);font-size:var(--fs-caption);}
        .mf__preset{display:block;margin:0 0 var(--space-2);color:var(--color-muted);font-size:var(--fs-caption);}`}</style>
    </div>
  );
}
```

- [ ] **Step 2: 验证 + 提交**

Run: `pnpm astro check`
```bash
git add src/components/visualizations/MaxflowDemo.tsx
git commit -m "feat: MaxflowDemo island (residual + min-cut by frame)"
```

### Task 3.10：单纯形几何 + lib（`geometry.ts` 扩展 + `simplex.ts`，TDD）

**Files:**
- Modify: `src/lib/geometry.ts`
- Create: `src/lib/geometry.feasible.test.ts`
- Create: `src/lib/simplex.ts`
- Create: `src/lib/simplex.test.ts`

- [ ] **Step 1: 写 geometry 可行域失败测试（PRD 7.1 桌椅工坊）**

```ts
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
```

- [ ] **Step 2: 运行 → FAIL，然后实现 feasibleVertices（含 x,y≥0；两两求交→过滤满足全约束→按极角排序）**

追加到 `src/lib/geometry.ts`：
```ts
export type HalfPlane = { a1: number; a2: number; b: number };
function intersect(p: HalfPlane, q: HalfPlane): Point | null {
  const det = p.a1 * q.a2 - q.a1 * p.a2;
  if (Math.abs(det) < 1e-12) return null;
  return { x: (p.b * q.a2 - q.b * p.a2) / det, y: (p.a1 * q.b - q.a1 * p.b) / det };
}
export function feasibleVertices(constraints: HalfPlane[]): Point[] {
  // 候选交点 = 约束直线两两相交 + 与坐标轴 x=0 / y=0 相交；再过滤满足全部约束且 x,y≥0 者
  const lines: HalfPlane[] = [...constraints, { a1: 1, a2: 0, b: 0 }, { a1: 0, a2: 1, b: 0 }];
  const pts: Point[] = [];
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++) {
      const p = intersect(lines[i], lines[j]);
      if (p && p.x >= -1e-9 && p.y >= -1e-9
        && constraints.every(c => c.a1 * p.x + c.a2 * p.y <= c.b + 1e-9))
        pts.push({ x: Math.max(0, p.x), y: Math.max(0, p.y) });
    }
  // 去重 + 按质心极角排序
  const uniq = pts.filter((p, k) => pts.findIndex(o => Math.abs(o.x-p.x)<1e-6 && Math.abs(o.y-p.y)<1e-6) === k);
  const cx = uniq.reduce((s,p)=>s+p.x,0)/uniq.length, cy = uniq.reduce((s,p)=>s+p.y,0)/uniq.length;
  return uniq.sort((a,b)=> Math.atan2(a.y-cy,a.x-cx) - Math.atan2(b.y-cy,b.x-cx));
}
```
Run: `pnpm vitest run src/lib/geometry.feasible.test.ts` → PASS。

- [ ] **Step 3: 写 simplex 失败测试（PRD 7.1 贯穿示例，迭代至最优）**

```ts
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
});
```

- [ ] **Step 4: 运行 → FAIL，然后实现 simplex.ts（标准 ≤ 最大化单纯形表，Bland 规则防循环，产帧）**

```ts
import type { Point } from './geometry';
export type { Point };
export type LP = { c: number[]; A: number[][]; b: number[] };
export type SimplexFrame = {
  tableau: number[][]; basis: number[]; enter: number | null; leave: number | null;
  vertex: Point; z: number;
  phase: 'judge'|'ratio'|'pivot'|'move'|'optimal'|'unbounded'|'infeasible'; narration: string;
};
export type SimplexTrace = { frames: SimplexFrame[]; status: 'optimal'|'unbounded'|'infeasible'; optimum: { vertex: Point; z: number } | null };

export function solveSimplexTrace(lp: LP): SimplexTrace {
  const m = lp.A.length, n = lp.c.length;
  // 表：m 行约束 + 1 目标行；列：n 决策 + m 松弛 + 1 RHS
  const cols = n + m + 1;
  const T: number[][] = lp.A.map((row, i) => {
    const r = Array(cols).fill(0);
    for (let j = 0; j < n; j++) r[j] = row[j];
    r[n + i] = 1; r[cols - 1] = lp.b[i];
    return r;
  });
  const obj = Array(cols).fill(0);
  for (let j = 0; j < n; j++) obj[j] = -lp.c[j]; // 最大化 → 目标行存 -c
  T.push(obj);
  const basis = Array.from({ length: m }, (_, i) => n + i);
  const frames: SimplexFrame[] = [];
  const vertexOf = (): Point => {
    const val = (j: number) => { const r = basis.indexOf(j); return r === -1 ? 0 : T[r][cols - 1]; };
    return { x: val(0), y: n > 1 ? val(1) : 0 };
  };
  const zOf = () => T[m][cols - 1];
  const snap = (enter: number|null, leave: number|null, phase: SimplexFrame['phase'], narration: string) =>
    frames.push({ tableau: T.map(r => [...r]), basis: [...basis], enter, leave, vertex: vertexOf(), z: zOf(), phase, narration });

  snap(null, null, 'judge', `初始基本可行解：顶点 (0,0)，z=0`);
  let guard = 0;
  while (guard++ < 100) {
    // 判优：目标行最负（Bland：取首个 <0 的列）
    let enter = -1;
    for (let j = 0; j < cols - 1; j++) if (T[m][j] < -1e-9) { enter = j; break; }
    if (enter === -1) { snap(null, null, 'optimal', `所有检验数 ≤0，已最优：z=${zOf().toFixed(3)}`); 
      return { frames, status: 'optimal', optimum: { vertex: vertexOf(), z: zOf() } }; }
    snap(enter, null, 'judge', `选入基列 x${enter+1}（检验数最负/Bland）`);
    // 最小比值
    let leave = -1, best = Infinity;
    for (let i = 0; i < m; i++) if (T[i][enter] > 1e-9) {
      const ratio = T[i][cols - 1] / T[i][enter];
      if (ratio < best - 1e-12) { best = ratio; leave = i; }
    }
    if (leave === -1) { snap(enter, null, 'unbounded', `入基列无正系数 → 无界`); return { frames, status: 'unbounded', optimum: null }; }
    snap(enter, leave, 'ratio', `最小比值检验：第 ${leave+1} 行出基（θ=${best.toFixed(3)}）`);
    // 主元消元
    const piv = T[leave][enter];
    for (let j = 0; j < cols; j++) T[leave][j] /= piv;
    for (let i = 0; i <= m; i++) if (i !== leave && Math.abs(T[i][enter]) > 1e-12) {
      const factor = T[i][enter];
      for (let j = 0; j < cols; j++) T[i][j] -= factor * T[leave][j];
    }
    basis[leave] = enter;
    snap(enter, leave, 'move', `换基消元完成，移动到顶点 (${vertexOf().x.toFixed(2)}, ${vertexOf().y.toFixed(2)})，z=${zOf().toFixed(3)}`);
  }
  return { frames, status: 'optimal', optimum: { vertex: vertexOf(), z: zOf() } };
}
```

- [ ] **Step 5: 运行 → PASS + 提交**

Run: `pnpm vitest run src/lib/simplex.test.ts src/lib/geometry.feasible.test.ts` → PASS。
```bash
git add src/lib/geometry.ts src/lib/geometry.feasible.test.ts src/lib/simplex.ts src/lib/simplex.test.ts
git commit -m "test: feasibleVertices + solveSimplexTrace (TDD)"
```

### Task 3.11：单纯形 island（`SimplexDemo.tsx`）

**Files:**
- Create: `src/components/visualizations/SimplexDemo.tsx`

- [ ] **Step 1: 写 island（SVG 可行域 + 等值线随 c1/c2 滑动 + 最优顶点 success 绿；模式：连续探索 ↔ 单纯形步进，消费 feasibleVertices + solveSimplexTrace）**

```tsx
import { useMemo, useState } from 'preact/hooks';
import { feasibleVertices, objectiveValue, type HalfPlane } from '@/lib/geometry';
import { solveSimplexTrace } from '@/lib/simplex';
import { useTrace } from './_shared/useTrace';
import PlayControls from './_shared/PlayControls';
import Slider from './_shared/Slider';
import StatusLog from './_shared/StatusLog';
import { COLORS } from './_shared/colorTokens';

const CONSTRAINTS: HalfPlane[] = [{ a1:2,a2:1,b:8 }, { a1:1,a2:2,b:8 }];
const SCALE = 40, PAD = 30, MAXV = 9; // 坐标系 0..9
const sx = (x:number)=> PAD + x*SCALE, sy = (y:number)=> 300 - PAD - y*SCALE;

export default function SimplexDemo() {
  const [c1, setC1] = useState(30); const [c2, setC2] = useState(20);
  const [mode, setMode] = useState<'explore'|'step'>('explore');
  const verts = useMemo(() => feasibleVertices(CONSTRAINTS), []);
  const best = useMemo(() => verts.reduce((b,p)=> objectiveValue([c1,c2],p) > objectiveValue([c1,c2],b) ? p : b, verts[0]), [c1,c2,verts]);
  const trace = useMemo(() => solveSimplexTrace({ c:[c1,c2], A:[[2,1],[1,2]], b:[8,8] }), [c1,c2]);
  const t = useTrace(trace.frames.length);
  const stepVertex = trace.frames[t.i]?.vertex ?? best;
  const poly = verts.map(p => `${sx(p.x)},${sy(p.y)}`).join(' ');
  const hi = mode==='step' ? stepVertex : best;
  return (
    <div class="sx">
      <svg role="img" aria-label={`线性规划可行域，目标 ${c1}x1+${c2}x2，最优顶点 (${hi.x.toFixed(2)},${hi.y.toFixed(2)})`} viewBox="0 0 400 300" class="sx__svg">
        <polygon points={poly} fill={COLORS.primary} fill-opacity="0.12" stroke={COLORS.primary} stroke-width="1.5"/>
        {/* 目标函数等值线（过最优顶点） */}
        {(() => { const z = objectiveValue([c1,c2], hi);
          const x0 = 0, y0 = z/c2, x1 = z/c1, y1 = 0;
          return <line x1={sx(x0)} y1={sy(y0)} x2={sx(x1)} y2={sy(y1)} stroke={COLORS.accent} stroke-width="1.5" stroke-dasharray="4 3"/>; })()}
        {verts.map(p => <circle cx={sx(p.x)} cy={sy(p.y)} r="4" fill={COLORS.primary}/>)}
        <circle cx={sx(hi.x)} cy={sy(hi.y)} r="7" fill={COLORS.success}/>
        <text x={sx(hi.x)+10} y={sy(hi.y)-8} font-size="11" fill={COLORS.success}>z={objectiveValue([c1,c2],hi).toFixed(1)}</text>
      </svg>
      <div class="sx__ctrl">
        <Slider label="c₁" min={0} max={50} value={c1} onInput={setC1} />
        <Slider label="c₂" min={0} max={50} value={c2} onInput={setC2} />
        <label class="sx__mode">模式
          <select value={mode} onChange={(e)=>{ setMode((e.target as HTMLSelectElement).value as any); t.reset(); }}>
            <option value="explore">连续探索</option><option value="step">单纯形步进</option>
          </select>
        </label>
      </div>
      {mode==='step' && <PlayControls i={t.i} total={trace.frames.length} playing={t.playing} speed={t.speed}
        onPrev={t.prev} onNext={t.next} onToggle={()=>t.setPlaying(!t.playing)} onReset={t.reset} onSpeed={t.setSpeed} />}
      <StatusLog text={mode==='step' ? (trace.frames[t.i]?.narration ?? '') : `拖动系数：当前最优顶点 (${best.x.toFixed(2)}, ${best.y.toFixed(2)})，z=${objectiveValue([c1,c2],best).toFixed(1)}`} />
      <style>{`.sx__svg{width:100%;max-width:480px;background:var(--color-paper);border-radius:var(--radius-sm);}
        .sx__ctrl{display:flex;gap:var(--space-5);flex-wrap:wrap;align-items:flex-end;margin-top:var(--space-3);}
        .sx__mode{display:flex;flex-direction:column;gap:var(--space-1);color:var(--color-muted);font-size:var(--fs-caption);}`}</style>
    </div>
  );
}
```

- [ ] **Step 2: 验证 + 提交**

Run: `pnpm astro check`
```bash
git add src/components/visualizations/SimplexDemo.tsx
git commit -m "feat: SimplexDemo island (feasible region + contour + step)"
```

### Task 3.12：URL 状态分享接入 4 个 island（PRD 8.7 / DoD#9）

**Files:**
- Modify: `src/components/visualizations/SimplexDemo.tsx`、`DijkstraDemo.tsx`、`MaxflowDemo.tsx`、`KnapsackDemo.tsx`

- [ ] **Step 1: 每个 island 初始化时 decodeState 读 URL、交互时 replaceUrl 写回**

在每个 island 顶部加：
```tsx
import { decodeState, replaceUrl, type DemoState } from './_shared/urlState';
// 例（Simplex）：
const defaults: DemoState = { demo:'lp', params:{ c1:30, c2:20 }, step:0 };
const init = typeof location !== 'undefined' ? decodeState(location.search, 'lp', defaults) : defaults;
// 用 init.params.c1 初始化 c1，交互回调里调用 replaceUrl({demo:'lp',params:{c1,c2},step:t.i})
```
- Simplex：`demo=lp&c1=&c2=&step=`；Dijkstra：`demo=dijkstra&step=`；Maxflow：`demo=maxflow&step=`；Knapsack：`demo=knapsack&preset=&step=`（preset 以索引数字承载，命名遵循 8.7-4 统一约定）。
- 非法/越界由 decodeState 回退默认（PRD 8.7-3）。

- [ ] **Step 2: 验证（Playwright，M5 统一回归此处先冒烟）+ 提交**

Run: `pnpm astro check && pnpm astro build`
```bash
git add src/components/visualizations/
git commit -m "feat: URL state sharing across 4 demos (PRD 8.7)"
```

**M3 完成判据**：4 个 lib 模块单测全绿且与 PRD 手算交叉验证；4 个 island 可按帧双向步进、含播放/速度/重置、状态解说写入 aria-live、等价文本视图、键盘可控；URL 状态可分享；`pnpm vitest run` 与 `pnpm astro check` 通过。

---

# 里程碑 M4 — 内容定稿（4 篇 MDX + 素材）

**产出**：4 篇专题 MDX 正文（含 KaTeX 公式、≥3 道检查理解、术语链接、嵌入对应 island）、4 张封面、4 张演示静态替代图、KaTeX 字体自托管。

> 内容遵循 PRD 11.1 三段式节奏与九段标准章节。每篇正文须使"JS 不加载也能读懂基础内容"（DoD#8/PRD 8.6 交互即必需红线）。
>
> **每篇必做（DoD#7，逐篇验收项）**：为该专题 PRD 10.3 点名的 **≥4 个核心公式**补等价纯文本——在块级公式邻近加一句自然语言解释，或给承载元素加 `aria-label`。各专题清单：线性规划=标准模型/检验数判优/最小比值/贯穿示例；Dijkstra=松弛/初始化/复杂度/最优子结构；最大流=可行流约束/割容量/弱对偶/最大流最小割定理；背包=模型/状态/转移/复杂度。

### Task 4.1：KaTeX 字体自托管 + preload（替换 M0 临时 CDN）

**Files:**
- Modify: `src/components/seo/BaseHead.astro`
- Create: `src/styles/katex-overrides.css`
- Create: `public/katex/`（字体）

- [ ] **Step 1: 本地化 KaTeX CSS 与字体**

```bash
mkdir -p public/katex/fonts
cp node_modules/katex/dist/katex.min.css src/styles/katex-overrides.css
cp node_modules/katex/dist/fonts/*.woff2 public/katex/fonts/
```
编辑 `src/styles/katex-overrides.css` 顶部字体 `url()` 路径指向 `/katex/fonts/`；`@import` 进 `global.css`。

- [ ] **Step 2: BaseHead 移除 CDN link，改为 preload 关键字体（PRD 10.3）**

将 `BaseHead.astro` 中 CDN 的 `<link rel="stylesheet" href="...katex...">` 删除（CSS 已并入 global.css）；加：
```astro
<link rel="preload" as="font" type="font/woff2" href="/katex/fonts/KaTeX_Main-Regular.woff2" crossorigin />
<link rel="preload" as="font" type="font/woff2" href="/katex/fonts/KaTeX_Math-Italic.woff2" crossorigin />
```

- [ ] **Step 3: 验证（构建后公式为静态 HTML，无运行期公式 JS，DoD#7）+ 提交**

Run: `pnpm astro build`，检查 `dist` 中某专题页公式为 `<span class="katex">` 静态结构、无 katex JS chunk。
```bash
git add src/components/seo/BaseHead.astro src/styles/katex-overrides.css public/katex
git commit -m "chore: self-host KaTeX fonts + preload, drop CDN"
```

### Task 4.2：专题一正文 `linear-programming-simplex.mdx`

**Files:**
- Create: `src/content/topics/linear-programming-simplex.mdx`

- [ ] **Step 1: 写 frontmatter + 九段正文 + 嵌入 SimplexDemo（client:visible）+ ≥3 检查理解**

正文骨架（按 PRD 7.1 内容大纲与关键公式逐段成文；公式用 `$...$`/`$$...$$`；术语首现链接 `/glossary#feasible-region` 等）：
```mdx
---
title: 线性规划与单纯形法
summary: 从可行域到最优顶点——看见约束如何围出可行域，理解单纯形法为何沿顶点行走即可求得最优。
difficulty: 进阶
theme: 线性规划
readingTime: 18
tags: [线性规划, 单纯形法, 优化]
hasInteractive: true
interactiveComponent: SimplexDemo
publishDate: 2026-06-17
updatedDate: 2026-06-17
order: 1
references:
  - { label: "Vanderbei, Linear Programming", url: "https://vanderbei.princeton.edu/LPbook/" }
---
import SimplexDemo from '@/components/visualizations/SimplexDemo.tsx';
import Figure from '@/components/visualizations/Figure.astro';
import Callout from '@/components/ui/Callout.astro';

## 直觉引入：桌椅工坊的产量决策
（具体小例子……建立"约束围出可行域、利润沿方向增大"的直觉。）

## 形式化定义：线性规划的语言
标准模型：$\max\ z = c^\top x \quad \text{s.t.}\ Ax \le b,\ x \ge 0$。引入[松弛变量](/glossary#slack-variable) $Ax+s=b$。

## 几何洞察：可行域、等值线与顶点最优
<Figure n={1} title="拖动目标系数，观察最优顶点切换">
  <SimplexDemo client:visible />
</Figure>

## 从顶点到代数 / 方法步骤 / 手算示例 / 复杂度 / 常见误区 / 延伸
（逐段……手算示例迭代到 (8/3,8/3)，z=400/3。）

## 检查理解
1. …… 2. …… 3. ……
```
> 完整成文在执行时按 PRD 7.1 逐段补齐（每段 2–4 自然段）；本任务交付"结构齐全、公式真渲染、演示嵌入、检查理解≥3、术语链接≥1"。

- [ ] **Step 2: 验证 + 提交**

Run: `pnpm astro check && pnpm astro build`（页面生成，公式渲染，island 注水标记存在）。
```bash
git add src/content/topics/linear-programming-simplex.mdx
git commit -m "content: linear programming & simplex topic"
```

### Task 4.3：专题二 `shortest-path-dijkstra.mdx`

**Files:**
- Create: `src/content/topics/shortest-path-dijkstra.mdx`

- [ ] **Step 1: 同 4.2 模式，按 PRD 7.2 成文，嵌入 `DijkstraDemo`，order:2，theme 图论，公式含松弛/初始化/复杂度，检查理解≥3，链接 `/glossary#relaxation`、`#distance-label`**

（frontmatter + 九段 + `<Figure n={1}><DijkstraDemo client:visible/></Figure>` + 检查理解。）

- [ ] **Step 2: 验证 + 提交**

Run: `pnpm astro check && pnpm astro build`
```bash
git add src/content/topics/shortest-path-dijkstra.mdx
git commit -m "content: shortest path Dijkstra topic"
```

### Task 4.4：专题三 `max-flow-min-cut.mdx`

**Files:**
- Create: `src/content/topics/max-flow-min-cut.mdx`

- [ ] **Step 1: 按 PRD 7.3 成文，嵌入 `MaxflowDemo`，order:3，theme 网络流，公式含可行流/割容量/弱对偶/最大流最小割定理，检查理解≥3，链接 `/glossary#residual-network`、`#augmenting-path`、`#minimum-cut`**

- [ ] **Step 2: 验证 + 提交**

Run: `pnpm astro check && pnpm astro build`
```bash
git add src/content/topics/max-flow-min-cut.mdx
git commit -m "content: max-flow min-cut topic"
```

### Task 4.5：专题四 `dynamic-programming-knapsack.mdx`

**Files:**
- Create: `src/content/topics/dynamic-programming-knapsack.mdx`

- [ ] **Step 1: 按 PRD 7.4 成文，嵌入 `KnapsackDemo`，order:4，theme 动态规划，公式含模型/状态/转移/复杂度，手算例 A/B/C/D(W=10) 与 island 预设一致，检查理解≥3，链接 `/glossary#optimal-substructure`、`#overlapping-subproblems`、`#pseudo-polynomial`**

- [ ] **Step 2: 删除占位、验证 + 提交**

```bash
rm src/content/topics/_placeholder.mdx
pnpm astro check && pnpm astro build
```
Expected: 首页/列表出现 4 张真实专题卡片，4 条详情路由生成。
```bash
git add -A src/content/topics/
git commit -m "content: knapsack topic + remove placeholder"
```

### Task 4.6：封面图 + 演示静态替代图（PRD 16.2 / DoD#3 / 12.1-4）

**Files:**
- Create: `src/assets/covers/*.{svg,png}`（4 张）
- Create: 各 island 的 `<noscript>` 静态替代图引用

- [ ] **Step 1: 制作 4 张学术克制风格封面（矢量优先，1200×630 兼 OG），放 `src/assets/covers/`，在各 MDX frontmatter `cover` 引用**

（设计产出；遵守 PRD 9.1 反 AI slop。可先用 SVG 占位排版，M5 前替换终稿。）

- [ ] **Step 2: 为 4 个 island 增加 `<noscript>` 静态替代图 + 文字说明（演示终态快照）**

在每个 `*Demo.tsx` 外层的 `Figure.astro` 已含 `<noscript>` 文案；补充各专题 MDX 中在 `<Figure>` 内放一张终态 PNG/SVG 于 `<noscript>` 兜底，alt 完整描述（DoD#3）。

- [ ] **Step 3: 验证 + 提交**

Run: `pnpm astro build`（封面经 astro:assets 输出 AVIF/WebP + srcset）。
```bash
git add src/assets src/content/topics
git commit -m "content: topic covers + demo static fallbacks"
```

**M4 完成判据**：4 篇专题 MDX 九段齐全、公式真渲染、各嵌一个 island、检查理解≥3、术语链接、封面与兜底图就位；首页/列表/详情串联完整；占位文件已删。

---

# 里程碑 M5 — 打磨 + 验收（对照 DoD）

**产出**：无障碍/性能/响应式/iOS 回归通过；逐 island gzip 体积门禁；JSON-LD/sitemap；对照 12 项 DoD 全绿后上线。

### Task 5.1：JSON-LD 结构化数据 + sitemap robots（PRD 10.6 / DoD#12）

**Files:**
- Create: `src/components/seo/JsonLd.astro`
- Create: `public/robots.txt`
- Modify: `TopicLayout.astro`、`pages/topics/index.astro`

- [ ] **Step 1: 写 JsonLd（详情页 Article/LearningResource，列表 ItemList/BreadcrumbList，站点 WebSite）**

```astro
---
interface Props { json: Record<string, unknown>; }
const { json } = Astro.props;
---
<script type="application/ld+json" set:html={JSON.stringify(json)} />
```
在 `TopicLayout` 注入 Article（含 datePublished/dateModified/author/educationalLevel=difficulty）。

- [ ] **Step 2: robots.txt 声明 sitemap**

```
User-agent: *
Allow: /
Sitemap: https://yunchouxue.example.com/sitemap-index.xml
```

- [ ] **Step 3: 验证（构建后 JSON-LD 合法、sitemap 含 4 专题不含 draft）+ 提交**

Run: `pnpm astro build`
```bash
git add src/components/seo/JsonLd.astro public/robots.txt src/layouts/TopicLayout.astro src/pages/topics/index.astro
git commit -m "feat: JSON-LD structured data + robots/sitemap"
```

### Task 5.2：逐 island gzip 体积门禁脚本（PRD 10.5 / DoD#5）

**Files:**
- Create: `scripts/check-island-budget.mjs`
- Modify: `.github/workflows/ci.yml`、`package.json`

- [ ] **Step 1: 写体积检查脚本（构建后对 4 个 island chunk 逐一 gzip 实测，超硬上限退出码 1）**

```js
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

// 用「完整组件入口名」避免 SimplexHook 串到 SimplexDemo；上限含该 island 的全部静态/动态依赖（Preact + _shared 共享 chunk）
const LIMITS = { SimplexDemo: 30_000, DijkstraDemo: 40_000, MaxflowDemo: 45_000, KnapsackDemo: 28_000 };
const dir = 'dist/_astro';
const files = readdirSync(dir).filter(f => f.endsWith('.js'));

// 沿入口 chunk 的 import/import() 链递归收集依赖（hash 文件名含 . 与 -）
function collect(entry, seen = new Set()) {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const code = readFileSync(join(dir, entry), 'utf8');
  const re = /(?:from\s*|import\s*\(\s*)["']\.\/([\w.-]+\.js)["']/g;
  for (const m of code.matchAll(re)) if (files.includes(m[1])) collect(m[1], seen);
  return seen;
}

let fail = false;
for (const [name, limit] of Object.entries(LIMITS)) {
  const entry = files.find(f => new RegExp(`^${name}\\.`).test(f));
  if (!entry) { console.error(`✗ 未找到 ${name} 的入口产物`); fail = true; continue; }
  const all = [...collect(entry)];
  const gz = all.reduce((s, f) => s + gzipSync(readFileSync(join(dir, f))).length, 0);
  const ok = gz <= limit;
  console.log(`${ok ? '✓' : '✗'} ${name}: ${(gz/1024).toFixed(1)}KB gzip（含 ${all.length} 个 chunk，上限 ${(limit/1024).toFixed(0)}KB）`);
  if (!ok) fail = true;
}
process.exit(fail ? 1 : 0);
```
> 注：Astro/Vite 会把 island 入口产物命名为 `SimplexDemo.<hash>.js`；若构建未按组件名输出入口，需在 `astro.config.mjs` 的 `build.rollupOptions.output.manualChunks` 或 `entryFileNames` 中固定 island 入口命名，确保脚本能按 `^SimplexDemo\.` 定位。
package.json 加 `"check:budget": "node scripts/check-island-budget.mjs"`；CI 在 `astro build` 后加 `pnpm check:budget`。

- [ ] **Step 2: 运行验证 + 提交**

Run: `pnpm astro build && pnpm check:budget`
Expected: 4 个 island 均 ≤ 硬上限（超限则按 PRD 10.5 降级路径处理后再过）。
```bash
git add scripts/check-island-budget.mjs .github/workflows/ci.yml package.json
git commit -m "chore: per-island gzip budget gate in CI"
```

### Task 5.3：无障碍回归（Playwright + axe，DoD#6）

**Files:**
- Create: `tests/e2e/a11y.spec.ts`

- [ ] **Step 1: 用 webapp-testing（Playwright）核对：键盘全程操作 4 演示与导航、aria-live 播报、对比度、focus 可见、reduced-motion**

测点（每条对应 DoD/PRD 验收编号）：
- 导航 Tab 可达、移动抽屉焦点陷阱 + Esc（6.6-2）。
- 4 个演示：空格播放/暂停、←→ 单步、+/- 调速；`role=status aria-live` 文本随步进更新（8.5）。
- 每个演示有"等价文本视图"可展开（8.5）。
- 注入 axe-core 跑每页，0 critical 违规。

- [ ] **Step 2: 修复发现的问题 + 提交**

```bash
git add tests/e2e/a11y.spec.ts
git commit -m "test: a11y e2e (keyboard, aria-live, axe)"
```

### Task 5.4：响应式 + iOS Safari 专项（PRD 12.1 / DoD#8）

**Files:**
- Create: `tests/e2e/responsive.spec.ts`

- [ ] **Step 1: Playwright 在 375/768/1280 三档 + iOS Safari/Android Chrome 设备模拟跑 12.1-1..5**

- 375px：4 演示画布等比不溢出、控件下移、手柄 ≥44px（12.1-3）。
- SVG 按 devicePixelRatio 清晰；`touch-action` 不误缩放（12.1-1/2）。
- JS 失败时显示静态替代图 + 文字（12.1-4）。
- 4 演示双向步进无白屏（12.1-5）。

- [ ] **Step 2: 修复 + 提交**

```bash
git add tests/e2e/responsive.spec.ts
git commit -m "test: responsive + iOS Safari e2e"
```

### Task 5.5：Lighthouse 性能门禁（DoD#5）

**Files:**
- Create: `lighthouserc.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: 配置 Lighthouse CI（性能≥95、CWV：LCP<2.0s/INP<200ms/CLS<0.1；首页 JS≤50KB/CSS≤20KB gzip）**

```json
{ "ci": { "collect": { "staticDistDir": "./dist", "url": ["http://localhost/","http://localhost/topics/linear-programming-simplex"] },
  "assert": { "assertions": { "categories:performance": ["error", {"minScore": 0.95}], "categories:accessibility": ["error", {"minScore": 0.95}] } } } }
```
CI 加 Lighthouse CI 步骤。

- [ ] **Step 2: 运行 + 调优至达标 + 提交**

```bash
git add lighthouserc.json .github/workflows/ci.yml
git commit -m "chore: Lighthouse CI perf/a11y gate"
```

### Task 5.6：暗色可读 + URL 分享 e2e（DoD#9/#10）

**Files:**
- Create: `tests/e2e/dark-and-share.spec.ts`

- [ ] **Step 1: Playwright 模拟 `prefers-color-scheme: dark` 核对页面与 4 演示画布对比度不破线（10）；URL 分享：调参/步进后复制 URL 新开复现同状态、非法 query 回退（8.7 全部 / DoD#9）**

- [ ] **Step 2: 修复 + 提交**

```bash
git add tests/e2e/dark-and-share.spec.ts
git commit -m "test: dark-mode readability + URL share e2e"
```

### Task 5.7：首页迷你交互钩子接入（PRD 6.1-4 / 决策门 15.2）

**Files:**
- Modify: `src/pages/index.astro`
- Create: `src/components/visualizations/SimplexHook.tsx`（SimplexDemo 轻量裁剪：仅 c1/c2 滑块 + 等值线，无步进）

- [ ] **Step 1: 写裁剪版钩子并以 `client:visible` 嵌入首页 Hero 下方（6.1-4 进入视口前不加载 JS）**

- [ ] **Step 2: 验证（首页 JS gzip ≤50KB 仍达标）+ 提交**

Run: `pnpm astro build && pnpm check:budget`
```bash
git add src/pages/index.astro src/components/visualizations/SimplexHook.tsx
git commit -m "feat: homepage mini interactive hook (trimmed simplex)"
```

### Task 5.8：DoD 终检 + 上线

- [ ] **Step 1: 逐条核对 PRD 第 13 节 12 项 DoD**，建 `docs/superpowers/dod-checklist.md` 勾选每项并附证据（命令输出/截图/测试报告）。
- [ ] **Step 2: 全量门禁**：`pnpm astro check && pnpm vitest run && pnpm astro build && pnpm check:budget` 全绿；Lighthouse/axe/responsive e2e 全过。
- [ ] **Step 3: 合并到 main，触发 Vercel 生产部署**，线上复跑 4 演示与公式渲染冒烟。
- [ ] **Step 4: 提交收尾**

```bash
git add docs/superpowers/dod-checklist.md
git commit -m "docs: v1 DoD checklist signed off"
```

**M5 完成判据 = v1 上线**：PRD 第 13 节 12 项 DoD 全部满足；CI 绿灯并成功部署 Vercel；线上 4 演示、公式、响应式、无障碍冒烟通过。

---

## 全局自检（Plan Self-Review）

- **Spec 覆盖**：PRD 第 5–17 节每条主要需求均映射到任务——页面（M1/M2）、4 专题与演示（M3/M4）、交互通用规范 8.x（M3 _shared + 各 island）、视觉系统 9.x（M0 tokens + M1 组件）、技术架构 10.x（M0 + M3 + M5）、内容规范 11.x（M4）、非功能 12.x（M5）、DoD 13（M5.8 逐条）。URL 分享 8.7→Task 3.12 + 5.6；逐 island 预算 10.5→Task 5.2；术语表 16.1→Task 1.8；许可 17.3→about（2.4）。
- **占位符**：无 TODO/TBD；MDX 正文段落标注"执行时按 PRD 7.x 逐段补齐"是内容创作动作而非代码占位（结构、frontmatter、嵌入、验收均已具体）。
- **类型一致性**：lib 函数名/类型（`solveSimplexTrace`/`dijkstraTrace`/`edmondsKarpTrace`/`knapsackTrace`、`*Frame`/`*Trace`、`feasibleVertices`/`objectiveValue`）、_shared API（`encodeState`/`decodeState`/`replaceUrl`/`prefersReducedMotion`/`useTrace`/`COLORS`）、组件名（`SimplexDemo` 等，与 content schema `interactiveComponent` enum 一致）、CSS token 名跨任务统一，源自顶部"关键共享契约"。
- **依赖顺序**：M0→M1→M2→M3→M4→M5；M4 内容依赖 M3 island；M5 门禁依赖前序全部。

## 执行建议

按 superpowers:subagent-driven-development 逐任务执行：每个 Task 一个 fresh subagent，完成后两段式审查再进下一个。lib/_shared 任务严格 TDD（先红后绿）；.astro/island 任务以 `astro check` + 构建 + 对应 PRD 验收编号为完成证据；M5 用 webapp-testing 做 e2e 回归。
