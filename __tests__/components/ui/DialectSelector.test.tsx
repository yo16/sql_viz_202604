import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { DialectSelector } from '@/components/ui/DialectSelector';
import { useLocaleStore } from '@/stores/localeStore';
import { SSR_INITIAL_LOCALE } from '@/i18n/types';

describe('DialectSelector useLocale 化', () => {
  beforeEach(() => {
    act(() => {
      useLocaleStore.setState({ locale: SSR_INITIAL_LOCALE });
    });
  });

  describe('ラベルの翻訳', () => {
    it('en: ラベルが "Dialect"', () => {
      render(<DialectSelector value="BigQuery" onChange={() => {}} />);
      expect(screen.getByText('Dialect')).toBeInTheDocument();
    });

    it('ja: ラベルが "DB方言"', () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      render(<DialectSelector value="BigQuery" onChange={() => {}} />);
      expect(screen.getByText('DB方言')).toBeInTheDocument();
    });
  });

  describe('DB方言名は両言語で同一（固有名詞、翻訳しない）', () => {
    it('en で option として "BigQuery" が表示される', () => {
      render(<DialectSelector value="BigQuery" onChange={() => {}} />);
      expect(screen.getByRole('option', { name: 'BigQuery' })).toBeInTheDocument();
    });

    it('ja でも option として "BigQuery" が表示される', () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      render(<DialectSelector value="BigQuery" onChange={() => {}} />);
      expect(screen.getByRole('option', { name: 'BigQuery' })).toBeInTheDocument();
    });

    it('en で 4 つの DB方言オプションが表示される', () => {
      render(<DialectSelector value="BigQuery" onChange={() => {}} />);
      ['BigQuery', 'PostgreSQL', 'MySQL', 'SQLite'].forEach((name) => {
        expect(screen.getByRole('option', { name })).toBeInTheDocument();
      });
    });

    it('ja でも同じ 4 つの DB方言オプションが表示される', () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      render(<DialectSelector value="BigQuery" onChange={() => {}} />);
      ['BigQuery', 'PostgreSQL', 'MySQL', 'SQLite'].forEach((name) => {
        expect(screen.getByRole('option', { name })).toBeInTheDocument();
      });
    });
  });

  describe('既存機能の維持', () => {
    it('value プロパティが select の値に反映される', () => {
      render(<DialectSelector value="BigQuery" onChange={() => {}} />);
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('BigQuery');
    });

    it('PostgreSQL/MySQL/SQLite は disabled (将来対応)', () => {
      render(<DialectSelector value="BigQuery" onChange={() => {}} />);
      ['PostgreSQL', 'MySQL', 'SQLite'].forEach((name) => {
        const opt = screen.getByRole('option', { name }) as HTMLOptionElement;
        expect(opt.disabled).toBe(true);
      });
    });

    it('BigQuery option は disabled でない', () => {
      render(<DialectSelector value="BigQuery" onChange={() => {}} />);
      const opt = screen.getByRole('option', { name: 'BigQuery' }) as HTMLOptionElement;
      expect(opt.disabled).toBe(false);
    });
  });
});
