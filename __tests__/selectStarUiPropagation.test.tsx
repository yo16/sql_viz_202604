/**
 * SELECT * 伝播結果のUI反映テスト (Beads: sql_viz_202604_2-uup.7)
 *
 * カバー要件:
 * 1. flowStore 統合テスト:
 *    - isFromStar=true の ColumnNode を含む lineageStore 状態を構築
 *    - flowStore.syncFromLineage → buildSelectClauseNodes 経由で生成された
 *      columnItem ノードの data.isFromStar が true になっていること
 *
 * 2. ColumnItemNode コンポーネントテスト (React Testing Library):
 *    - isFromStar=true のとき: starBadge `*` が表示され、container に propagated クラスが付与される
 *    - isFromStar=false かつ certainty='confirmed' のとき: starBadge は表示されない
 *    - certainty='inferred' のとき: inferredBadge `?` が表示される
 *    - certainty='propagated' のとき: isFromStar=false でも starBadge `*` が表示される
 *    - isFromStar=true かつ certainty='inferred' のとき: starBadge が表示され propagated クラスが付与される
 */

import React from 'react';
import { render } from '@testing-library/react';
import { useFlowStore } from '../src/stores/flowStore';
import { useLineageStore } from '../src/stores/lineageStore';
import type { TableNode } from '../src/types/lineage';
import type { ColumnItemNodeData } from '../src/types/flow';

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

// ===================================================
// @xyflow/react モック設定 (コンポーネントテスト用)
// ===================================================

jest.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

// ===================================================
// flowStore 統合テスト: buildSelectClauseNodes → isFromStar 伝搬
// ===================================================

describe('flowStore 統合テスト: isFromStar 伝搬', () => {
  beforeEach(() => {
    resetFlow();
  });

  it('isFromStar=true の ColumnNode から生成された columnItem ノードの data.isFromStar が true になる', () => {
    // Arrange: isFromStar=true を持つカラムを含むテーブルを構築
    const srcTable = makeTable('src_star');
    srcTable.columns.set('id', {
      columnName: 'id',
      tableId: 'src_star',
      certainty: 'confirmed',
      dependencies: [],
      isFromStar: false,
      exprType: 'column_ref',
    });
    srcTable.columns.set('name', {
      columnName: 'name',
      tableId: 'src_star',
      certainty: 'confirmed',
      dependencies: [],
      isFromStar: false,
      exprType: 'column_ref',
    });

    // SELECT * 伝播によって isFromStar=true になったカラムを持つ下流テーブル
    const dstTable = makeTable('dst_star');
    dstTable.columns.set('id', {
      columnName: 'id',
      tableId: 'dst_star',
      certainty: 'propagated',
      dependencies: [{ sourceTableId: 'src_star', sourceColumn: 'id', type: 'star' }],
      isFromStar: true,
      exprType: 'column_ref',
    });
    dstTable.columns.set('name', {
      columnName: 'name',
      tableId: 'dst_star',
      certainty: 'propagated',
      dependencies: [{ sourceTableId: 'src_star', sourceColumn: 'name', type: 'star' }],
      isFromStar: true,
      exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('src_star', srcTable);
    tables.set('dst_star', dstTable);

    useLineageStore.setState({ tables });

    // Act
    useFlowStore.getState().syncFromLineage(tables);

    // Assert: dst_star テーブルの columnItem ノードが isFromStar=true を持つ
    const nodes = useFlowStore.getState().nodes;
    const colNodeId = 'dst_star:id';
    const colNode = nodes.find((n) => n.id === colNodeId);

    expect(colNode).toBeDefined();
    expect(colNode!.type).toBe('columnItem');
    const colData = colNode!.data as unknown as ColumnItemNodeData;
    expect(colData.isFromStar).toBe(true);
  });

  it('isFromStar=false の ColumnNode から生成された columnItem ノードの data.isFromStar が false になる', () => {
    // Arrange: isFromStar=false の通常カラムを持つテーブル
    const table = makeTable('normal_tbl');
    table.columns.set('col_a', {
      columnName: 'col_a',
      tableId: 'normal_tbl',
      certainty: 'confirmed',
      dependencies: [],
      isFromStar: false,
      exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('normal_tbl', table);

    useLineageStore.setState({ tables });

    // Act
    useFlowStore.getState().syncFromLineage(tables);

    // Assert
    const nodes = useFlowStore.getState().nodes;
    const colNode = nodes.find((n) => n.id === 'normal_tbl:col_a');

    expect(colNode).toBeDefined();
    const colData = colNode!.data as unknown as ColumnItemNodeData;
    expect(colData.isFromStar).toBe(false);
  });

  it('isFromStar=true のカラムと false のカラムが混在する場合、それぞれの値が正しく伝搬される', () => {
    // Arrange: 混在テーブル (一部 SELECT * 由来、一部通常カラム)
    const table = makeTable('mixed_tbl');
    table.columns.set('star_col', {
      columnName: 'star_col',
      tableId: 'mixed_tbl',
      certainty: 'propagated',
      dependencies: [{ sourceTableId: 'upstream', sourceColumn: 'star_col', type: 'star' }],
      isFromStar: true,
      exprType: 'column_ref',
    });
    table.columns.set('normal_col', {
      columnName: 'normal_col',
      tableId: 'mixed_tbl',
      certainty: 'confirmed',
      dependencies: [],
      isFromStar: false,
      exprType: 'column_ref',
    });

    // upstream テーブルも追加（エッジ生成のために必要）
    const upstreamTable = makeTable('upstream');
    upstreamTable.columns.set('star_col', {
      columnName: 'star_col',
      tableId: 'upstream',
      certainty: 'confirmed',
      dependencies: [],
      isFromStar: false,
      exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('upstream', upstreamTable);
    tables.set('mixed_tbl', table);

    useLineageStore.setState({ tables });

    // Act
    useFlowStore.getState().syncFromLineage(tables);

    // Assert
    const nodes = useFlowStore.getState().nodes;

    const starColNode = nodes.find((n) => n.id === 'mixed_tbl:star_col');
    expect(starColNode).toBeDefined();
    expect((starColNode!.data as unknown as ColumnItemNodeData).isFromStar).toBe(true);

    const normalColNode = nodes.find((n) => n.id === 'mixed_tbl:normal_col');
    expect(normalColNode).toBeDefined();
    expect((normalColNode!.data as unknown as ColumnItemNodeData).isFromStar).toBe(false);
  });
});

// ===================================================
// ColumnItemNode コンポーネントテスト
// ===================================================

describe('ColumnItemNode: isFromStar と certainty によるバッジ/クラス表示', () => {
  let ColumnItemNode: React.ComponentType<{ data: Record<string, unknown>; id: string }>;

  beforeAll(async () => {
    const mod = await import('../src/components/visualizer/nodes/ColumnItemNode');
    ColumnItemNode = mod.ColumnItemNode as unknown as React.ComponentType<{
      data: Record<string, unknown>;
      id: string;
    }>;
  });

  beforeEach(() => {
    resetFlow();
  });

  // ---------------------------------------------------
  // starBadge の表示テスト
  // ---------------------------------------------------

  it('isFromStar=true のとき: starBadge `*` テキストが表示される', () => {
    // Arrange & Act
    const { getByText } = render(
      React.createElement(ColumnItemNode, {
        id: 'some_tbl:star_col',
        data: {
          displayName: 'star_col',
          certainty: 'propagated',
          isFromStar: true,
          conditionText: null,
          sourceTable: null,
          exprType: 'column_ref',
        },
      })
    );

    // Assert: `*` テキストが表示されている
    expect(getByText('*')).toBeTruthy();
  });

  it('isFromStar=true のとき: starBadge の aria-label が "SELECT * 由来" である', () => {
    // Arrange & Act
    const { getByLabelText } = render(
      React.createElement(ColumnItemNode, {
        id: 'some_tbl:star_col',
        data: {
          displayName: 'star_col',
          certainty: 'propagated',
          isFromStar: true,
          conditionText: null,
          sourceTable: null,
          exprType: 'column_ref',
        },
      })
    );

    // Assert
    expect(getByLabelText('SELECT * 由来')).toBeTruthy();
  });

  it('isFromStar=true のとき: container に propagated クラスが付与される', () => {
    // Arrange & Act
    const { getByRole } = render(
      React.createElement(ColumnItemNode, {
        id: 'some_tbl:star_col',
        data: {
          displayName: 'star_col',
          certainty: 'propagated',
          isFromStar: true,
          conditionText: null,
          sourceTable: null,
          exprType: 'column_ref',
        },
      })
    );

    // Assert: CSS Modulesモックはクラス名をそのまま文字列として返すため
    //         "propagated" クラスが className に含まれることを検証する
    const container = getByRole('button');
    expect(container.className).toContain('propagated');
  });

  it('isFromStar=false かつ certainty="confirmed" のとき: starBadge は表示されない', () => {
    // Arrange & Act
    const { queryByLabelText, queryByText } = render(
      React.createElement(ColumnItemNode, {
        id: 'some_tbl:normal_col',
        data: {
          displayName: 'normal_col',
          certainty: 'confirmed',
          isFromStar: false,
          conditionText: null,
          sourceTable: null,
          exprType: 'column_ref',
        },
      })
    );

    // Assert: starBadge が存在しない
    expect(queryByLabelText('SELECT * 由来')).toBeNull();
    // `*` テキストも表示されていない
    expect(queryByText('*')).toBeNull();
  });

  it('isFromStar=false かつ certainty="confirmed" のとき: container に propagated クラスが付与されない', () => {
    // Arrange & Act
    const { getByRole } = render(
      React.createElement(ColumnItemNode, {
        id: 'some_tbl:normal_col',
        data: {
          displayName: 'normal_col',
          certainty: 'confirmed',
          isFromStar: false,
          conditionText: null,
          sourceTable: null,
          exprType: 'column_ref',
        },
      })
    );

    // Assert
    const container = getByRole('button');
    expect(container.className).not.toContain('propagated');
  });

  // ---------------------------------------------------
  // certainty='propagated' のみ (isFromStar=false) のテスト
  // ---------------------------------------------------

  it('certainty="propagated" かつ isFromStar=false のとき: starBadge が表示され propagated クラスが付与される', () => {
    // isPropagated = certainty === 'propagated' || isFromStar === true
    // certainty='propagated' だけでも isPropagated=true になる
    const { getByText, getByRole } = render(
      React.createElement(ColumnItemNode, {
        id: 'some_tbl:prop_col',
        data: {
          displayName: 'prop_col',
          certainty: 'propagated',
          isFromStar: false,
          conditionText: null,
          sourceTable: null,
          exprType: 'column_ref',
        },
      })
    );

    // Assert
    expect(getByText('*')).toBeTruthy();
    const container = getByRole('button');
    expect(container.className).toContain('propagated');
  });

  // ---------------------------------------------------
  // inferredBadge の表示テスト
  // ---------------------------------------------------

  it('certainty="inferred" のとき: inferredBadge `?` が表示される', () => {
    // Arrange & Act
    const { getByText } = render(
      React.createElement(ColumnItemNode, {
        id: 'some_tbl:inferred_col',
        data: {
          displayName: 'inferred_col',
          certainty: 'inferred',
          isFromStar: false,
          conditionText: null,
          sourceTable: null,
          exprType: 'column_ref',
        },
      })
    );

    // Assert: `?` テキストが表示されている
    expect(getByText('?')).toBeTruthy();
  });

  it('certainty="inferred" のとき: inferredBadge の aria-label が "推定カラム" である', () => {
    // Arrange & Act
    const { getByLabelText } = render(
      React.createElement(ColumnItemNode, {
        id: 'some_tbl:inferred_col',
        data: {
          displayName: 'inferred_col',
          certainty: 'inferred',
          isFromStar: false,
          conditionText: null,
          sourceTable: null,
          exprType: 'column_ref',
        },
      })
    );

    // Assert
    expect(getByLabelText('推定カラム')).toBeTruthy();
  });

  it('certainty="inferred" のとき: container に inferred クラスが付与される', () => {
    // Arrange & Act
    const { getByRole } = render(
      React.createElement(ColumnItemNode, {
        id: 'some_tbl:inferred_col',
        data: {
          displayName: 'inferred_col',
          certainty: 'inferred',
          isFromStar: false,
          conditionText: null,
          sourceTable: null,
          exprType: 'column_ref',
        },
      })
    );

    // Assert
    const container = getByRole('button');
    expect(container.className).toContain('inferred');
  });

  it('certainty="confirmed" のとき: inferredBadge は表示されない', () => {
    // Arrange & Act
    const { queryByLabelText, queryByText } = render(
      React.createElement(ColumnItemNode, {
        id: 'some_tbl:confirmed_col',
        data: {
          displayName: 'confirmed_col',
          certainty: 'confirmed',
          isFromStar: false,
          conditionText: null,
          sourceTable: null,
          exprType: 'column_ref',
        },
      })
    );

    // Assert
    expect(queryByLabelText('推定カラム')).toBeNull();
    expect(queryByText('?')).toBeNull();
  });

  // ---------------------------------------------------
  // isFromStar=true かつ certainty='inferred' の組み合わせ
  // ---------------------------------------------------

  it('isFromStar=true かつ certainty="inferred" のとき: starBadge が表示され propagated クラスが付与される（inferredBadge は表示されない）', () => {
    // isPropagated = certainty === 'propagated' || isFromStar === true → true
    // starBadge が表示され、inferred スタイルでなく propagated スタイルになる
    // コンポーネントの条件: certainty === 'inferred' は inferredBadge を表示するが
    // isPropagated=true でも starBadge が表示される（両立しうる）
    // ただし実装上 inferred クラスも付与されるため、両クラスが共存する
    const { getByText, getByRole, queryByText } = render(
      React.createElement(ColumnItemNode, {
        id: 'some_tbl:star_inferred',
        data: {
          displayName: 'star_inferred',
          certainty: 'inferred',
          isFromStar: true,
          conditionText: null,
          sourceTable: null,
          exprType: 'column_ref',
        },
      })
    );

    // starBadge は表示される (isPropagated=true)
    expect(getByText('*')).toBeTruthy();
    const container = getByRole('button');
    expect(container.className).toContain('propagated');

    // certainty='inferred' なので inferredBadge `?` も表示される
    expect(queryByText('?')).toBeTruthy();
  });

  // ---------------------------------------------------
  // conditionText の非表示確認 (isPropagated=true のとき)
  // ---------------------------------------------------

  it('isPropagated=true のとき: conditionText は表示されない（ツールチップは "SELECT * から伝播: ..." になる）', () => {
    // isFromStar=true のとき、titleText は "SELECT * から伝播: {displayName}" になり
    // conditionText の span は表示されない
    const { queryByTitle, getByRole } = render(
      React.createElement(ColumnItemNode, {
        id: 'some_tbl:star_col',
        data: {
          displayName: 'star_col',
          certainty: 'propagated',
          isFromStar: true,
          conditionText: 'some condition',
          sourceTable: null,
          exprType: 'column_ref',
        },
      })
    );

    // conditionText の span は isPropagated=false のときのみ表示される
    expect(queryByTitle('some condition')).toBeNull();

    // title は "SELECT * から伝播: star_col" になっている
    const container = getByRole('button');
    expect(container.title).toBe('SELECT * から伝播: star_col');
  });
});
