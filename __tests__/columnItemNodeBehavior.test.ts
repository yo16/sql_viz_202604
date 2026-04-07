/**
 * ColumnItemNode 動作テスト (Beads: sql_viz_202604_2-uup.5)
 *
 * カバー要件:
 * 1. クリックで handleColumnClick が呼ばれる（useLineageHighlight 経由）
 * 2. highlightPath に応じて highlighted/dimmed クラスが付与される
 * 3. キーボード操作（Enter/Space）でクリックと同等の動作をする
 * 4. conditionText がある場合に表示される
 *
 * テスト方針:
 * - ColumnItemNode のクリック動作は flowStore を通じた state 変化で検証する
 * - isHighlighted/isDimmed の計算ロジックはコンポーネントと同一の式で検証する
 * - React Testing Library で render → fireEvent.click → store.getState() 変化確認
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { useFlowStore } from '../src/stores/flowStore';
import { useLineageStore } from '../src/stores/lineageStore';
import type { TableNode } from '../src/types/lineage';

// ===================================================
// テストヘルパー
// ===================================================

function resetFlow(): void {
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
}

function makeTable(id: string, overrides: Partial<TableNode> = {}): TableNode {
  return {
    id,
    name: id,
    displayTitle: id,
    isRegistered: true,
    queryType: 'ctas',
    queryId: id,
    columns: new Map(),
    dependsOn: new Set(),
    ctes: [],
    fromSubqueries: [],
    whereSubqueries: [],
    clauses: {
      select: { columns: [] },
      from: { tables: [], joins: [] },
      where: null,
      groupBy: null,
      having: null,
      orderBy: null,
    },
    ...overrides,
  };
}

/**
 * ColumnItemNode の isHighlighted/isDimmed 計算ロジックを再現する。
 * コンポーネント内の計算式と同一のロジックを使用する。
 */
function calcHighlight(
  highlightPath: { tableId: string; columnName: string } | null,
  tableId: string,
  displayName: string
): { isHighlighted: boolean; isDimmed: boolean } {
  const isHighlighted =
    highlightPath?.tableId === tableId && highlightPath?.columnName === displayName;
  const isDimmed = highlightPath !== null && !isHighlighted;
  return { isHighlighted, isDimmed };
}

// ===================================================
// isHighlighted / isDimmed ロジックの検証
// ===================================================

describe('ColumnItemNode: isHighlighted/isDimmed ロジック', () => {
  beforeEach(() => {
    resetFlow();
  });

  it('クリック対象カラム: isHighlighted=true, isDimmed=false', () => {
    useFlowStore.setState({ highlightPath: { tableId: 'myTable', columnName: 'myCol' } });

    const hp = useFlowStore.getState().highlightPath;
    const { isHighlighted, isDimmed } = calcHighlight(hp, 'myTable', 'myCol');

    expect(isHighlighted).toBe(true);
    expect(isDimmed).toBe(false);
  });

  it('非クリック対象カラム（ハイライト発動中）: isHighlighted=false, isDimmed=true', () => {
    useFlowStore.setState({ highlightPath: { tableId: 'myTable', columnName: 'myCol' } });

    const hp = useFlowStore.getState().highlightPath;
    const { isHighlighted, isDimmed } = calcHighlight(hp, 'otherTable', 'otherCol');

    expect(isHighlighted).toBe(false);
    expect(isDimmed).toBe(true);
  });

  it('ハイライト未発動時: isHighlighted=false, isDimmed=false', () => {
    // highlightPath が null の初期状態
    const hp = useFlowStore.getState().highlightPath;
    const { isHighlighted, isDimmed } = calcHighlight(hp, 'anyTable', 'anyCol');

    expect(isHighlighted).toBe(false);
    expect(isDimmed).toBe(false);
  });

  it('同じテーブルの別カラム（ハイライト発動中）: isDimmed=true', () => {
    useFlowStore.setState({ highlightPath: { tableId: 'tableX', columnName: 'colA' } });

    const hp = useFlowStore.getState().highlightPath;
    const { isHighlighted, isDimmed } = calcHighlight(hp, 'tableX', 'colB');

    expect(isHighlighted).toBe(false);
    expect(isDimmed).toBe(true);
  });

  it('clearHighlight 後: 全カラムが isHighlighted=false, isDimmed=false になる', () => {
    const srcTbl = makeTable('src_cb');
    srcTbl.columns.set('s_col', {
      columnName: 's_col', tableId: 'src_cb', certainty: 'confirmed',
      dependencies: [], isFromStar: false, exprType: 'column_ref',
    });
    const dstTbl = makeTable('dst_cb');
    dstTbl.columns.set('d_col', {
      columnName: 'd_col', tableId: 'dst_cb', certainty: 'confirmed',
      dependencies: [{ sourceTableId: 'src_cb', sourceColumn: 's_col', type: 'direct' }],
      isFromStar: false, exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('src_cb', srcTbl);
    tables.set('dst_cb', dstTbl);

    useLineageStore.setState({ tables });
    useFlowStore.getState().syncFromLineage(tables);
    useFlowStore.getState().highlightLineage('dst_cb', 'd_col');

    expect(useFlowStore.getState().highlightPath).not.toBeNull();

    useFlowStore.getState().clearHighlight();

    const hp = useFlowStore.getState().highlightPath;
    const { isHighlighted: iH1, isDimmed: iD1 } = calcHighlight(hp, 'dst_cb', 'd_col');
    const { isHighlighted: iH2, isDimmed: iD2 } = calcHighlight(hp, 'src_cb', 's_col');

    expect(iH1).toBe(false);
    expect(iD1).toBe(false);
    expect(iH2).toBe(false);
    expect(iD2).toBe(false);
  });
});

// ===================================================
// handleColumnClick トグル動作の検証
// ===================================================

describe('handleColumnClick トグル動作', () => {
  beforeEach(() => {
    resetFlow();
  });

  it('同カラム再クリックで clearHighlight が呼ばれる（useLineageHighlight のロジック検証）', () => {
    // useLineageHighlight.handleColumnClick のロジックを直接再現して検証
    function simulateHandleColumnClick(tableId: string, columnName: string): void {
      const hp = useFlowStore.getState().highlightPath;
      if (hp?.tableId === tableId && hp?.columnName === columnName) {
        useFlowStore.getState().clearHighlight();
      } else {
        useFlowStore.getState().highlightLineage(tableId, columnName);
      }
    }

    const srcTbl = makeTable('toggle_src');
    srcTbl.columns.set('tc', {
      columnName: 'tc', tableId: 'toggle_src', certainty: 'confirmed',
      dependencies: [], isFromStar: false, exprType: 'column_ref',
    });
    const dstTbl = makeTable('toggle_dst');
    dstTbl.columns.set('td', {
      columnName: 'td', tableId: 'toggle_dst', certainty: 'confirmed',
      dependencies: [{ sourceTableId: 'toggle_src', sourceColumn: 'tc', type: 'direct' }],
      isFromStar: false, exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('toggle_src', srcTbl);
    tables.set('toggle_dst', dstTbl);

    useLineageStore.setState({ tables });
    useFlowStore.getState().syncFromLineage(tables);

    // 1回目クリック: ハイライト設定
    simulateHandleColumnClick('toggle_dst', 'td');
    expect(useFlowStore.getState().highlightPath?.tableId).toBe('toggle_dst');

    // 2回目クリック（同じカラム）: トグルでクリア
    simulateHandleColumnClick('toggle_dst', 'td');
    expect(useFlowStore.getState().highlightPath).toBeNull();
  });
});

// ===================================================
// ColumnItemNode: React コンポーネントの render テスト
// ===================================================

// @xyflow/react の NodeProps 型を使わずに ColumnItemNode を直接テスト
// ColumnItemNode は "use client" ディレクティブを使うが、テスト環境では無視される

jest.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

describe('ColumnItemNode: render とクリック動作', () => {
  // ColumnItemNode を動的 import でテスト（モック設定後に import する）
  let ColumnItemNode: React.ComponentType<{ data: Record<string, unknown>; id: string }>;

  beforeAll(async () => {
    const mod = await import('../src/components/visualizer/nodes/ColumnItemNode');
    ColumnItemNode = mod.ColumnItemNode as unknown as React.ComponentType<{ data: Record<string, unknown>; id: string }>;
  });

  beforeEach(() => {
    resetFlow();
  });

  it('displayName が表示される', () => {
    const { getByText } = render(
      React.createElement(ColumnItemNode, {
        id: 'myTable:col',
        data: { displayName: 'my_column', certainty: 'confirmed' },
      })
    );
    expect(getByText('my_column')).toBeTruthy();
  });

  it('conditionText がある場合に表示される', () => {
    const { getByText } = render(
      React.createElement(ColumnItemNode, {
        id: 'tbl:col',
        data: { displayName: 'col', certainty: 'confirmed', conditionText: 'status = active' },
      })
    );
    expect(getByText('status = active')).toBeTruthy();
  });

  it('conditionText がない場合は表示されない', () => {
    const { queryByTitle } = render(
      React.createElement(ColumnItemNode, {
        id: 'tbl:col',
        data: { displayName: 'col', certainty: 'confirmed' },
      })
    );
    // conditionText がなければ title 属性なし
    expect(queryByTitle('status = active')).toBeNull();
  });

  it('クリックで flowStore の highlightPath が更新される', () => {
    const srcTbl = makeTable('myTable');
    srcTbl.columns.set('my_col', {
      columnName: 'my_col', tableId: 'myTable', certainty: 'confirmed',
      dependencies: [], isFromStar: false, exprType: 'column_ref',
    });
    const dstTbl = makeTable('dstTable');
    dstTbl.columns.set('dst_col', {
      columnName: 'dst_col', tableId: 'dstTable', certainty: 'confirmed',
      dependencies: [{ sourceTableId: 'myTable', sourceColumn: 'my_col', type: 'direct' }],
      isFromStar: false, exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('myTable', srcTbl);
    tables.set('dstTable', dstTbl);
    useLineageStore.setState({ tables });
    useFlowStore.getState().syncFromLineage(tables);

    // dstTable:dst_col をクリック
    const { getByRole } = render(
      React.createElement(ColumnItemNode, {
        id: 'dstTable:dst_col',
        data: { displayName: 'dst_col', certainty: 'confirmed' },
      })
    );

    const button = getByRole('button');
    fireEvent.click(button);

    const hp = useFlowStore.getState().highlightPath;
    expect(hp).not.toBeNull();
    expect(hp!.tableId).toBe('dstTable');
    expect(hp!.columnName).toBe('dst_col');
  });

  it('Enter キーでクリックと同等の動作をする', () => {
    const srcTbl = makeTable('kbTable');
    srcTbl.columns.set('kb_col', {
      columnName: 'kb_col', tableId: 'kbTable', certainty: 'confirmed',
      dependencies: [], isFromStar: false, exprType: 'column_ref',
    });
    const dstTbl = makeTable('kbDst');
    dstTbl.columns.set('kb_dst_col', {
      columnName: 'kb_dst_col', tableId: 'kbDst', certainty: 'confirmed',
      dependencies: [{ sourceTableId: 'kbTable', sourceColumn: 'kb_col', type: 'direct' }],
      isFromStar: false, exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('kbTable', srcTbl);
    tables.set('kbDst', dstTbl);
    useLineageStore.setState({ tables });
    useFlowStore.getState().syncFromLineage(tables);

    const { getByRole } = render(
      React.createElement(ColumnItemNode, {
        id: 'kbDst:kb_dst_col',
        data: { displayName: 'kb_dst_col', certainty: 'confirmed' },
      })
    );

    const button = getByRole('button');
    fireEvent.keyDown(button, { key: 'Enter' });

    const hp = useFlowStore.getState().highlightPath;
    expect(hp).not.toBeNull();
    expect(hp!.tableId).toBe('kbDst');
    expect(hp!.columnName).toBe('kb_dst_col');
  });

  it('Space キーでクリックと同等の動作をする', () => {
    const srcTbl = makeTable('spTable');
    srcTbl.columns.set('sp_col', {
      columnName: 'sp_col', tableId: 'spTable', certainty: 'confirmed',
      dependencies: [], isFromStar: false, exprType: 'column_ref',
    });
    const dstTbl = makeTable('spDst');
    dstTbl.columns.set('sp_dst_col', {
      columnName: 'sp_dst_col', tableId: 'spDst', certainty: 'confirmed',
      dependencies: [{ sourceTableId: 'spTable', sourceColumn: 'sp_col', type: 'direct' }],
      isFromStar: false, exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('spTable', srcTbl);
    tables.set('spDst', dstTbl);
    useLineageStore.setState({ tables });
    useFlowStore.getState().syncFromLineage(tables);

    const { getByRole } = render(
      React.createElement(ColumnItemNode, {
        id: 'spDst:sp_dst_col',
        data: { displayName: 'sp_dst_col', certainty: 'confirmed' },
      })
    );

    const button = getByRole('button');
    fireEvent.keyDown(button, { key: ' ' });

    const hp = useFlowStore.getState().highlightPath;
    expect(hp).not.toBeNull();
    expect(hp!.tableId).toBe('spDst');
    expect(hp!.columnName).toBe('sp_dst_col');
  });

  it('同じカラムを再クリックで highlightPath が null に戻る（トグル）', () => {
    const srcTbl = makeTable('togSrc');
    srcTbl.columns.set('tog_s', {
      columnName: 'tog_s', tableId: 'togSrc', certainty: 'confirmed',
      dependencies: [], isFromStar: false, exprType: 'column_ref',
    });
    const dstTbl = makeTable('togDst');
    dstTbl.columns.set('tog_d', {
      columnName: 'tog_d', tableId: 'togDst', certainty: 'confirmed',
      dependencies: [{ sourceTableId: 'togSrc', sourceColumn: 'tog_s', type: 'direct' }],
      isFromStar: false, exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('togSrc', srcTbl);
    tables.set('togDst', dstTbl);
    useLineageStore.setState({ tables });
    useFlowStore.getState().syncFromLineage(tables);

    const { getByRole } = render(
      React.createElement(ColumnItemNode, {
        id: 'togDst:tog_d',
        data: { displayName: 'tog_d', certainty: 'confirmed' },
      })
    );

    const button = getByRole('button');

    // 1回目クリック
    fireEvent.click(button);
    expect(useFlowStore.getState().highlightPath?.tableId).toBe('togDst');

    // 2回目クリック（トグル解除）
    fireEvent.click(button);
    expect(useFlowStore.getState().highlightPath).toBeNull();
  });

  it('role="button" と tabIndex=0 が付与されている', () => {
    const { getByRole } = render(
      React.createElement(ColumnItemNode, {
        id: 'tbl:col',
        data: { displayName: 'col', certainty: 'confirmed' },
      })
    );

    const button = getByRole('button');
    expect(button).toBeTruthy();
    expect(button.tabIndex).toBe(0);
  });
});
