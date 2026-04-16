import { renderToStaticMarkup } from 'react-dom/server';
import RootLayout from '@/app/layout';
import { resolveInitialLocale } from '@/i18n/resolveInitialLocale';

/**
 * layout.tsx の LOCALE_INIT_SCRIPT と resolveInitialLocale の等価性を検証する。
 *
 * 両者は設計 §3.3 に基づく二重実装であり、同じ入力（localStorage 値、navigator.language）
 * に対して同じ locale を返す必要がある。
 *
 * ここでは、renderToStaticMarkup で得た HTML からインラインスクリプトを抽出し、
 * `new Function()` で実行して document.documentElement.lang の更新結果を確認する。
 */

function extractLocaleInitScript(html: string): string {
  const match = html.match(/<script id="locale-init"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error('locale-init script not found in layout output');
  }
  return match[1];
}

describe('FOUC 防止インラインスクリプト', () => {
  describe('SSR 出力に含まれること', () => {
    it('layout.tsx の出力に <script id="locale-init"> が含まれる', () => {
      const html = renderToStaticMarkup(RootLayout({ children: null }));
      expect(html).toMatch(/<script id="locale-init"/);
    });

    it('スクリプト本体が document.documentElement.setAttribute を呼ぶ', () => {
      const html = renderToStaticMarkup(RootLayout({ children: null }));
      const script = extractLocaleInitScript(html);
      expect(script).toContain("document.documentElement.setAttribute('lang'");
    });

    it('try-catch で例外を握りつぶす', () => {
      const html = renderToStaticMarkup(RootLayout({ children: null }));
      const script = extractLocaleInitScript(html);
      expect(script).toContain('try');
      expect(script).toContain('catch(e)');
    });

    it('localStorage から "sql-viz-locale" を読み取る', () => {
      const html = renderToStaticMarkup(RootLayout({ children: null }));
      const script = extractLocaleInitScript(html);
      expect(script).toContain("localStorage.getItem('sql-viz-locale')");
    });

    it('navigator.language を参照する', () => {
      const html = renderToStaticMarkup(RootLayout({ children: null }));
      const script = extractLocaleInitScript(html);
      expect(script).toContain('navigator.language');
    });

    it('"ja" で始まる判定を含む', () => {
      const html = renderToStaticMarkup(RootLayout({ children: null }));
      const script = extractLocaleInitScript(html);
      expect(script).toContain("startsWith('ja')");
    });
  });

  describe('スクリプト実行による html[lang] 書換動作', () => {
    let scriptBody: string;

    beforeAll(() => {
      const html = renderToStaticMarkup(RootLayout({ children: null }));
      scriptBody = extractLocaleInitScript(html);
    });

    beforeEach(() => {
      localStorage.clear();
      document.documentElement.setAttribute('lang', 'en');
    });

    function mockNavigatorLanguage(lang: string | undefined) {
      Object.defineProperty(global, 'navigator', {
        value: lang === undefined ? { language: undefined } : { language: lang },
        writable: true,
        configurable: true,
      });
    }

    function runScript() {
      // スクリプト本体を評価（IIFE がその場で実行される）
      // eslint-disable-next-line no-new-func
      new Function(scriptBody)();
    }

    it('localStorage に "ja" がある → lang="ja" に書き換えられる', () => {
      localStorage.setItem('sql-viz-locale', 'ja');
      mockNavigatorLanguage('en-US');
      runScript();
      expect(document.documentElement.getAttribute('lang')).toBe('ja');
    });

    it('localStorage に "en" がある → lang="en" のまま（書換なし）', () => {
      localStorage.setItem('sql-viz-locale', 'en');
      mockNavigatorLanguage('ja-JP');
      runScript();
      expect(document.documentElement.getAttribute('lang')).toBe('en');
    });

    it('localStorage なし + navigator.language="ja-JP" → lang="ja"', () => {
      mockNavigatorLanguage('ja-JP');
      runScript();
      expect(document.documentElement.getAttribute('lang')).toBe('ja');
    });

    it('localStorage なし + navigator.language="en-US" → lang="en"', () => {
      mockNavigatorLanguage('en-US');
      runScript();
      expect(document.documentElement.getAttribute('lang')).toBe('en');
    });

    it('localStorage なし + navigator.language="zh-CN" → lang="en"', () => {
      mockNavigatorLanguage('zh-CN');
      runScript();
      expect(document.documentElement.getAttribute('lang')).toBe('en');
    });

    it('localStorage なし + navigator.language="" → lang="ja" (フォールバック)', () => {
      mockNavigatorLanguage('');
      runScript();
      expect(document.documentElement.getAttribute('lang')).toBe('ja');
    });

    it('localStorage 無効値 + navigator.language="ja-JP" → lang="ja"', () => {
      localStorage.setItem('sql-viz-locale', 'zh');
      mockNavigatorLanguage('ja-JP');
      runScript();
      expect(document.documentElement.getAttribute('lang')).toBe('ja');
    });
  });

  describe('resolveInitialLocale との等価性（設計 §3.3 の担保）', () => {
    let scriptBody: string;

    beforeAll(() => {
      const html = renderToStaticMarkup(RootLayout({ children: null }));
      scriptBody = extractLocaleInitScript(html);
    });

    beforeEach(() => {
      localStorage.clear();
    });

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'en-US' },
        writable: true,
        configurable: true,
      });
    });

    /**
     * スクリプトを実行して得られる最終的な lang 値を計算する。
     * SSR 初期は 'en'、スクリプトが 'ja' に書き換えたかどうかで決まる。
     */
    function scriptResolvedLocale(): 'ja' | 'en' {
      document.documentElement.setAttribute('lang', 'en');
      // eslint-disable-next-line no-new-func
      new Function(scriptBody)();
      return document.documentElement.getAttribute('lang') as 'ja' | 'en';
    }

    const cases: Array<{
      desc: string;
      setup: () => void;
    }> = [
      {
        desc: 'localStorage "ja"',
        setup: () => {
          localStorage.setItem('sql-viz-locale', 'ja');
          Object.defineProperty(global, 'navigator', {
            value: { language: 'en-US' },
            writable: true,
            configurable: true,
          });
        },
      },
      {
        desc: 'localStorage "en"',
        setup: () => {
          localStorage.setItem('sql-viz-locale', 'en');
          Object.defineProperty(global, 'navigator', {
            value: { language: 'ja-JP' },
            writable: true,
            configurable: true,
          });
        },
      },
      {
        desc: 'navigator ja-JP',
        setup: () => {
          Object.defineProperty(global, 'navigator', {
            value: { language: 'ja-JP' },
            writable: true,
            configurable: true,
          });
        },
      },
      {
        desc: 'navigator en-US',
        setup: () => {
          Object.defineProperty(global, 'navigator', {
            value: { language: 'en-US' },
            writable: true,
            configurable: true,
          });
        },
      },
      {
        desc: 'navigator zh-CN',
        setup: () => {
          Object.defineProperty(global, 'navigator', {
            value: { language: 'zh-CN' },
            writable: true,
            configurable: true,
          });
        },
      },
      {
        desc: 'navigator empty string',
        setup: () => {
          Object.defineProperty(global, 'navigator', {
            value: { language: '' },
            writable: true,
            configurable: true,
          });
        },
      },
    ];

    it.each(cases)('$desc: インラインスクリプトと resolveInitialLocale が同じ locale を返す', ({ setup }) => {
      setup();
      const scriptResult = scriptResolvedLocale();
      const hookResult = resolveInitialLocale();
      expect(scriptResult).toBe(hookResult);
    });
  });
});
