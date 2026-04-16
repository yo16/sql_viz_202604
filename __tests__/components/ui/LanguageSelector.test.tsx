import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { useLocaleStore } from '@/stores/localeStore';
import { SSR_INITIAL_LOCALE } from '@/i18n/types';

describe('LanguageSelector', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
    useLocaleStore.setState({ locale: SSR_INITIAL_LOCALE });
  });

  describe('レンダリング', () => {
    it('JA / EN のボタンが表示される', () => {
      render(<LanguageSelector />);
      expect(screen.getByRole('button', { name: 'JA' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument();
    });

    it('コンテナが role="group" かつ aria-label を持つ', () => {
      render(<LanguageSelector />);
      const group = screen.getByRole('group');
      expect(group).toBeInTheDocument();
      // SSR初期は 'en' → aria-label は英語 "Language"
      expect(group).toHaveAttribute('aria-label', 'Language');
    });

    it('日本語のときコンテナ aria-label が "言語"', () => {
      useLocaleStore.setState({ locale: 'ja' });
      render(<LanguageSelector />);
      expect(screen.getByRole('group')).toHaveAttribute('aria-label', '言語');
    });
  });

  describe('aria-pressed（現在locale の強調）', () => {
    it('初期 (en) では EN ボタンが aria-pressed="true"', () => {
      render(<LanguageSelector />);
      expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'JA' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('ja のとき JA ボタンが aria-pressed="true"', () => {
      useLocaleStore.setState({ locale: 'ja' });
      render(<LanguageSelector />);
      expect(screen.getByRole('button', { name: 'JA' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('クリックで locale が切り替わる', () => {
    it('JA ボタンクリック → store が "ja" に', async () => {
      const user = userEvent.setup();
      render(<LanguageSelector />);
      await user.click(screen.getByRole('button', { name: 'JA' }));
      expect(useLocaleStore.getState().locale).toBe('ja');
    });

    it('EN ボタンクリック → store が "en" に', async () => {
      useLocaleStore.setState({ locale: 'ja' });
      const user = userEvent.setup();
      render(<LanguageSelector />);
      await user.click(screen.getByRole('button', { name: 'EN' }));
      expect(useLocaleStore.getState().locale).toBe('en');
    });

    it('クリックで localStorage と <html lang> も更新される（setLocale 経由）', async () => {
      const user = userEvent.setup();
      render(<LanguageSelector />);
      await user.click(screen.getByRole('button', { name: 'JA' }));
      expect(localStorage.getItem('sql-viz-locale')).toBe('ja');
      expect(document.documentElement.getAttribute('lang')).toBe('ja');
    });
  });

  describe('aria-pressed の動的追従', () => {
    it('クリックで aria-pressed が切り替わる', async () => {
      const user = userEvent.setup();
      render(<LanguageSelector />);

      // 初期: EN=true, JA=false
      expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');

      // JA クリック
      await user.click(screen.getByRole('button', { name: 'JA' }));

      // JA=true, EN=false に切替
      expect(screen.getByRole('button', { name: 'JA' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('ボタン表示テキスト（英語固定 JA/EN）', () => {
    it('locale=ja でもボタンテキストは "JA" / "EN" のまま', () => {
      useLocaleStore.setState({ locale: 'ja' });
      render(<LanguageSelector />);
      expect(screen.getByRole('button', { name: 'JA' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument();
    });
  });
});
