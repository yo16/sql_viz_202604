import { renderHook, act } from '@testing-library/react';
import { useLocale } from '@/i18n/useLocale';
import { useLocaleStore } from '@/stores/localeStore';
import { SSR_INITIAL_LOCALE } from '@/i18n/types';
import { ja } from '@/i18n/messages/ja';
import { en } from '@/i18n/messages/en';

describe('useLocale', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
    useLocaleStore.setState({ locale: SSR_INITIAL_LOCALE });
  });

  describe('戻り値の構造', () => {
    it('locale, t, setLocale を返す', () => {
      const { result } = renderHook(() => useLocale());
      expect(result.current).toHaveProperty('locale');
      expect(result.current).toHaveProperty('t');
      expect(result.current).toHaveProperty('setLocale');
      expect(typeof result.current.setLocale).toBe('function');
    });
  });

  describe('初期状態', () => {
    it('locale が SSR_INITIAL_LOCALE ("en") を返す', () => {
      const { result } = renderHook(() => useLocale());
      expect(result.current.locale).toBe('en');
    });

    it('t が初期 locale (en) のリソースを返す', () => {
      const { result } = renderHook(() => useLocale());
      expect(result.current.t).toBe(en);
      expect(result.current.t.header.title).toBe('SQL Lineage Viz');
      expect(result.current.t.button.expandAll).toBe('Expand all');
    });
  });

  describe('setLocale 後の再レンダリング', () => {
    it('setLocale("ja") で locale と t が ja に切り替わる', () => {
      const { result } = renderHook(() => useLocale());

      act(() => {
        result.current.setLocale('ja');
      });

      expect(result.current.locale).toBe('ja');
      expect(result.current.t).toBe(ja);
      expect(result.current.t.button.expandAll).toBe('全部開く');
    });

    it('setLocale("en") で locale と t が en に戻る', () => {
      // 先に ja に変えておく
      useLocaleStore.setState({ locale: 'ja' });
      const { result } = renderHook(() => useLocale());
      expect(result.current.locale).toBe('ja');
      expect(result.current.t).toBe(ja);

      act(() => {
        result.current.setLocale('en');
      });

      expect(result.current.locale).toBe('en');
      expect(result.current.t).toBe(en);
    });

    it('setLocale 後、 localStorage と <html lang> も更新される（store連動の確認）', () => {
      const { result } = renderHook(() => useLocale());

      act(() => {
        result.current.setLocale('ja');
      });

      expect(localStorage.getItem('sql-viz-locale')).toBe('ja');
      expect(document.documentElement.getAttribute('lang')).toBe('ja');
    });
  });

  describe('翻訳リソースの参照同一性', () => {
    it('同じ locale なら t は同一参照を返す', () => {
      const { result, rerender } = renderHook(() => useLocale());
      const firstT = result.current.t;
      rerender();
      expect(result.current.t).toBe(firstT);
    });

    it('locale 切替で t は別参照になる', () => {
      const { result } = renderHook(() => useLocale());
      const enT = result.current.t;

      act(() => {
        result.current.setLocale('ja');
      });

      expect(result.current.t).not.toBe(enT);
    });
  });

  describe('英語固定文字列', () => {
    it('header.title が両 locale で "SQL Lineage Viz"', () => {
      const { result } = renderHook(() => useLocale());
      expect(result.current.t.header.title).toBe('SQL Lineage Viz');

      act(() => {
        result.current.setLocale('ja');
      });

      expect(result.current.t.header.title).toBe('SQL Lineage Viz');
    });
  });
});
