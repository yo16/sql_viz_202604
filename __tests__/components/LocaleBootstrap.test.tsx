import { render } from '@testing-library/react';
import { LocaleBootstrap } from '@/components/LocaleBootstrap';
import { useLocaleStore } from '@/stores/localeStore';
import { SSR_INITIAL_LOCALE } from '@/i18n/types';

describe('LocaleBootstrap', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
    useLocaleStore.setState({ locale: SSR_INITIAL_LOCALE });
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: { language: 'en-US' },
      writable: true,
      configurable: true,
    });
  });

  function mockNavigator(lang: string | undefined) {
    Object.defineProperty(global, 'navigator', {
      value: lang === undefined ? { language: undefined } : { language: lang },
      writable: true,
      configurable: true,
    });
  }

  describe('レンダリング', () => {
    it('何もレンダリングしない（null を返す）', () => {
      const { container } = render(<LocaleBootstrap />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('初期化動作', () => {
    it('localStorage に "ja" があれば store の locale が "ja" になる', () => {
      localStorage.setItem('sql-viz-locale', 'ja');
      render(<LocaleBootstrap />);
      expect(useLocaleStore.getState().locale).toBe('ja');
    });

    it('localStorage に "en" があれば store の locale が "en" のまま', () => {
      localStorage.setItem('sql-viz-locale', 'en');
      render(<LocaleBootstrap />);
      expect(useLocaleStore.getState().locale).toBe('en');
    });

    it('localStorage なし + navigator "ja-JP" → store が "ja"', () => {
      mockNavigator('ja-JP');
      render(<LocaleBootstrap />);
      expect(useLocaleStore.getState().locale).toBe('ja');
    });

    it('localStorage なし + navigator "en-US" → store が "en"', () => {
      mockNavigator('en-US');
      render(<LocaleBootstrap />);
      expect(useLocaleStore.getState().locale).toBe('en');
    });

    it('localStorage なし + navigator "zh-CN" → store が "en"', () => {
      mockNavigator('zh-CN');
      render(<LocaleBootstrap />);
      expect(useLocaleStore.getState().locale).toBe('en');
    });

    it('localStorage なし + navigator 空文字 → store が "ja"（フォールバック）', () => {
      mockNavigator('');
      render(<LocaleBootstrap />);
      expect(useLocaleStore.getState().locale).toBe('ja');
    });
  });

  describe('DOM / localStorage に触らないこと（設計 §8.4）', () => {
    it('store が "ja" に初期化されても document.documentElement.lang は更新されない', () => {
      localStorage.setItem('sql-viz-locale', 'ja');
      // DOM の lang は未設定の状態で render
      render(<LocaleBootstrap />);
      expect(document.documentElement.getAttribute('lang')).toBeNull();
    });

    it('store が "ja" に初期化されても localStorage の値が追加書込されない', () => {
      // localStorage は元から値なし、navigator は 'ja-JP'
      mockNavigator('ja-JP');
      render(<LocaleBootstrap />);
      expect(useLocaleStore.getState().locale).toBe('ja');
      // localStorage には書き込まれていないこと
      expect(localStorage.getItem('sql-viz-locale')).toBeNull();
    });
  });

  describe('マウント回数', () => {
    it('useEffect は一度だけ実行される（再レンダリングで再初期化されない）', () => {
      localStorage.setItem('sql-viz-locale', 'ja');
      const { rerender } = render(<LocaleBootstrap />);
      expect(useLocaleStore.getState().locale).toBe('ja');

      // 途中で外部から store を 'en' に変更
      useLocaleStore.setState({ locale: 'en' });

      // 再レンダリング
      rerender(<LocaleBootstrap />);

      // 再初期化されていないため 'en' のまま（'ja' に戻らない）
      expect(useLocaleStore.getState().locale).toBe('en');
    });
  });
});
