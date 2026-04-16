import { useLocaleStore } from '@/stores/localeStore';
import { SSR_INITIAL_LOCALE } from '@/i18n/types';

describe('localeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
    // SSR 初期値にリセット
    useLocaleStore.setState({ locale: SSR_INITIAL_LOCALE });
  });

  describe('初期状態', () => {
    it('locale の初期値が SSR_INITIAL_LOCALE ("en") であること', () => {
      // beforeEach でリセットしているため、新規生成時の初期値も確認するため
      // ストアの実装に直接アクセスして検証
      expect(SSR_INITIAL_LOCALE).toBe('en');
      expect(useLocaleStore.getState().locale).toBe('en');
    });
  });

  describe('setLocale', () => {
    it('"ja" に切り替えるとストアが更新される', () => {
      useLocaleStore.getState().setLocale('ja');
      expect(useLocaleStore.getState().locale).toBe('ja');
    });

    it('"en" に切り替えるとストアが更新される', () => {
      useLocaleStore.setState({ locale: 'ja' });
      useLocaleStore.getState().setLocale('en');
      expect(useLocaleStore.getState().locale).toBe('en');
    });

    it('localStorage に locale が保存される', () => {
      useLocaleStore.getState().setLocale('ja');
      expect(localStorage.getItem('sql-viz-locale')).toBe('ja');
    });

    it('document.documentElement.lang が更新される', () => {
      useLocaleStore.getState().setLocale('ja');
      expect(document.documentElement.getAttribute('lang')).toBe('ja');
    });

    it('連続して切り替えても各副作用が反映される', () => {
      useLocaleStore.getState().setLocale('ja');
      expect(localStorage.getItem('sql-viz-locale')).toBe('ja');
      expect(document.documentElement.getAttribute('lang')).toBe('ja');

      useLocaleStore.getState().setLocale('en');
      expect(useLocaleStore.getState().locale).toBe('en');
      expect(localStorage.getItem('sql-viz-locale')).toBe('en');
      expect(document.documentElement.getAttribute('lang')).toBe('en');
    });
  });

  describe('_initializeLocale', () => {
    it('ストアの locale を更新する', () => {
      useLocaleStore.getState()._initializeLocale('ja');
      expect(useLocaleStore.getState().locale).toBe('ja');
    });

    it('localStorage には書き込まない', () => {
      useLocaleStore.getState()._initializeLocale('ja');
      expect(localStorage.getItem('sql-viz-locale')).toBeNull();
    });

    it('document.documentElement.lang を更新しない', () => {
      useLocaleStore.getState()._initializeLocale('ja');
      expect(document.documentElement.getAttribute('lang')).toBeNull();
    });

    it('"en" → "ja" への初期化', () => {
      // 初期値は 'en'。'ja' で初期化すると ja に変わる
      expect(useLocaleStore.getState().locale).toBe('en');
      useLocaleStore.getState()._initializeLocale('ja');
      expect(useLocaleStore.getState().locale).toBe('ja');
      // localStorage / DOM は変化しない
      expect(localStorage.getItem('sql-viz-locale')).toBeNull();
      expect(document.documentElement.getAttribute('lang')).toBeNull();
    });
  });

  describe('SSR 安全性', () => {
    it('document が undefined の場合でも setLocale が例外を投げないこと', () => {
      const originalDocument = global.document;
      // @ts-expect-error 意図的に document を削除してSSR環境を再現
      delete global.document;
      try {
        expect(() => useLocaleStore.getState().setLocale('ja')).not.toThrow();
        expect(useLocaleStore.getState().locale).toBe('ja');
      } finally {
        global.document = originalDocument;
      }
    });
  });

  describe('Zustand persist 不使用の確認', () => {
    it('localeStore のセッターが直接 localStorage を扱う（persist ラップなし）', () => {
      // setLocale 後、現在のページ操作内ですぐに localStorage に反映されることを確認
      useLocaleStore.getState().setLocale('ja');
      expect(localStorage.getItem('sql-viz-locale')).toBe('ja');
      // persist ミドルウェア固有のキー (zustand 等) が作成されていないことを確認
      const otherKeys = Object.keys(localStorage).filter((k) => k !== 'sql-viz-locale');
      expect(otherKeys).toHaveLength(0);
    });
  });
});
