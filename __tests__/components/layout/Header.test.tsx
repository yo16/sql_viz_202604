import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from '@/components/layout/Header';
import { useLocaleStore } from '@/stores/localeStore';
import { useLineageStore } from '@/stores/lineageStore';
import { SSR_INITIAL_LOCALE } from '@/i18n/types';

describe('Header（LanguageSelector 組込）', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
    useLocaleStore.setState({ locale: SSR_INITIAL_LOCALE });
    // lineageStore の dialect を既定値にリセット
    useLineageStore.setState({ dialect: 'BigQuery' });
  });

  describe('レンダリング', () => {
    it('ヘッダータイトル "SQL Lineage Viz" を表示する', () => {
      render(<Header />);
      expect(screen.getByRole('heading', { name: 'SQL Lineage Viz' })).toBeInTheDocument();
    });

    it('LanguageSelector（JA/EN ボタン）が表示される', () => {
      render(<Header />);
      expect(screen.getByRole('button', { name: 'JA' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument();
    });

    it('DialectSelector と ResetButton も引き続き存在する', () => {
      render(<Header />);
      // DialectSelector（label "DB方言" / "Dialect"、現段階では Header は localized 前なので日本語/英語どちらの表示も許容）
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      // ResetButton（aria-label "すべてリセット"）
      expect(screen.getByRole('button', { name: /リセット|Reset/ })).toBeInTheDocument();
    });

    it('LanguageSelector が LanguageSelector group として role="group" で表示される', () => {
      render(<Header />);
      expect(screen.getByRole('group')).toBeInTheDocument();
    });
  });

  describe('LanguageSelector 操作', () => {
    it('JA ボタンクリックで localeStore が "ja" に切り替わる', async () => {
      const user = userEvent.setup();
      render(<Header />);
      await user.click(screen.getByRole('button', { name: 'JA' }));
      expect(useLocaleStore.getState().locale).toBe('ja');
    });

    it('EN ボタンクリックで localeStore が "en" に切り替わる', async () => {
      useLocaleStore.setState({ locale: 'ja' });
      const user = userEvent.setup();
      render(<Header />);
      await user.click(screen.getByRole('button', { name: 'EN' }));
      expect(useLocaleStore.getState().locale).toBe('en');
    });
  });

  describe('初期状態で LanguageSelector の aria-pressed', () => {
    it('SSR初期 (en) で EN ボタンが aria-pressed="true"', () => {
      render(<Header />);
      expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'JA' })).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
