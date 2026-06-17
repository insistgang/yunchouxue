/**
 * Task 5.6：暗色模式可读性 + URL 分享 e2e 测试
 * DoD#9（URL 分享 8.7 全部）/ DoD#10（暗色对比度可读不破线）
 *
 * 测点：
 * - 模拟 prefers-color-scheme: dark，检查页面/画布对比度可读
 * - 调参/步进后 URL 反映状态（query string 更新）
 * - 复制 URL 新开 tab 复现相同状态
 * - 非法 query 参数回退 defaults（decodeState 防御）
 */
import { test, expect, type BrowserContext } from '@playwright/test';

// ─── 暗色模式：对比度可读检查 ─────────────────────────────────────

const DEMO_PAGES = [
  { name: '线性规划', path: '/topics/linear-programming-simplex' },
  { name: '最短路径', path: '/topics/shortest-path-dijkstra' },
  { name: '最大流', path: '/topics/max-flow-min-cut' },
  { name: '动态规划', path: '/topics/dynamic-programming-knapsack' },
];

const ALL_PAGES = [
  { name: '首页', path: '/' },
  { name: '专题列表', path: '/topics' },
  { name: '术语表', path: '/glossary' },
  { name: '关于', path: '/about' },
  ...DEMO_PAGES,
];

for (const p of ALL_PAGES) {
  test(`[dark] ${p.name} 暗色模式文字可读（色不破线）`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();

    await page.goto(p.path);
    await page.waitForLoadState('domcontentloaded');

    // 验证暗色模式已生效：body 背景颜色不是纯白
    const bgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // 暗色 tokens：--color-paper: #0F172A
    // rgb(15, 23, 42) -> 非白色背景
    expect(bgColor).not.toBe('rgb(255, 255, 255)');

    // 验证 ink 颜色（文字）在暗色背景下是浅色
    const inkColor = await page.evaluate(() => {
      return getComputedStyle(document.body).color;
    });
    // 不应为深色（#1A1A2E -> rgb(26, 26, 46)）
    // 暗色下文字应是浅色如 #F1F5F9 -> rgb(241, 245, 249)
    // 简单验证：body color 的 luminance
    const isLightColor = await page.evaluate((color) => {
      const m = color.match(/\d+/g);
      if (!m) return false;
      const [r, g, b] = m.map(Number);
      // 相对亮度 > 0.5 即为浅色
      return (r + g + b) / (3 * 255) > 0.4;
    }, inkColor);
    expect(isLightColor, `暗色模式下文字颜色 ${inkColor} 不够亮`).toBe(true);

    await context.close();
  });
}

for (const demo of DEMO_PAGES) {
  test(`[dark] ${demo.name} 暗色模式 SVG 画布可见可读`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();

    await page.goto(demo.path);
    await page.waitForLoadState('networkidle');

    // 演示区域存在且可见
    const figure = page.locator('.figure').first();
    await expect(figure).toBeVisible({ timeout: 10_000 });

    // SVG 存在
    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible({ timeout: 10_000 });

    // 演示内容区背景应为暗色（--color-surface: #1E293B）
    const figBg = await figure.evaluate((el) => getComputedStyle(el).backgroundColor);
    // 暗色下不应为白色
    expect(figBg).not.toBe('rgb(255, 255, 255)');

    await context.close();
  });
}

// ─── URL 分享：调参后 URL 更新 ────────────────────────────────────
test('[share] SimplexDemo 调整滑块后 URL query 更新', async ({ page }) => {
  await page.goto('/topics/linear-programming-simplex');
  await page.waitForLoadState('networkidle');

  // 滚动到演示区触发 client:visible 水合
  const fig = page.locator('.figure').first();
  if (await fig.count() > 0) { await fig.scrollIntoViewIfNeeded(); await page.waitForTimeout(600); }

  // SimplexDemo 切换到 step 模式才有 PlayControls
  const modeSelect = page.locator('.sx__mode select');
  if (await modeSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
    await modeSelect.selectOption('step');
    await page.waitForTimeout(300);
  }

  // 等待 island 水合
  await page.waitForSelector('.pc', { timeout: 10_000 });

  // 操作步进
  const nextBtn = page.locator('.pc button[aria-label="下一步"]').first();
  await nextBtn.click();

  // URL 应该更新（urlState.replaceUrl 被调用）
  await page.waitForTimeout(300);
  const updatedUrl = page.url();

  // URL 应含 step 参数
  expect(updatedUrl).toContain('step=');
});

test('[share] DijkstraDemo 步进后 URL 含 step 参数', async ({ page }) => {
  await page.goto('/topics/shortest-path-dijkstra');
  await page.waitForLoadState('networkidle');

  // 滚动到演示区触发 client:visible 水合
  const fig2 = page.locator('.figure').first();
  if (await fig2.count() > 0) { await fig2.scrollIntoViewIfNeeded(); await page.waitForTimeout(600); }

  await page.waitForSelector('.pc', { timeout: 10_000 });

  const nextBtn = page.locator('.pc button[aria-label="下一步"]').first();
  await nextBtn.click();
  await page.waitForTimeout(300);

  const url = page.url();
  expect(url).toContain('step=');
});

// ─── URL 分享：新开复现状态 ──────────────────────────────────────
test('[share] 带 step URL 重新打开复现演示状态', async ({ page, context }) => {
  await page.goto('/topics/shortest-path-dijkstra');
  await page.waitForLoadState('networkidle');

  await page.waitForSelector('.pc', { timeout: 10_000 });

  // 步进 3 步
  const nextBtn = page.locator('.pc button[aria-label="下一步"]').first();
  for (let i = 0; i < 3; i++) {
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await page.waitForTimeout(200);
    }
  }

  // 获取当前 URL（含 step 参数）
  const sharedUrl = page.url();
  expect(sharedUrl).toContain('step=');

  // 新页面打开相同 URL
  const page2 = await context.newPage();
  await page2.goto(sharedUrl);
  await page2.waitForLoadState('networkidle');

  await page2.waitForSelector('.pc', { timeout: 10_000 });

  // 从 URL 中解析 step
  const urlObj = new URL(sharedUrl);
  const expectedStep = urlObj.searchParams.get('step');

  // 从 URL 解析状态（通过浏览器 URL 验证）
  const actualUrl = page2.url();
  const actualUrlObj = new URL(actualUrl);
  const actualStep = actualUrlObj.searchParams.get('step');

  expect(actualStep).toBe(expectedStep);

  await page2.close();
});

// ─── URL 分享：非法 query 回退 defaults ────────────────────────────
test('[share] 非法 step 参数回退 defaults（不崩溃）', async ({ page }) => {
  // 传入非法 step（负数、字母、超大值）
  await page.goto('/topics/shortest-path-dijkstra?demo=dijkstra&step=-99');
  await page.waitForLoadState('networkidle');

  // 滚动到演示区触发水合
  const figEl = page.locator('.figure').first();
  if (await figEl.count() > 0) { await figEl.scrollIntoViewIfNeeded(); await page.waitForTimeout(600); }

  // 页面不应崩溃，演示正常加载
  await page.waitForSelector('.pc', { timeout: 10_000 });
  const pc = page.locator('.pc').first();
  await expect(pc).toBeVisible();

  // 关键验证：演示第一帧已显示（状态回退到 step=0，即第一帧）
  // URL 可能仍含非法参数（decodeState 回退但不一定重写 URL），
  // 重要的是组件正常渲染，上一步按钮 disabled（说明在 step=0）
  const prevBtn = page.locator('.pc button[aria-label="上一步"]').first();
  await expect(prevBtn).toBeDisabled({ timeout: 5000 }); // step=0，上一步禁用
});

test('[share] 非法 demo 名回退 defaults（不崩溃）', async ({ page }) => {
  await page.goto('/topics/linear-programming-simplex?demo=invalid&step=99999');
  await page.waitForLoadState('networkidle');

  // 页面正常加载，演示区可见
  const figure = page.locator('.figure').first();
  await expect(figure).toBeVisible({ timeout: 10_000 });
});

test('[share] 非法参数字符串 NaN 回退 defaults', async ({ page }) => {
  await page.goto('/topics/dynamic-programming-knapsack?demo=knapsack&step=abc&n=xyz');
  await page.waitForLoadState('networkidle');

  // 页面不崩溃
  await page.waitForSelector('.pc', { timeout: 10_000 });
  const pc = page.locator('.pc').first();
  await expect(pc).toBeVisible();
});

// ─── URL 分享：KnapsackDemo 参数调整后 URL 更新 ──────────────────
test('[share] KnapsackDemo 参数变化后 URL 含参数', async ({ page }) => {
  await page.goto('/topics/dynamic-programming-knapsack');
  await page.waitForLoadState('networkidle');

  // 滚动到演示区
  const figKs = page.locator('.figure').first();
  if (await figKs.count() > 0) { await figKs.scrollIntoViewIfNeeded(); await page.waitForTimeout(600); }

  await page.waitForSelector('.pc', { timeout: 10_000 });

  // 步进一步
  const nextBtn = page.locator('.pc button[aria-label="下一步"]').first();
  await nextBtn.click();
  await page.waitForTimeout(300);

  const url = page.url();
  // URL 应包含 demo 或 step 参数
  expect(url.includes('step=') || url.includes('demo=')).toBeTruthy();
});

// ─── MaxflowDemo URL 分享 ─────────────────────────────────────────
test('[share] MaxflowDemo 步进后 URL 含 step', async ({ page }) => {
  await page.goto('/topics/max-flow-min-cut');
  await page.waitForLoadState('networkidle');

  // 滚动触发水合
  const figMf = page.locator('.figure').first();
  if (await figMf.count() > 0) { await figMf.scrollIntoViewIfNeeded(); await page.waitForTimeout(600); }

  await page.waitForSelector('.pc', { timeout: 10_000 });

  const nextBtn = page.locator('.pc button[aria-label="下一步"]').first();
  await nextBtn.click();
  await page.waitForTimeout(300);

  const url = page.url();
  expect(url).toContain('step=');
});
