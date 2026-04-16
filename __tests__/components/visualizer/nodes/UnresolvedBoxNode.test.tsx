import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { UnresolvedBoxNode } from '@/components/visualizer/nodes/UnresolvedBoxNode';
import { useLocaleStore } from '@/stores/localeStore';
import { SSR_INITIAL_LOCALE } from '@/i18n/types';

function renderNode(props: { tableName?: string; inferredColumns?: string[]; displayMode?: 'compact' | 'detail' }) {
  const data = {
    tableName: props.tableName ?? 'unknown_table',
    inferredColumns: props.inferredColumns ?? [],
    displayMode: props.displayMode ?? 'compact',
  };
  return render(
    <UnresolvedBoxNode
      id="test-id"
      data={data as unknown as Record<string, unknown>}
      type="unresolvedBox"
      selected={false}
      zIndex={0}
      isConnectable dragging={false} selectable={true} deletable={true} draggable={true} positionAbsoluteX={0} positionAbsoluteY={0}
    />
  );
}

describe('UnresolvedBoxNode useLocale 化', () => {
  beforeEach(() => {
    act(() => {
      useLocaleStore.setState({ locale: SSR_INITIAL_LOCALE });
    });
  });

  describe('プレフィックスの翻訳', () => {
    it('en: "[Unresolved]" プレフィックス', () => {
      renderNode({});
      expect(screen.getByText('[Unresolved]')).toBeInTheDocument();
    });

    it('ja: "[未登録]" プレフィックス', () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      renderNode({});
      expect(screen.getByText('[未登録]')).toBeInTheDocument();
    });
  });

  describe('compact: カラム数表示の翻訳とテンプレート置換', () => {
    it('en: "3 inferred columns"', () => {
      renderNode({ inferredColumns: ['a', 'b', 'c'], displayMode: 'compact' });
      expect(screen.getByText('3 inferred columns')).toBeInTheDocument();
    });

    it('ja: "3 件の推定カラム"', () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      renderNode({ inferredColumns: ['a', 'b', 'c'], displayMode: 'compact' });
      expect(screen.getByText('3 件の推定カラム')).toBeInTheDocument();
    });

    it('en: 0件 → "No column info"', () => {
      renderNode({ inferredColumns: [], displayMode: 'compact' });
      expect(screen.getByText('No column info')).toBeInTheDocument();
    });

    it('ja: 0件 → "カラム情報なし"', () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      renderNode({ inferredColumns: [], displayMode: 'compact' });
      expect(screen.getByText('カラム情報なし')).toBeInTheDocument();
    });
  });

  describe('detail: 推定カラム0件時の翻訳', () => {
    it('en: "No inferred columns"', () => {
      renderNode({ inferredColumns: [], displayMode: 'detail' });
      expect(screen.getByText('No inferred columns')).toBeInTheDocument();
    });

    it('ja: "推定カラムなし"', () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      renderNode({ inferredColumns: [], displayMode: 'detail' });
      expect(screen.getByText('推定カラムなし')).toBeInTheDocument();
    });
  });

  describe('テーブル名は両言語で同一', () => {
    it('en でテーブル名 "raw_users"', () => {
      renderNode({ tableName: 'raw_users' });
      expect(screen.getByText('raw_users')).toBeInTheDocument();
    });

    it('ja でも同じ "raw_users"', () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      renderNode({ tableName: 'raw_users' });
      expect(screen.getByText('raw_users')).toBeInTheDocument();
    });
  });

  describe('クリックヒントツールチップ', () => {
    it('en compact: title="Click to expand"', () => {
      renderNode({ displayMode: 'compact' });
      expect(screen.getByRole('button')).toHaveAttribute('title', 'Click to expand');
    });

    it('en detail: title="Click to collapse"', () => {
      renderNode({ displayMode: 'detail' });
      expect(screen.getByRole('button')).toHaveAttribute('title', 'Click to collapse');
    });

    it('ja compact: title="クリックで詳細表示"', () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      renderNode({ displayMode: 'compact' });
      expect(screen.getByRole('button')).toHaveAttribute('title', 'クリックで詳細表示');
    });

    it('ja detail: title="クリックでコンパクト表示"', () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      renderNode({ displayMode: 'detail' });
      expect(screen.getByRole('button')).toHaveAttribute('title', 'クリックでコンパクト表示');
    });
  });
});
