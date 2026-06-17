import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 配置
 * - webServer: pnpm astro preview (port 4321)
 * - 支持 375/768/1280 三档 + iOS Safari / Android Chrome 设备模拟
 * - 支持 prefers-color-scheme: dark 模拟
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },

  projects: [
    // 桌面 Chrome 1280px（主力）
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
    // 平板 768px
    {
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
      },
    },
    // 移动 375px
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 375, height: 812 },
      },
    },
    // iOS Safari 模拟
    {
      name: 'ios-safari',
      use: {
        ...devices['iPhone 12'],
      },
    },
    // Android Chrome 模拟
    {
      name: 'android-chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },
    // 暗色模式（用于 dark-and-share.spec.ts）
    {
      name: 'dark-mode',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        colorScheme: 'dark',
      },
    },
  ],

  webServer: {
    command: 'pnpm astro preview --port 4321',
    port: 4321,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
