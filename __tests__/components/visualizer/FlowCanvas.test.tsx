import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { FlowCanvas } from '@/components/visualizer/FlowCanvas';
import { useLocaleStore } from '@/stores/localeStore';
import { useFlowStore } from '@/stores/flowStore';
import { SSR_INITIAL_LOCALE } from '@/i18n/types';

describe('FlowCanvas useLocale 化', () => {
  beforeEach(() => {
    act(() => {
      useLocaleStore.setState({ locale: SSR_INITIAL_LOCALE });
    });
  });

  describe('en (SSR初期) のコントロールラベル', () => {
    it('"Expand all" ボタンが表示される', () => {
      render(<FlowCanvas />);
      expect(screen.getByRole('button', { name: 'Expand all' })).toBeInTheDocument();
    });

    it('"Collapse all" ボタンが表示される', () => {
      render(<FlowCanvas />);
      expect(screen.getByRole('button', { name: 'Collapse all' })).toBeInTheDocument();
    });

    it('Expand all ボタンの title 属性が "Expand all"', () => {
      render(<FlowCanvas />);
      const btn = screen.getByRole('button', { name: 'Expand all' });
      expect(btn).toHaveAttribute('title', 'Expand all');
    });

    it('Collapse all ボタンの title 属性が "Collapse all"', () => {
      render(<FlowCanvas />);
      const btn = screen.getByRole('button', { name: 'Collapse all' });
      expect(btn).toHaveAttribute('title', 'Collapse all');
    });
  });

  describe('ja のコントロールラベル', () => {
    beforeEach(() => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
    });

    it('"全部開く" ボタンが表示される', () => {
      render(<FlowCanvas />);
      expect(screen.getByRole('button', { name: '全部開く' })).toBeInTheDocument();
    });

    it('"全部閉じる" ボタンが表示される', () => {
      render(<FlowCanvas />);
      expect(screen.getByRole('button', { name: '全部閉じる' })).toBeInTheDocument();
    });

    it('全部開くボタンの title="全部開く"', () => {
      render(<FlowCanvas />);
      const btn = screen.getByRole('button', { name: '全部開く' });
      expect(btn).toHaveAttribute('title', '全部開く');
    });

    it('全部閉じるボタンの title="全部閉じる"', () => {
      render(<FlowCanvas />);
      const btn = screen.getByRole('button', { name: '全部閉じる' });
      expect(btn).toHaveAttribute('title', '全部閉じる');
    });
  });

  describe('ロケール動的切替', () => {
    it('en→ja で同一コンポーネントのラベルが日本語に変わる', () => {
      const { rerender } = render(<FlowCanvas />);
      // 初期は en
      expect(screen.getByRole('button', { name: 'Expand all' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '全部開く' })).not.toBeInTheDocument();

      // ja に切替
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      rerender(<FlowCanvas />);

      expect(screen.getByRole('button', { name: '全部開く' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Expand all' })).not.toBeInTheDocument();
    });
  });

  describe('ストアアクション呼出（既存機能担保）', () => {
    it('Expand all クリックで expandAll が呼ばれる', async () => {
      const expandAllSpy = jest.fn();
      useFlowStore.setState({ expandAll: expandAllSpy });
      const user = userEvent.setup();
      render(<FlowCanvas />);
      await user.click(screen.getByRole('button', { name: 'Expand all' }));
      expect(expandAllSpy).toHaveBeenCalledTimes(1);
    });

    it('Collapse all クリックで compactAll が呼ばれる', async () => {
      const compactAllSpy = jest.fn();
      useFlowStore.setState({ compactAll: compactAllSpy });
      const user = userEvent.setup();
      render(<FlowCanvas />);
      await user.click(screen.getByRole('button', { name: 'Collapse all' }));
      expect(compactAllSpy).toHaveBeenCalledTimes(1);
    });
  });
});
