import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { LocaleBootstrap } from '@/components/LocaleBootstrap';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { DialectSelector } from '@/components/ui/DialectSelector';
import { useLocaleStore } from '@/stores/localeStore';
import { SSR_INITIAL_LOCALE } from '@/i18n/types';
import { metadata } from '@/app/layout';

describe('i18n 結合テスト: 復元・固定文言・metadata 不変', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
    act(() => {
      useLocaleStore.setState({ locale: SSR_INITIAL_LOCALE });
    });
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: { language: 'en-US' },
      writable: true,
      configurable: true,
    });
  });

  describe('localStorage からの言語復元', () => {
    it('localStorage に "en" がある状態で LocaleBootstrap をマウントすると locale が "en"', () => {
      localStorage.setItem('sql-viz-locale', 'en');
      // 初期ストア値は 'ja' に変えてから、LocaleBootstrap で localStorage の値で上書きされるか確認
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });

      render(<LocaleBootstrap />);

      expect(useLocaleStore.getState().locale).toBe('en');
    });

    it('localStorage に "ja" がある状態で LocaleBootstrap をマウントすると locale が "ja"', () => {
      localStorage.setItem('sql-viz-locale', 'ja');
      // 初期ストア値は 'en'（SSR_INITIAL_LOCALE）
      render(<LocaleBootstrap />);

      expect(useLocaleStore.getState().locale).toBe('ja');
    });

    it('localStorage に無効値がある場合は navigator.language にフォールバック (ja-JP → ja)', () => {
      localStorage.setItem('sql-viz-locale', 'invalid');
      Object.defineProperty(global, 'navigator', {
        value: { language: 'ja-JP' },
        writable: true,
        configurable: true,
      });

      render(<LocaleBootstrap />);

      expect(useLocaleStore.getState().locale).toBe('ja');
    });

    it('localStorage も navigator も取得できない場合は "ja"（NAVIGATOR_UNAVAILABLE_FALLBACK）', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: undefined },
        writable: true,
        configurable: true,
      });

      render(<LocaleBootstrap />);

      expect(useLocaleStore.getState().locale).toBe('ja');
    });
  });

  describe('英語固定文言の不変性', () => {
    describe('Header "SQL Lineage Viz"', () => {
      it('en で表示される', () => {
        render(<Header />);
        expect(screen.getByRole('heading', { name: 'SQL Lineage Viz' })).toBeInTheDocument();
      });

      it('ja でも同じ表示', () => {
        act(() => {
          useLocaleStore.setState({ locale: 'ja' });
        });
        render(<Header />);
        expect(screen.getByRole('heading', { name: 'SQL Lineage Viz' })).toBeInTheDocument();
      });

      it('JA ↔ EN 切替で heading.textContent が不変', async () => {
        const user = userEvent.setup();
        render(<Header />);
        const initial = screen.getByRole('heading').textContent;
        await user.click(screen.getByRole('button', { name: 'JA' }));
        const afterJa = screen.getByRole('heading').textContent;
        await user.click(screen.getByRole('button', { name: 'EN' }));
        const afterEn = screen.getByRole('heading').textContent;
        expect(initial).toBe('SQL Lineage Viz');
        expect(afterJa).toBe('SQL Lineage Viz');
        expect(afterEn).toBe('SQL Lineage Viz');
      });
    });

    describe('Footer "Small Piece" / "Contact"', () => {
      it('en で "Small Piece" が表示される', () => {
        render(<Footer />);
        expect(screen.getByRole('link', { name: 'Small Piece' })).toBeInTheDocument();
      });

      it('ja でも "Small Piece" が表示される', () => {
        act(() => {
          useLocaleStore.setState({ locale: 'ja' });
        });
        render(<Footer />);
        expect(screen.getByRole('link', { name: 'Small Piece' })).toBeInTheDocument();
      });

      it('en で "Contact" が表示される', () => {
        render(<Footer />);
        expect(screen.getByRole('link', { name: 'Contact' })).toBeInTheDocument();
      });

      it('ja でも "Contact" が表示される', () => {
        act(() => {
          useLocaleStore.setState({ locale: 'ja' });
        });
        render(<Footer />);
        expect(screen.getByRole('link', { name: 'Contact' })).toBeInTheDocument();
      });
    });

    describe('DialectSelector の DB方言名', () => {
      it('en で "BigQuery" option', () => {
        render(<DialectSelector value="BigQuery" onChange={() => {}} />);
        expect(screen.getByRole('option', { name: 'BigQuery' })).toBeInTheDocument();
      });

      it('ja でも "BigQuery" option（固有名詞）', () => {
        act(() => {
          useLocaleStore.setState({ locale: 'ja' });
        });
        render(<DialectSelector value="BigQuery" onChange={() => {}} />);
        expect(screen.getByRole('option', { name: 'BigQuery' })).toBeInTheDocument();
      });

      it('en/ja とも PostgreSQL/MySQL/SQLite も表示', () => {
        const assertOptions = () => {
          ['BigQuery', 'PostgreSQL', 'MySQL', 'SQLite'].forEach((name) => {
            expect(screen.getByRole('option', { name })).toBeInTheDocument();
          });
        };
        render(<DialectSelector value="BigQuery" onChange={() => {}} />);
        assertOptions();
        act(() => {
          useLocaleStore.setState({ locale: 'ja' });
        });
        // 既存レンダーは ja で再描画される。option は変化しないはず
        assertOptions();
      });
    });
  });

  describe('metadata が locale 切替の影響を受けないこと', () => {
    it('metadata.title は静的かつ英語固定', () => {
      // SSR初期
      act(() => {
        useLocaleStore.setState({ locale: 'en' });
      });
      expect(metadata.title).toBe('SQL Lineage Viz - SQL Column Lineage Visualization Tool');
      // ja に切替ても metadata は不変（クライアント状態と無関係）
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      expect(metadata.title).toBe('SQL Lineage Viz - SQL Column Lineage Visualization Tool');
    });

    it('metadata.openGraph.locale は "en_US" 固定', () => {
      expect(metadata.openGraph?.locale).toBe('en_US');
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      expect(metadata.openGraph?.locale).toBe('en_US');
    });

    it('document.title は locale 切替で変化しない（Next.js metadata は静的）', () => {
      // jsdom では document.title は初期空文字。locale 切替で変わらない
      const initial = document.title;
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      expect(document.title).toBe(initial);
      act(() => {
        useLocaleStore.setState({ locale: 'en' });
      });
      expect(document.title).toBe(initial);
    });

    it('metadata オブジェクトは同一参照を返し続ける（静的 const）', () => {
      const ref1 = metadata;
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      const ref2 = metadata;
      expect(ref1).toBe(ref2);
    });
  });
});
