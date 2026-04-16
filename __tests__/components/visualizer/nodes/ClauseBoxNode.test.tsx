import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { ClauseBoxNode } from '@/components/visualizer/nodes/ClauseBoxNode';
import { useLocaleStore } from '@/stores/localeStore';
import { SSR_INITIAL_LOCALE } from '@/i18n/types';

type Clause = 'SELECT' | 'FROM' | 'WHERE' | 'GROUP BY' | 'HAVING' | 'ORDER BY';

function renderNode(props: { clauseType: Clause; label?: string; expanded?: boolean }) {
  const data = {
    clauseType: props.clauseType,
    label: props.label ?? props.clauseType,
    expanded: props.expanded ?? false,
  };
  return render(
    <ClauseBoxNode
      id="test-id"
      data={data as unknown as Record<string, unknown>}
      type="clauseBox"
      selected={false}
      zIndex={0}
      isConnectable dragging={false} selectable={true} deletable={true} draggable={true} positionAbsoluteX={0} positionAbsoluteY={0}
    />
  );
}

describe('ClauseBoxNode useLocale 化', () => {
  beforeEach(() => {
    act(() => {
      useLocaleStore.setState({ locale: SSR_INITIAL_LOCALE });
    });
  });

  describe('en: 句ラベルが SQL keyword のみ ("句" 省略)', () => {
    const cases: Array<[Clause, string]> = [
      ['SELECT', 'SELECT'],
      ['FROM', 'FROM'],
      ['WHERE', 'WHERE'],
      ['GROUP BY', 'GROUP BY'],
      ['HAVING', 'HAVING'],
      ['ORDER BY', 'ORDER BY'],
    ];
    it.each(cases)('clauseType=%s → "%s"', (clauseType, expected) => {
      renderNode({ clauseType });
      expect(screen.getByText(expected)).toBeInTheDocument();
    });
  });

  describe('ja: 句ラベルに "句" が付く', () => {
    beforeEach(() => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
    });

    const cases: Array<[Clause, string]> = [
      ['SELECT', 'SELECT句'],
      ['FROM', 'FROM句'],
      ['WHERE', 'WHERE句'],
      ['GROUP BY', 'GROUP BY句'],
      ['HAVING', 'HAVING句'],
      ['ORDER BY', 'ORDER BY句'],
    ];
    it.each(cases)('clauseType=%s → "%s"', (clauseType, expected) => {
      renderNode({ clauseType });
      expect(screen.getByText(expected)).toBeInTheDocument();
    });
  });

  describe('展開ツールチップの翻訳', () => {
    it('en: collapsed (FROM) で title="Expand"', () => {
      renderNode({ clauseType: 'FROM', label: 'users INNER JOIN orders ON users.id = orders.user_id', expanded: false });
      expect(screen.getByRole('button')).toHaveAttribute('title', 'Expand');
    });

    it('en: expanded で title="Collapse"', () => {
      renderNode({ clauseType: 'FROM', label: 'users', expanded: true });
      expect(screen.getByRole('button')).toHaveAttribute('title', 'Collapse');
    });

    it('ja: collapsed で title="展開"', () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      renderNode({ clauseType: 'FROM', label: 'users', expanded: false });
      expect(screen.getByRole('button')).toHaveAttribute('title', '展開');
    });

    it('ja: expanded で title="折りたたむ"', () => {
      act(() => {
        useLocaleStore.setState({ locale: 'ja' });
      });
      renderNode({ clauseType: 'FROM', label: 'users', expanded: true });
      expect(screen.getByRole('button')).toHaveAttribute('title', '折りたたむ');
    });
  });

  describe('SELECT は展開不可（toggle なし）', () => {
    it('SELECT は role="button" を持たない', () => {
      renderNode({ clauseType: 'SELECT' });
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});
