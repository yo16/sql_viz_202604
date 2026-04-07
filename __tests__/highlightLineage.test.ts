/**
 * highlightLineage アクション詳細テスト (Beads: sql_viz_202604_2-uup.5)
 *
 * カバー要件:
 * 1. column_lineage 依存があるカラムをハイライト → highlightPath 設定、
 *    対応エッジ isHighlighted=true、他エッジ isDimmed=true
 * 2. 早期 return: 依存ゼロのカラムをクリック → state 変化なし
 * 3. clearHighlight: highlightPath=null、エッジ isHighlighted/isDimmed=false
 * 4. syncFromLineage: column_lineage エッジが生成される
 * 5. table_dependency エッジはハイライト時 isDimmed=true になる
 */

import { useFlowStore } from '../src/stores/flowStore';
import { useLineageStore } from '../src/stores/lineageStore';
import type { TableNode } from '../src/types/lineage';

// ===================================================
// テストヘルパー
// ===================================================

/** flowStore を初期状態にリセットする */
function resetFlow(): void {
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
}

/** TableNode を最小限のフィールドで生成する */
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
// syncFromLineage テスト
// ===================================================

describe('syncFromLineage', () => {
  beforeEach(() => {
    resetFlow();
  });

  it('column_lineage 依存を持つカラムからエッジが生成される', () => {
    const srcTable = makeTable('src');
    srcTable.columns.set('value', {
      columnName: 'value', tableId: 'src', certainty: 'confirmed',
      dependencies: [], isFromStar: false, exprType: 'column_ref',
    });

    const dstTable = makeTable('dst');
    dstTable.columns.set('amount', {
      columnName: 'amount', tableId: 'dst', certainty: 'confirmed',
      dependencies: [{ sourceTableId: 'src', sourceColumn: 'value', type: 'direct' }],
      isFromStar: false, exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('src', srcTable);
    tables.set('dst', dstTable);

    useFlowStore.getState().syncFromLineage(tables);
    const edges = useFlowStore.getState().edges;

    const colEdge = edges.find((e) => (e.data as Record<string, unknown>)?.dependencyType === 'column_lineage');
    expect(colEdge).toBeDefined();
    expect(colEdge!.source).toBe('src');
    expect(colEdge!.target).toBe('dst');
    expect((colEdge!.data as Record<string, unknown>).isHighlighted).toBe(false);
    expect((colEdge!.data as Record<string, unknown>).isDimmed).toBe(false);
  });

  it('column_lineage エッジの ID が col-edge- プレフィックスを持つ', () => {
    const srcTable = makeTable('tbl_a');
    const dstTable = makeTable('tbl_b');
    dstTable.columns.set('col_x', {
      columnName: 'col_x', tableId: 'tbl_b', certainty: 'confirmed',
      dependencies: [{ sourceTableId: 'tbl_a', sourceColumn: 'col_y', type: 'direct' }],
      isFromStar: false, exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('tbl_a', srcTable);
    tables.set('tbl_b', dstTable);
    useFlowStore.getState().syncFromLineage(tables);

    const edges = useFlowStore.getState().edges;
    const colEdge = edges.find((e) => e.id.startsWith('col-edge-'));
    expect(colEdge).toBeDefined();
    expect(colEdge!.id).toBe('col-edge-tbl_a-tbl_b-col_y-col_x');
  });

  it('参照先テーブルが tables に存在しない場合は column_lineage エッジを生成しない', () => {
    const dstTable = makeTable('dst');
    dstTable.columns.set('col', {
      columnName: 'col', tableId: 'dst', certainty: 'confirmed',
      dependencies: [{ sourceTableId: 'nonexistent', sourceColumn: 'val', type: 'direct' }],
      isFromStar: false, exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('dst', dstTable);
    useFlowStore.getState().syncFromLineage(tables);

    const edges = useFlowStore.getState().edges;
    const colEdge = edges.find((e) => (e.data as Record<string, unknown>)?.dependencyType === 'column_lineage');
    expect(colEdge).toBeUndefined();
  });
});

// ===================================================
// highlightLineage: 通常ケース（依存あり）
// ===================================================

describe('highlightLineage (依存あり)', () => {
  beforeEach(() => {
    resetFlow();
  });

  it('依存ありカラム → highlightPath が設定される', () => {
    const srcTable = makeTable('upstream');
    srcTable.columns.set('val', {
      columnName: 'val', tableId: 'upstream', certainty: 'confirmed',
      dependencies: [], isFromStar: false, exprType: 'column_ref',
    });
    const dstTable = makeTable('downstream');
    dstTable.columns.set('result', {
      columnName: 'result', tableId: 'downstream', certainty: 'confirmed',
      dependencies: [{ sourceTableId: 'upstream', sourceColumn: 'val', type: 'direct' }],
      isFromStar: false, exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('upstream', srcTable);
    tables.set('downstream', dstTable);

    useLineageStore.setState({ tables });
    useFlowStore.getState().syncFromLineage(tables);
    useFlowStore.getState().highlightLineage('downstream', 'result');

    const s = useFlowStore.getState();
    expect(s.highlightPath).not.toBeNull();
    expect(s.highlightPath!.tableId).toBe('downstream');
    expect(s.highlightPath!.columnName).toBe('result');
  });

  it('対応する column_lineage エッジが isHighlighted=true になる', () => {
    const srcTable = makeTable('t_src');
    srcTable.columns.set('src_col', {
      columnName: 'src_col', tableId: 't_src', certainty: 'confirmed',
      dependencies: [], isFromStar: false, exprType: 'column_ref',
    });
    const dstTable = makeTable('t_dst');
    dstTable.columns.set('dst_col', {
      columnName: 'dst_col', tableId: 't_dst', certainty: 'confirmed',
      dependencies: [{ sourceTableId: 't_src', sourceColumn: 'src_col', type: 'direct' }],
      isFromStar: false, exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('t_src', srcTable);
    tables.set('t_dst', dstTable);

    useLineageStore.setState({ tables });
    useFlowStore.getState().syncFromLineage(tables);
    useFlowStore.getState().highlightLineage('t_dst', 'dst_col');

    const edges = useFlowStore.getState().edges;
    const colEdge = edges.find((e) => (e.data as Record<string, unknown>)?.dependencyType === 'column_lineage');
    expect(colEdge).toBeDefined();
    expect((colEdge!.data as Record<string, unknown>).isHighlighted).toBe(true);
    expect((colEdge!.data as Record<string, unknown>).isDimmed).toBe(false);
  });

  it('非対象の column_lineage エッジが isDimmed=true になる', () => {
    // src → dst1, src → dst2 の2カラムリネージュ
    const srcTable = makeTable('source');
    srcTable.columns.set('a', {
      columnName: 'a', tableId: 'source', certainty: 'confirmed',
      dependencies: [], isFromStar: false, exprType: 'column_ref',
    });

    const dst1 = makeTable('dest1');
    dst1.columns.set('col1', {
      columnName: 'col1', tableId: 'dest1', certainty: 'confirmed',
      dependencies: [{ sourceTableId: 'source', sourceColumn: 'a', type: 'direct' }],
      isFromStar: false, exprType: 'column_ref',
    });

    const dst2 = makeTable('dest2');
    dst2.columns.set('col2', {
      columnName: 'col2', tableId: 'dest2', certainty: 'confirmed',
      dependencies: [{ sourceTableId: 'source', sourceColumn: 'a', type: 'direct' }],
      isFromStar: false, exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('source', srcTable);
    tables.set('dest1', dst1);
    tables.set('dest2', dst2);

    useLineageStore.setState({ tables });
    useFlowStore.getState().syncFromLineage(tables);

    // dest1.col1 のみハイライト
    useFlowStore.getState().highlightLineage('dest1', 'col1');

    const edges = useFlowStore.getState().edges;
    const colEdges = edges.filter((e) => (e.data as Record<string, unknown>)?.dependencyType === 'column_lineage');
    expect(colEdges).toHaveLength(2);

    const highlightedEdge = colEdges.find((e) => (e.data as Record<string, unknown>).isHighlighted === true);
    const dimmedEdge = colEdges.find((e) => (e.data as Record<string, unknown>).isDimmed === true);

    expect(highlightedEdge).toBeDefined();
    expect(dimmedEdge).toBeDefined();
    expect((dimmedEdge!.data as Record<string, unknown>).isHighlighted).toBe(false);
  });

  it('table_dependency エッジはハイライト時 isDimmed=true になる', () => {
    const srcTable = makeTable('up');
    const dstTable = makeTable('down');
    dstTable.dependsOn = new Set(['up']);
    dstTable.columns.set('col', {
      columnName: 'col', tableId: 'down', certainty: 'confirmed',
      dependencies: [{ sourceTableId: 'up', sourceColumn: 'src', type: 'direct' }],
      isFromStar: false, exprType: 'column_ref',
    });
    srcTable.columns.set('src', {
      columnName: 'src', tableId: 'up', certainty: 'confirmed',
      dependencies: [], isFromStar: false, exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('up', srcTable);
    tables.set('down', dstTable);

    useLineageStore.setState({ tables });
    useFlowStore.getState().syncFromLineage(tables);
    useFlowStore.getState().highlightLineage('down', 'col');

    const edges = useFlowStore.getState().edges;
    const tableDepEdge = edges.find((e) => (e.data as Record<string, unknown>)?.dependencyType === 'table_dependency');
    expect(tableDepEdge).toBeDefined();
    expect((tableDepEdge!.data as Record<string, unknown>).isDimmed).toBe(true);
    expect((tableDepEdge!.data as Record<string, unknown>).isHighlighted).toBe(false);
  });
});

// ===================================================
// highlightLineage: 早期 return（依存ゼロ）
// ===================================================

describe('highlightLineage (依存ゼロ — 早期 return)', () => {
  beforeEach(() => {
    resetFlow();
  });

  it('依存ゼロのカラム → highlightPath が null のまま変化しない', () => {
    const tbl = makeTable('solo');
    tbl.columns.set('no_dep', {
      columnName: 'no_dep', tableId: 'solo', certainty: 'confirmed',
      dependencies: [],
      isFromStar: false, exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('solo', tbl);

    useLineageStore.setState({ tables });
    useFlowStore.getState().syncFromLineage(tables);

    expect(useFlowStore.getState().highlightPath).toBeNull();
    useFlowStore.getState().highlightLineage('solo', 'no_dep');
    expect(useFlowStore.getState().highlightPath).toBeNull();
  });

  it('依存ゼロ → エッジが isDimmed=false のまま', () => {
    const tbl1 = makeTable('tA');
    const tbl2 = makeTable('tB');
    tbl2.dependsOn = new Set(['tA']);
    tbl2.columns.set('no_dep', {
      columnName: 'no_dep', tableId: 'tB', certainty: 'confirmed',
      dependencies: [],
      isFromStar: false, exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('tA', tbl1);
    tables.set('tB', tbl2);

    useLineageStore.setState({ tables });
    useFlowStore.getState().syncFromLineage(tables);

    const beforeEdges = useFlowStore.getState().edges;
    expect(beforeEdges.length).toBeGreaterThan(0);

    useFlowStore.getState().highlightLineage('tB', 'no_dep');

    const afterEdges = useFlowStore.getState().edges;
    for (const edge of afterEdges) {
      const data = edge.data as Record<string, unknown>;
      expect(data.isDimmed === false || data.isDimmed === undefined).toBe(true);
      expect(data.isHighlighted).toBe(false);
    }
  });
});

// ===================================================
// clearHighlight
// ===================================================

describe('clearHighlight', () => {
  beforeEach(() => {
    resetFlow();
  });

  it('highlightPath が null になる', () => {
    const tbl = makeTable('clear_test');
    tbl.columns.set('c', {
      columnName: 'c', tableId: 'clear_test', certainty: 'confirmed',
      dependencies: [], isFromStar: false, exprType: 'column_ref',
    });
    const tbl2 = makeTable('clear_dst');
    tbl2.columns.set('d', {
      columnName: 'd', tableId: 'clear_dst', certainty: 'confirmed',
      dependencies: [{ sourceTableId: 'clear_test', sourceColumn: 'c', type: 'direct' }],
      isFromStar: false, exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('clear_test', tbl);
    tables.set('clear_dst', tbl2);

    useLineageStore.setState({ tables });
    useFlowStore.getState().syncFromLineage(tables);
    useFlowStore.getState().highlightLineage('clear_dst', 'd');

    expect(useFlowStore.getState().highlightPath).not.toBeNull();

    useFlowStore.getState().clearHighlight();

    expect(useFlowStore.getState().highlightPath).toBeNull();
  });

  it('全エッジの isHighlighted=false, isDimmed=false になる', () => {
    const srcTbl = makeTable('src_clear');
    srcTbl.columns.set('x', {
      columnName: 'x', tableId: 'src_clear', certainty: 'confirmed',
      dependencies: [], isFromStar: false, exprType: 'column_ref',
    });
    const dstTbl = makeTable('dst_clear');
    dstTbl.dependsOn = new Set(['src_clear']);
    dstTbl.columns.set('y', {
      columnName: 'y', tableId: 'dst_clear', certainty: 'confirmed',
      dependencies: [{ sourceTableId: 'src_clear', sourceColumn: 'x', type: 'direct' }],
      isFromStar: false, exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('src_clear', srcTbl);
    tables.set('dst_clear', dstTbl);

    useLineageStore.setState({ tables });
    useFlowStore.getState().syncFromLineage(tables);
    useFlowStore.getState().highlightLineage('dst_clear', 'y');

    const hasHighlightedEdge = useFlowStore.getState().edges.some(
      (e) => (e.data as Record<string, unknown>).isHighlighted === true
    );
    expect(hasHighlightedEdge).toBe(true);

    useFlowStore.getState().clearHighlight();

    const afterEdges = useFlowStore.getState().edges;
    for (const edge of afterEdges) {
      const data = edge.data as Record<string, unknown>;
      expect(data.isHighlighted).toBe(false);
      expect(data.isDimmed === false || data.isDimmed === undefined).toBe(true);
    }
  });

  it('既に null の状態で呼び出してもエラーにならない（冪等性）', () => {
    expect(useFlowStore.getState().highlightPath).toBeNull();
    expect(() => useFlowStore.getState().clearHighlight()).not.toThrow();
    expect(useFlowStore.getState().highlightPath).toBeNull();
  });
});

// ===================================================
// 多段リネージュ
// ===================================================

describe('highlightLineage (多段リネージュ)', () => {
  beforeEach(() => {
    resetFlow();
  });

  it('多段依存 (A→B→C) の場合、上流エッジすべてがハイライトされる', () => {
    const tblA = makeTable('A');
    tblA.columns.set('a_col', {
      columnName: 'a_col', tableId: 'A', certainty: 'confirmed',
      dependencies: [], isFromStar: false, exprType: 'column_ref',
    });

    const tblB = makeTable('B');
    tblB.columns.set('b_col', {
      columnName: 'b_col', tableId: 'B', certainty: 'confirmed',
      dependencies: [{ sourceTableId: 'A', sourceColumn: 'a_col', type: 'direct' }],
      isFromStar: false, exprType: 'column_ref',
    });

    const tblC = makeTable('C');
    tblC.columns.set('c_col', {
      columnName: 'c_col', tableId: 'C', certainty: 'confirmed',
      dependencies: [{ sourceTableId: 'B', sourceColumn: 'b_col', type: 'direct' }],
      isFromStar: false, exprType: 'column_ref',
    });

    const tables = new Map<string, TableNode>();
    tables.set('A', tblA);
    tables.set('B', tblB);
    tables.set('C', tblC);

    useLineageStore.setState({ tables });
    useFlowStore.getState().syncFromLineage(tables);

    // C.c_col をハイライト → B→C エッジと A→B エッジの両方がハイライトされるべき
    useFlowStore.getState().highlightLineage('C', 'c_col');

    const edges = useFlowStore.getState().edges;
    const colEdges = edges.filter((e) => (e.data as Record<string, unknown>)?.dependencyType === 'column_lineage');
    expect(colEdges).toHaveLength(2);

    const allHighlighted = colEdges.every((e) => (e.data as Record<string, unknown>).isHighlighted === true);
    expect(allHighlighted).toBe(true);
  });
});
