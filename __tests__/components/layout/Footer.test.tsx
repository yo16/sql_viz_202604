import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/layout/Footer';
import { useLocaleStore } from '@/stores/localeStore';
import { SSR_INITIAL_LOCALE } from '@/i18n/types';

describe('Footer（useLocale 化）', () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: SSR_INITIAL_LOCALE });
  });

  describe('英語固定文字列（両言語で同一）', () => {
    it('"Small Piece" が SSR初期 (en) で表示される', () => {
      render(<Footer />);
      expect(screen.getByRole('link', { name: 'Small Piece' })).toBeInTheDocument();
    });

    it('"Small Piece" が ja でも同じ表示', () => {
      useLocaleStore.setState({ locale: 'ja' });
      render(<Footer />);
      expect(screen.getByRole('link', { name: 'Small Piece' })).toBeInTheDocument();
    });

    it('"Contact" が SSR初期 (en) で表示される', () => {
      render(<Footer />);
      expect(screen.getByRole('link', { name: 'Contact' })).toBeInTheDocument();
    });

    it('"Contact" が ja でも同じ表示', () => {
      useLocaleStore.setState({ locale: 'ja' });
      render(<Footer />);
      expect(screen.getByRole('link', { name: 'Contact' })).toBeInTheDocument();
    });
  });

  describe('翻訳対象の周辺文言', () => {
    it('en: "Feel free to" と " us" が表示される', () => {
      render(<Footer />);
      const footer = screen.getByRole('contentinfo');
      expect(footer.textContent).toContain('Feel free to');
      expect(footer.textContent).toContain('us');
    });

    it('ja: "お気軽に" と "からお問い合わせください" が表示される', () => {
      useLocaleStore.setState({ locale: 'ja' });
      render(<Footer />);
      const footer = screen.getByRole('contentinfo');
      expect(footer.textContent).toContain('お気軽に');
      expect(footer.textContent).toContain('からお問い合わせください');
    });

    it('en→ja で日本語文言に変わり、英語文言は消える', () => {
      const { rerender } = render(<Footer />);
      const enFooter = screen.getByRole('contentinfo').textContent ?? '';
      expect(enFooter).toContain('Feel free to');
      expect(enFooter).not.toContain('お気軽に');

      useLocaleStore.setState({ locale: 'ja' });
      rerender(<Footer />);
      const jaFooter = screen.getByRole('contentinfo').textContent ?? '';
      expect(jaFooter).toContain('お気軽に');
      expect(jaFooter).not.toContain('Feel free to');
    });
  });

  describe('リンクの href 属性', () => {
    it('Small Piece のリンクが smallpiece.jp トップに向かう', () => {
      render(<Footer />);
      const link = screen.getByRole('link', { name: 'Small Piece' });
      expect(link).toHaveAttribute('href', expect.stringContaining('https://smallpiece.jp/'));
    });

    it('Contact のリンクが smallpiece.jp/contact に向かう', () => {
      render(<Footer />);
      const link = screen.getByRole('link', { name: 'Contact' });
      expect(link).toHaveAttribute('href', expect.stringContaining('https://smallpiece.jp/contact'));
    });

    it('リンクが target="_blank" + rel="noopener noreferrer"', () => {
      render(<Footer />);
      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });
  });
});
