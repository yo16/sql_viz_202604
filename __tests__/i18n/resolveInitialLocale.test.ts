import { resolveInitialLocale } from '@/i18n/resolveInitialLocale';
import { NAVIGATOR_UNAVAILABLE_FALLBACK } from '@/i18n/types';

describe('resolveInitialLocale', () => {
  const originalNavigator = global.navigator;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe('localStorage に有効な locale がある場合', () => {
    it('"ja" が保存されていれば "ja" を返す', () => {
      localStorage.setItem('sql-viz-locale', 'ja');
      expect(resolveInitialLocale()).toBe('ja');
    });

    it('"en" が保存されていれば "en" を返す', () => {
      localStorage.setItem('sql-viz-locale', 'en');
      expect(resolveInitialLocale()).toBe('en');
    });
  });

  describe('localStorage が空で navigator.language がある場合', () => {
    function mockNavigatorLanguage(lang: string) {
      Object.defineProperty(global, 'navigator', {
        value: { language: lang },
        writable: true,
        configurable: true,
      });
    }

    it('navigator.language が "ja-JP" なら "ja" を返す', () => {
      mockNavigatorLanguage('ja-JP');
      expect(resolveInitialLocale()).toBe('ja');
    });

    it('navigator.language が "ja" なら "ja" を返す', () => {
      mockNavigatorLanguage('ja');
      expect(resolveInitialLocale()).toBe('ja');
    });

    it('navigator.language が "en-US" なら "en" を返す', () => {
      mockNavigatorLanguage('en-US');
      expect(resolveInitialLocale()).toBe('en');
    });

    it('navigator.language が "zh-CN" なら "en" を返す', () => {
      mockNavigatorLanguage('zh-CN');
      expect(resolveInitialLocale()).toBe('en');
    });

    it('navigator.language が "fr" なら "en" を返す', () => {
      mockNavigatorLanguage('fr');
      expect(resolveInitialLocale()).toBe('en');
    });

    it('navigator.language が空文字なら NAVIGATOR_UNAVAILABLE_FALLBACK を返す', () => {
      mockNavigatorLanguage('');
      expect(resolveInitialLocale()).toBe(NAVIGATOR_UNAVAILABLE_FALLBACK);
    });
  });

  describe('navigator が利用できない場合', () => {
    it('navigator が undefined なら NAVIGATOR_UNAVAILABLE_FALLBACK を返す', () => {
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(resolveInitialLocale()).toBe(NAVIGATOR_UNAVAILABLE_FALLBACK);
    });
  });

  describe('localStorage に無効値があり navigator.language がある場合', () => {
    it('localStorage が無効値で navigator.language が "ja-JP" なら "ja" を返す', () => {
      localStorage.setItem('sql-viz-locale', 'zh');
      Object.defineProperty(global, 'navigator', {
        value: { language: 'ja-JP' },
        writable: true,
        configurable: true,
      });
      expect(resolveInitialLocale()).toBe('ja');
    });

    it('localStorage が無効値で navigator.language が "en-US" なら "en" を返す', () => {
      localStorage.setItem('sql-viz-locale', 'invalid');
      Object.defineProperty(global, 'navigator', {
        value: { language: 'en-US' },
        writable: true,
        configurable: true,
      });
      expect(resolveInitialLocale()).toBe('en');
    });
  });

  describe('優先順位の確認', () => {
    it('localStorage の値は navigator.language より優先される', () => {
      localStorage.setItem('sql-viz-locale', 'en');
      Object.defineProperty(global, 'navigator', {
        value: { language: 'ja-JP' },
        writable: true,
        configurable: true,
      });
      expect(resolveInitialLocale()).toBe('en');
    });
  });
});
