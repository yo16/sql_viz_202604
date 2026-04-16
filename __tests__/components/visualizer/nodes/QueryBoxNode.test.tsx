import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { QueryBoxNode } from '@/components/visualizer/nodes/QueryBoxNode';
import { useLocaleStore } from '@/stores/localeStore';
import { SSR_INITIAL_LOCALE } from '@/i18n/types';

function renderNode(props: { title: string; queryType?: 'select' | 'ctas'; displayMode?: 'compact' | 'detail' }) {
  const data = {
    tableName: 'test_table',
    title: props.title,
    queryType: props.queryType ?? 'select',
    displayMode: props.displayMode ?? 'compact',
    compactColumns: [],
    isRegistered: true,
  };
  return render(
    <QueryBoxNode
      id="test-id"
      data={data as unknown as Record<string, unknown>}
      type="queryBox"
      selected={false}
      zIndex={0}
      isConnectable
      xPos={0}
      yPos={0}
      dragging={false}
    />
  );
}

describe('QueryBoxNode useLocale 化', () => {
  beforeEach(() => {
    act(() => {
      useLocaleStore.setState({ locale: SSR_INITIAL_LOCALE });
    });
  });

  describe('プレースホルダタイトルの翻訳', () => {
    it('en: title="[問い合わせ]" → "[Query]" 表示', () => {
      renderNode({ title: '[問い合わせ]' });
      expect(screen.getByText('[Query]')).toBeInTheDocument();
    });

    it('ja: title="[問い合わせ]" → "[問い合わせ]" 表示', () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      renderNode({ title: '[問い合わせ]' });
      expect(screen.getByText('[問い合わせ]')).toBeInTheDocument();
    });

    it('en: title="[サブクエリ]" → "[Subquery]" 表示', () => {
      renderNode({ title: '[サブクエリ]' });
      expect(screen.getByText('[Subquery]')).toBeInTheDocument();
    });

    it('ja: title="[サブクエリ]" → "[サブクエリ]" 表示', () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      renderNode({ title: '[サブクエリ]' });
      expect(screen.getByText('[サブクエリ]')).toBeInTheDocument();
    });
  });

  describe('動的タイトル（テーブル名等）はそのまま', () => {
    it('テーブル名 "users" は en/ja 両方で同じ', () => {
      renderNode({ title: 'users' });
      expect(screen.getByText('users')).toBeInTheDocument();

      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      renderNode({ title: 'users' });
      // 2回render したので 2 件あるが、両方とも 'users' が表示されていれば OK
      expect(screen.getAllByText('users').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('クリックヒントツールチップの翻訳', () => {
    it('en compact: title属性 "Click to expand"', () => {
      renderNode({ title: 'users', displayMode: 'compact' });
      const titleBar = screen.getByRole('button');
      expect(titleBar).toHaveAttribute('title', 'Click to expand');
    });

    it('ja compact: title属性 "クリックで詳細表示"', () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      renderNode({ title: 'users', displayMode: 'compact' });
      expect(screen.getByRole('button')).toHaveAttribute('title', 'クリックで詳細表示');
    });

    it('en detail: title属性 "Click to collapse"', () => {
      renderNode({ title: 'users', displayMode: 'detail' });
      expect(screen.getByRole('button')).toHaveAttribute('title', 'Click to collapse');
    });

    it('ja detail: title属性 "クリックでコンパクト表示"', () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      renderNode({ title: 'users', displayMode: 'detail' });
      expect(screen.getByRole('button')).toHaveAttribute('title', 'クリックでコンパクト表示');
    });
  });

  describe('isOmitted のメッセージ翻訳', () => {
    it('en: omitMessage 未指定時は "... (omitted)"', () => {
      const data = {
        tableName: 't',
        title: 't',
        queryType: 'select',
        displayMode: 'compact',
        compactColumns: [],
        isRegistered: true,
        isOmitted: true,
      };
      render(
        <QueryBoxNode
          id="test-id"
          data={data as unknown as Record<string, unknown>}
          type="queryBox"
          selected={false}
          zIndex={0}
          isConnectable
          xPos={0}
          yPos={0}
          dragging={false}
        />
      );
      expect(screen.getByText('... (omitted)')).toBeInTheDocument();
    });

    it('ja: omitMessage 未指定時は "...（省略）"', () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      const data = {
        tableName: 't',
        title: 't',
        queryType: 'select',
        displayMode: 'compact',
        compactColumns: [],
        isRegistered: true,
        isOmitted: true,
      };
      render(
        <QueryBoxNode
          id="test-id"
          data={data as unknown as Record<string, unknown>}
          type="queryBox"
          selected={false}
          zIndex={0}
          isConnectable
          xPos={0}
          yPos={0}
          dragging={false}
        />
      );
      expect(screen.getByText('...（省略）')).toBeInTheDocument();
    });
  });
});
