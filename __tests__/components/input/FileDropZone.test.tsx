import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { FileDropZone } from '@/components/input/FileDropZone';
import { useLocaleStore } from '@/stores/localeStore';
import { SSR_INITIAL_LOCALE } from '@/i18n/types';

/**
 * fileInput に File を直接セットして change イベントを発火する。
 * `userEvent.upload` は `accept=".sql"` 属性により .txt 等を弾くケースがあるため、
 * バリデーションロジック自体をテストするにはこの低レベルAPIで直接渡す必要がある。
 */
function uploadFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', {
    value: files,
    writable: false,
    configurable: true,
  });
  fireEvent.change(input);
}

describe('FileDropZone useLocale 化', () => {
  beforeEach(() => {
    act(() => {
      useLocaleStore.setState({ locale: SSR_INITIAL_LOCALE });
    });
  });

  describe('SSR初期 (en) の文言', () => {
    it('ドロップゾーンに英語のテキストが表示される', () => {
      render(<FileDropZone onFilesLoaded={() => {}} />);
      expect(screen.getByText('Drop .sql files here or click to select')).toBeInTheDocument();
    });

    it('ドロップゾーンの aria-label が英語', () => {
      render(<FileDropZone onFilesLoaded={() => {}} />);
      expect(
        screen.getByRole('button', { name: 'Drop .sql files or click to select' })
      ).toBeInTheDocument();
    });
  });

  describe('日本語 (ja) の文言', () => {
    beforeEach(() => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
    });

    it('ドロップゾーンに日本語テキスト', () => {
      render(<FileDropZone onFilesLoaded={() => {}} />);
      expect(screen.getByText('.sqlファイルをドロップ またはクリックで選択')).toBeInTheDocument();
    });

    it('aria-label が日本語', () => {
      render(<FileDropZone onFilesLoaded={() => {}} />);
      expect(
        screen.getByRole('button', { name: '.sqlファイルをドロップまたはクリックで選択' })
      ).toBeInTheDocument();
    });
  });

  describe('拡張子バリデーションエラーの翻訳（テンプレート置換）', () => {
    it('en: "Only .sql files are accepted: foo.txt" を含む', async () => {
      const { container } = render(<FileDropZone onFilesLoaded={() => {}} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['x'], 'foo.txt', { type: 'text/plain' });
      uploadFiles(fileInput, [file]);
      const errorEl = await screen.findByRole('alert');
      expect(errorEl.textContent).toContain('Only .sql files are accepted');
      expect(errorEl.textContent).toContain('foo.txt');
    });

    it('ja: "受け付けます" を含む', async () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      const { container } = render(<FileDropZone onFilesLoaded={() => {}} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['x'], 'bar.txt', { type: 'text/plain' });
      uploadFiles(fileInput, [file]);
      const errorEl = await screen.findByRole('alert');
      expect(errorEl.textContent).toContain('.sql ファイルのみ受け付けます');
      expect(errorEl.textContent).toContain('bar.txt');
    });
  });

  describe('既存機能の維持', () => {
    it('.sql ファイルアップロードで onFilesLoaded が呼ばれる', async () => {
      const onFilesLoaded = jest.fn();
      const user = userEvent.setup();
      const { container } = render(<FileDropZone onFilesLoaded={onFilesLoaded} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['SELECT 1'], 'q.sql', { type: 'text/plain' });
      await user.upload(fileInput, file);
      // FileReader は非同期。findByText でファイル名表示を待つ
      await screen.findByText('q.sql');
      expect(onFilesLoaded).toHaveBeenCalled();
      const lastCall = onFilesLoaded.mock.calls[onFilesLoaded.mock.calls.length - 1][0];
      expect(lastCall[0].fileName).toBe('q.sql');
    });

    it('混在アップロード: .sql は受理 + .txt はエラー表示', async () => {
      const onFilesLoaded = jest.fn();
      const { container } = render(<FileDropZone onFilesLoaded={onFilesLoaded} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const sql = new File(['SELECT 1'], 'a.sql', { type: 'text/plain' });
      const txt = new File(['x'], 'b.txt', { type: 'text/plain' });
      uploadFiles(fileInput, [sql, txt]);
      await screen.findByText('a.sql');
      // エラーには b.txt が表示される
      const errorEl = await screen.findByRole('alert');
      expect(errorEl.textContent).toContain('b.txt');
      // onFilesLoaded には .sql のみ含まれる
      const lastCall = onFilesLoaded.mock.calls[onFilesLoaded.mock.calls.length - 1][0];
      expect(lastCall.map((f: { fileName: string }) => f.fileName)).toEqual(['a.sql']);
    });
  });

  describe('複数 invalid ファイルのテンプレート置換', () => {
    it('カンマ区切りで全ファイル名がエラーに含まれる', async () => {
      const { container } = render(<FileDropZone onFilesLoaded={() => {}} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const f1 = new File(['x'], 'foo.txt', { type: 'text/plain' });
      const f2 = new File(['y'], 'bar.md', { type: 'text/plain' });
      uploadFiles(fileInput, [f1, f2]);
      const errorEl = await screen.findByRole('alert');
      expect(errorEl.textContent).toContain('foo.txt');
      expect(errorEl.textContent).toContain('bar.md');
    });
  });

  describe('ドラッグ中テキスト (fileDropDragging) の翻訳', () => {
    it('en: dragOver 中は "Drop here"', () => {
      render(<FileDropZone onFilesLoaded={() => {}} />);
      const zone = screen.getByRole('button', { name: 'Drop .sql files or click to select' });
      fireEvent.dragOver(zone);
      expect(screen.getByText('Drop here')).toBeInTheDocument();
    });

    it('ja: dragOver 中は "ここにドロップ"', () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      render(<FileDropZone onFilesLoaded={() => {}} />);
      const zone = screen.getByRole('button', { name: '.sqlファイルをドロップまたはクリックで選択' });
      fireEvent.dragOver(zone);
      expect(screen.getByText('ここにドロップ')).toBeInTheDocument();
    });
  });

  describe('ファイル削除ボタンの aria-label 翻訳', () => {
    it('en: "Remove q.sql"', async () => {
      const user = userEvent.setup();
      const { container } = render(<FileDropZone onFilesLoaded={() => {}} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(fileInput, new File(['SELECT 1'], 'q.sql', { type: 'text/plain' }));
      await screen.findByText('q.sql');
      expect(screen.getByRole('button', { name: 'Remove q.sql' })).toBeInTheDocument();
    });

    it('ja: "q.sql を削除"', async () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      const user = userEvent.setup();
      const { container } = render(<FileDropZone onFilesLoaded={() => {}} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(fileInput, new File(['SELECT 1'], 'q.sql', { type: 'text/plain' }));
      await screen.findByText('q.sql');
      expect(screen.getByRole('button', { name: 'q.sql を削除' })).toBeInTheDocument();
    });
  });
});
