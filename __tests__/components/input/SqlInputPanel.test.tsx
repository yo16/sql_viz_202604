import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { SqlInputPanel } from '@/components/input/SqlInputPanel';
import { useLocaleStore } from '@/stores/localeStore';
import { SSR_INITIAL_LOCALE } from '@/i18n/types';

describe('SqlInputPanel useLocale 化', () => {
  beforeEach(() => {
    act(() => {
      useLocaleStore.setState({ locale: SSR_INITIAL_LOCALE });
    });
  });

  describe('SSR初期 (en) の文言', () => {
    it('ラベル "SQL input" が表示される', () => {
      render(<SqlInputPanel onSubmit={() => {}} isLoading={false} />);
      expect(screen.getByText('SQL input')).toBeInTheDocument();
    });

    it('Ctrl+Enter ヒント "Press Ctrl + Enter to run" が表示される', () => {
      render(<SqlInputPanel onSubmit={() => {}} isLoading={false} />);
      expect(screen.getByText('Press Ctrl + Enter to run')).toBeInTheDocument();
    });

    it('パース実行ボタン "Parse"', () => {
      render(<SqlInputPanel onSubmit={() => {}} isLoading={false} />);
      expect(screen.getByRole('button', { name: 'Parse' })).toBeInTheDocument();
    });

    it('isLoading=true で "Parsing..." 表示', () => {
      render(<SqlInputPanel onSubmit={() => {}} isLoading={true} />);
      expect(screen.getByText('Parsing...')).toBeInTheDocument();
    });

    it('placeholder が SELECT 例', () => {
      render(<SqlInputPanel onSubmit={() => {}} isLoading={false} />);
      expect(screen.getByPlaceholderText('SELECT * FROM users ...')).toBeInTheDocument();
    });
  });

  describe('日本語 (ja) の文言', () => {
    beforeEach(() => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
    });

    it('ラベル "SQL入力"', () => {
      render(<SqlInputPanel onSubmit={() => {}} isLoading={false} />);
      expect(screen.getByText('SQL入力')).toBeInTheDocument();
    });

    it('Ctrl+Enter ヒント "Ctrl + Enter で実行"', () => {
      render(<SqlInputPanel onSubmit={() => {}} isLoading={false} />);
      expect(screen.getByText('Ctrl + Enter で実行')).toBeInTheDocument();
    });

    it('パース実行ボタン "パース実行"', () => {
      render(<SqlInputPanel onSubmit={() => {}} isLoading={false} />);
      expect(screen.getByRole('button', { name: 'パース実行' })).toBeInTheDocument();
    });

    it('isLoading=true で "実行中..." 表示', () => {
      render(<SqlInputPanel onSubmit={() => {}} isLoading={true} />);
      expect(screen.getByText('実行中...')).toBeInTheDocument();
    });

    it('placeholder が SELECT 例（ja でも同値: SQLサンプル）', () => {
      render(<SqlInputPanel onSubmit={() => {}} isLoading={false} />);
      expect(screen.getByPlaceholderText('SELECT * FROM users ...')).toBeInTheDocument();
    });
  });

  describe('クリアボタン', () => {
    it('入力後に "Clear" ボタン (en) が表示され、クリックで空に', async () => {
      const user = userEvent.setup();
      render(<SqlInputPanel onSubmit={() => {}} isLoading={false} />);
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'SELECT 1');
      const clearBtn = screen.getByRole('button', { name: 'Clear' });
      await user.click(clearBtn);
      expect(textarea).toHaveValue('');
    });

    it('日本語ロケールで "クリア" ボタン', async () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      const user = userEvent.setup();
      render(<SqlInputPanel onSubmit={() => {}} isLoading={false} />);
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'SELECT 1');
      expect(screen.getByRole('button', { name: 'クリア' })).toBeInTheDocument();
    });
  });

  describe('既存機能の維持', () => {
    it('onSubmit が input 内容で呼ばれる', async () => {
      const onSubmit = jest.fn();
      const user = userEvent.setup();
      render(<SqlInputPanel onSubmit={onSubmit} isLoading={false} />);
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'SELECT 1');
      await user.click(screen.getByRole('button', { name: 'Parse' }));
      expect(onSubmit).toHaveBeenCalledWith('SELECT 1');
    });

    it('Ctrl+Enter キーボードショートカットで onSubmit が呼ばれる', async () => {
      const onSubmit = jest.fn();
      const user = userEvent.setup();
      render(<SqlInputPanel onSubmit={onSubmit} isLoading={false} />);
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'SELECT 2');
      await user.keyboard('{Control>}{Enter}{/Control}');
      expect(onSubmit).toHaveBeenCalledWith('SELECT 2');
    });

    it('isLoading=true でパース実行ボタンが disabled', () => {
      render(<SqlInputPanel onSubmit={() => {}} isLoading={true} />);
      expect(screen.getByRole('button', { name: 'Parse' })).toBeDisabled();
    });

    it('isLoading=true でクリアボタンも disabled（入力後）', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<SqlInputPanel onSubmit={() => {}} isLoading={false} />);
      await user.type(screen.getByRole('textbox'), 'SELECT 3');
      // 入力後 isLoading=true で再描画
      rerender(<SqlInputPanel onSubmit={() => {}} isLoading={true} />);
      expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
    });
  });
});
