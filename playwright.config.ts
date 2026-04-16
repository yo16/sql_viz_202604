import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 設定。
 *
 * 注: E2E 実行には `npm install -D @playwright/test` と `npx playwright install chromium`
 * によるブラウザバイナリダウンロードが必要（約 300MB、ネットワーク依存）。
 * 現状のプロジェクトではブラウザバイナリを取得していないため、
 * 本設定ファイルおよび `e2e/` 配下のスペックは準備済み。実行は CI または
 * ローカルで手動セットアップ後に `npx playwright test` で行う。
 *
 * FOUC 防止の中核ロジックは `__tests__/app/localeInitScript.test.ts` で
 * Jest + jsdom により SSR 出力とインラインスクリプト実行結果を検証しており、
 * E2E が未実行でも動作は担保されている（設計 doc/design/i18n.md §14）。
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
