import { test, expect } from '@playwright/test';

/**
 * i18n FOUC 防止 E2E テスト。
 *
 * 設計参照:
 * - doc/design/i18n.md §8 `<html lang>` 属性の切替
 * - doc/design/i18n.md §14 SSR/hydration 戦略のまとめ
 *
 * 検証対象:
 * 1. SSR 出力の `<html lang="en">`（metadata 英語固定と整合）
 * 2. localStorage に "ja" があれば、インラインスクリプトがパース時に
 *    `<html lang="ja">` へ書き換える（最初の paint で確定）
 * 3. localStorage に "en" があれば、SSR 出力のまま `<html lang="en">`
 * 4. LanguageSelector クリックで `<html lang>` が即時更新される
 *
 * 実行前提:
 * - `npm install -D @playwright/test` 済み
 * - `npx playwright install chromium` でブラウザ取得済み
 * - `npm run dev` が自動起動される (playwright.config.ts の webServer 設定)
 */

const STORAGE_KEY = 'sql-viz-locale';

test.describe('html[lang] FOUC 防止', () => {
  test.beforeEach(async ({ context }) => {
    // localStorage を空にして開始
    await context.clearCookies();
    await context.addInitScript((key) => {
      window.localStorage.removeItem(key);
    }, STORAGE_KEY);
  });

  test('localStorage に "ja" があると、最初の paint から html[lang]="ja"', async ({
    page,
    context,
  }) => {
    // 事前に localStorage へ ja を書き込んでからページ遷移
    await context.addInitScript((key) => {
      window.localStorage.setItem(key, 'ja');
    }, STORAGE_KEY);

    await page.goto('/');

    // インラインスクリプトが HTML パース中に書き換えるため、
    // DOM に最初にアクセスした時点で lang="ja" になっているはず
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('ja');
  });

  test('localStorage に "en" があると、html[lang]="en" のまま', async ({
    page,
    context,
  }) => {
    await context.addInitScript((key) => {
      window.localStorage.setItem(key, 'en');
    }, STORAGE_KEY);

    await page.goto('/');

    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('en');
  });

  test('localStorage なし（初回訪問）は SSR_INITIAL_LOCALE ("en") で始まる', async ({
    page,
  }) => {
    await page.goto('/');
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('en');
  });
});

test.describe('LanguageSelector による html[lang] 切替', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.addInitScript((key) => {
      window.localStorage.removeItem(key);
    }, STORAGE_KEY);
  });

  test('EN → JA に切替で html[lang] が "ja" になる', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // JA ボタンをクリック
    await page.getByRole('button', { name: 'JA' }).click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    // localStorage にも保存される
    const saved = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    expect(saved).toBe('ja');
  });

  test('JA → EN に切替で html[lang] が "en" になる', async ({ page, context }) => {
    await context.addInitScript((key) => {
      window.localStorage.setItem(key, 'ja');
    }, STORAGE_KEY);

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');

    await page.getByRole('button', { name: 'EN' }).click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const saved = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    expect(saved).toBe('en');
  });

  test('リロード後も選択言語が復元される', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'JA' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');

    // リロード
    await page.reload();

    // 最初の paint から ja
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('ja');
  });
});

test.describe('SSR 出力に localeInit スクリプトが含まれる', () => {
  test('最初のレスポンス HTML に <script id="locale-init"> が含まれる', async ({
    request,
  }) => {
    const response = await request.get('/');
    const html = await response.text();
    expect(html).toContain('id="locale-init"');
    expect(html).toContain("localStorage.getItem('sql-viz-locale')");
    expect(html).toContain('navigator.language');
  });

  test('SSR 初期の html[lang] が "en"', async ({ request }) => {
    const response = await request.get('/');
    const html = await response.text();
    // SSR は lang="en" を出す（インラインスクリプトはクライアント側で実行）
    expect(html).toMatch(/<html[^>]*\blang="en"/);
  });
});
