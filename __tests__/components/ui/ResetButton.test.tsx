import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { ResetButton } from '@/components/ui/ResetButton';
import { useLocaleStore } from '@/stores/localeStore';
import { useLineageStore } from '@/stores/lineageStore';
import { SSR_INITIAL_LOCALE } from '@/i18n/types';

describe('ResetButton useLocale 化', () => {
  beforeEach(() => {
    act(() => {
      useLocaleStore.setState({ locale: SSR_INITIAL_LOCALE });
    });
    jest.restoreAllMocks();
  });

  describe('en (SSR初期)', () => {
    it('ボタンラベルが "Reset"', () => {
      render(<ResetButton />);
      expect(screen.getByRole('button', { name: 'Reset all' })).toBeInTheDocument();
      expect(screen.getByRole('button')).toHaveTextContent('Reset');
    });
  });

  describe('ja', () => {
    beforeEach(() => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
    });

    it('ボタンラベルが "リセット" / aria-label "すべてリセット"', () => {
      render(<ResetButton />);
      expect(screen.getByRole('button', { name: 'すべてリセット' })).toBeInTheDocument();
      expect(screen.getByRole('button')).toHaveTextContent('リセット');
    });
  });

  describe('window.confirm メッセージの翻訳', () => {
    it('en: "Reset all inputs?" でダイアログが表示される', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      const user = userEvent.setup();
      render(<ResetButton />);
      await user.click(screen.getByRole('button'));
      expect(confirmSpy).toHaveBeenCalledWith('Reset all inputs?');
    });

    it('ja: "すべての入力をリセットしますか？" でダイアログ', async () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      const user = userEvent.setup();
      render(<ResetButton />);
      await user.click(screen.getByRole('button'));
      expect(confirmSpy).toHaveBeenCalledWith('すべての入力をリセットしますか？');
    });
  });

  describe('リセット機能', () => {
    it('confirm=true で resetAll が呼ばれる', async () => {
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      const resetAllSpy = jest.fn();
      useLineageStore.setState({ resetAll: resetAllSpy });
      const user = userEvent.setup();
      render(<ResetButton />);
      await user.click(screen.getByRole('button'));
      expect(resetAllSpy).toHaveBeenCalledTimes(1);
    });

    it('confirm=false で resetAll が呼ばれない', async () => {
      jest.spyOn(window, 'confirm').mockReturnValue(false);
      const resetAllSpy = jest.fn();
      useLineageStore.setState({ resetAll: resetAllSpy });
      const user = userEvent.setup();
      render(<ResetButton />);
      await user.click(screen.getByRole('button'));
      expect(resetAllSpy).not.toHaveBeenCalled();
    });
  });
});
