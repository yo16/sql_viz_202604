/**
 * 未登録テーブル → 登録済みテーブル置換テスト (Beads: sql_viz_202604_2-uup.6)
 *
 * カバー要件:
 * 1. lineageStore レベル:
 *    - SELECT * FROM users JOIN orders で orders が isRegistered=false で登録される
 *    - orders を targetTable とする CTAS クエリを addQuery → orders が isRegistered=true に上書き
 *    - tables.get('orders').isRegistered === true を検証
 *
 * 2. flowStore レベル:
 *    - 最初の addQuery 後に syncFromLineage → orders ノードが 'unresolvedBox' であることを検証
 *    - 2 回目の addQuery 後に syncFromLineage → orders ノードが 'queryBox' に変わることを検証
 *    - エッジが再生成されていることを検証
 */

import { useFlowStore } from '../src/stores/flowStore';
import { useLineageStore } from '../src/stores/lineageStore';
import type { ParsedQuery } from '../src/types/api';

// ===================================================
// テストヘルパー
// ===================================================

/** flowStore を初期状態にリセットする */
function resetFlow(): void {
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
}

/** lineageStore を初期状態にリセットする */
function resetLineage(): void {
  useLineageStore.getState().resetAll();
}

/** 両ストアをリセットする */
function resetAll(): void {
  resetFlow();
  resetLineage();
}

/** ParsedQuery を最小限のフィールドで生成するヘルパー */
function makePQ(overrides: Partial<ParsedQuery> = {}): ParsedQuery {
  return {
    queryId: 'q1',
    rawSql: 'SELECT 1',
    targetTable: null,
    queryType: 'select',
    select: { columns: [] },
    from: { tables: [], joins: [], subqueries: [] },
    where: null,
    groupBy: null,
    having: null,
    orderBy: null,
    ctes: [],
    ...overrides,
  };
}

// ===================================================
// lineageStore レベル: 未登録テーブルの置換
// ===================================================

describe('lineageStore: 未登録テーブル → 登録済みテーブル置換', () => {
  beforeEach(() => {
    resetAll();
  });

  it('JOIN テーブルは最初 isRegistered=false で登録される', () => {
    // Arrange: users を FROM、orders を JOIN するクエリ
    const q1 = makePQ({
      queryId: 'q1',
      targetTable: 'result',
      queryType: 'ctas',
      select: {
        columns: [
          {
            displayName: 'user_id',
            sourceTable: 'u',
            sourceColumn: 'id',
            exprType: 'column_ref',
            columnRefs: [{ table: 'u', column: 'id' }],
            starSourceTable: null,
          },
        ],
      },
      from: {
        tables: [{ name: 'users', alias: 'u' }],
        joins: [
          {
            joinType: 'LEFT',
            table: 'orders',
            alias: 'o',
            onConditionRefs: [
              { table: 'u', column: 'id' },
              { table: 'o', column: 'user_id' },
            ],
            onConditionText: 'u.id = o.user_id',
          },
        ],
        subqueries: [],
      },
    });

    // Act
    useLineageStore.getState().addQuery(q1);

    // Assert: orders は未登録として登録される
    const state = useLineageStore.getState();
    expect(state.tables.has('orders')).toBe(true);
    expect(state.tables.get('orders')!.isRegistered).toBe(false);
  });

  it('orders を targetTable とする CTAS を addQuery すると isRegistered=true に上書きされる', () => {
    // Arrange: 最初のクエリで orders を未登録として参照
    const q1 = makePQ({
      queryId: 'q1',
      targetTable: 'result',
      queryType: 'ctas',
      select: {
        columns: [
          {
            displayName: 'user_id',
            sourceTable: 'u',
            sourceColumn: 'id',
            exprType: 'column_ref',
            columnRefs: [{ table: 'u', column: 'id' }],
            starSourceTable: null,
          },
        ],
      },
      from: {
        tables: [{ name: 'users', alias: 'u' }],
        joins: [
          {
            joinType: 'LEFT',
            table: 'orders',
            alias: 'o',
            onConditionRefs: [
              { table: 'u', column: 'id' },
              { table: 'o', column: 'user_id' },
            ],
            onConditionText: 'u.id = o.user_id',
          },
        ],
        subqueries: [],
      },
    });

    // 2 つ目のクエリ: orders を CTAS の targetTable として登録
    const q2 = makePQ({
      queryId: 'q2',
      targetTable: 'orders',
      queryType: 'ctas',
      select: {
        columns: [
          {
            displayName: 'user_id',
            sourceTable: 'r',
            sourceColumn: 'user_id',
            exprType: 'column_ref',
            columnRefs: [{ table: 'r', column: 'user_id' }],
            starSourceTable: null,
          },
          {
            displayName: 'amount',
            sourceTable: 'r',
            sourceColumn: 'amount',
            exprType: 'column_ref',
            columnRefs: [{ table: 'r', column: 'amount' }],
            starSourceTable: null,
          },
        ],
      },
      from: {
        tables: [{ name: 'raw_orders', alias: 'r' }],
        joins: [],
        subqueries: [],
      },
    });

    // Act: 順序通りに addQuery
    useLineageStore.getState().addQuery(q1);
    useLineageStore.getState().addQuery(q2);

    // Assert: orders が登録済みに変わっている
    const state = useLineageStore.getState();
    expect(state.tables.has('orders')).toBe(true);
    expect(state.tables.get('orders')!.isRegistered).toBe(true);
  });

  it('置換後の orders ノードはカラムを持つ（未登録の推定カラムではなく CTAS 由来のカラム）', () => {
    const q1 = makePQ({
      queryId: 'q1',
      targetTable: 'result',
      queryType: 'ctas',
      select: {
        columns: [
          {
            displayName: 'user_id',
            sourceTable: 'u',
            sourceColumn: 'id',
            exprType: 'column_ref',
            columnRefs: [{ table: 'u', column: 'id' }],
            starSourceTable: null,
          },
        ],
      },
      from: {
        tables: [{ name: 'users', alias: 'u' }],
        joins: [
          {
            joinType: 'INNER',
            table: 'orders',
            alias: 'o',
            onConditionRefs: [
              { table: 'u', column: 'id' },
              { table: 'o', column: 'user_id' },
            ],
            onConditionText: 'u.id = o.user_id',
          },
        ],
        subqueries: [],
      },
    });

    const q2 = makePQ({
      queryId: 'q2',
      targetTable: 'orders',
      queryType: 'ctas',
      select: {
        columns: [
          {
            displayName: 'user_id',
            sourceTable: 'r',
            sourceColumn: 'user_id',
            exprType: 'column_ref',
            columnRefs: [{ table: 'r', column: 'user_id' }],
            starSourceTable: null,
          },
          {
            displayName: 'amount',
            sourceTable: 'r',
            sourceColumn: 'amount',
            exprType: 'column_ref',
            columnRefs: [{ table: 'r', column: 'amount' }],
            starSourceTable: null,
          },
        ],
      },
      from: {
        tables: [{ name: 'raw_orders', alias: 'r' }],
        joins: [],
        subqueries: [],
      },
    });

    useLineageStore.getState().addQuery(q1);
    useLineageStore.getState().addQuery(q2);

    const orders = useLineageStore.getState().tables.get('orders')!;
    // CTAS で SELECT した user_id と amount が登録される
    expect(orders.columns.has('user_id')).toBe(true);
    expect(orders.columns.has('amount')).toBe(true);
  });

  it('逆順（orders のCTASが先）でも最終的に isRegistered=true になる', () => {
    // Arrange: orders の CTAS を先に addQuery
    const q2 = makePQ({
      queryId: 'q2',
      targetTable: 'orders',
      queryType: 'ctas',
      select: {
        columns: [
          {
            displayName: 'user_id',
            sourceTable: 'r',
            sourceColumn: 'user_id',
            exprType: 'column_ref',
            columnRefs: [{ table: 'r', column: 'user_id' }],
            starSourceTable: null,
          },
        ],
      },
      from: {
        tables: [{ name: 'raw_orders', alias: 'r' }],
        joins: [],
        subqueries: [],
      },
    });

    // orders を JOIN 参照するクエリを後から addQuery
    const q1 = makePQ({
      queryId: 'q1',
      targetTable: 'result',
      queryType: 'ctas',
      select: {
        columns: [
          {
            displayName: 'user_id',
            sourceTable: 'u',
            sourceColumn: 'id',
            exprType: 'column_ref',
            columnRefs: [{ table: 'u', column: 'id' }],
            starSourceTable: null,
          },
        ],
      },
      from: {
        tables: [{ name: 'users', alias: 'u' }],
        joins: [
          {
            joinType: 'LEFT',
            table: 'orders',
            alias: 'o',
            onConditionRefs: [
              { table: 'u', column: 'id' },
              { table: 'o', column: 'user_id' },
            ],
            onConditionText: 'u.id = o.user_id',
          },
        ],
        subqueries: [],
      },
    });

    useLineageStore.getState().addQuery(q2);
    useLineageStore.getState().addQuery(q1);

    const state = useLineageStore.getState();
    expect(state.tables.get('orders')!.isRegistered).toBe(true);
  });
});

// ===================================================
// flowStore レベル: unresolvedBox → queryBox 置換
// ===================================================

describe('flowStore: syncFromLineage で unresolvedBox → queryBox 置換', () => {
  beforeEach(() => {
    resetAll();
  });

  it('最初の addQuery 後の syncFromLineage では orders ノードが unresolvedBox になる', () => {
    // Arrange
    const q1 = makePQ({
      queryId: 'q1',
      targetTable: 'result',
      queryType: 'ctas',
      select: {
        columns: [
          {
            displayName: 'user_id',
            sourceTable: 'u',
            sourceColumn: 'id',
            exprType: 'column_ref',
            columnRefs: [{ table: 'u', column: 'id' }],
            starSourceTable: null,
          },
        ],
      },
      from: {
        tables: [{ name: 'users', alias: 'u' }],
        joins: [
          {
            joinType: 'LEFT',
            table: 'orders',
            alias: 'o',
            onConditionRefs: [
              { table: 'u', column: 'id' },
              { table: 'o', column: 'user_id' },
            ],
            onConditionText: 'u.id = o.user_id',
          },
        ],
        subqueries: [],
      },
    });

    // Act: q1 を addQuery → syncFromLineage
    useLineageStore.getState().addQuery(q1);
    const tables = useLineageStore.getState().tables;
    useFlowStore.getState().syncFromLineage(tables);

    // Assert: orders ノードが unresolvedBox として生成されている
    const nodes = useFlowStore.getState().nodes;
    const ordersNode = nodes.find((n) => n.id === 'orders');
    expect(ordersNode).toBeDefined();
    expect(ordersNode!.type).toBe('unresolvedBox');
  });

  it('2 回目の addQuery（orders CTAS）後の syncFromLineage では orders ノードが queryBox になる', () => {
    // Arrange: 1 回目のクエリ（orders を JOIN 参照）
    const q1 = makePQ({
      queryId: 'q1',
      targetTable: 'result',
      queryType: 'ctas',
      select: {
        columns: [
          {
            displayName: 'user_id',
            sourceTable: 'u',
            sourceColumn: 'id',
            exprType: 'column_ref',
            columnRefs: [{ table: 'u', column: 'id' }],
            starSourceTable: null,
          },
        ],
      },
      from: {
        tables: [{ name: 'users', alias: 'u' }],
        joins: [
          {
            joinType: 'LEFT',
            table: 'orders',
            alias: 'o',
            onConditionRefs: [
              { table: 'u', column: 'id' },
              { table: 'o', column: 'user_id' },
            ],
            onConditionText: 'u.id = o.user_id',
          },
        ],
        subqueries: [],
      },
    });

    // 2 回目のクエリ（orders を CTAS で登録）
    const q2 = makePQ({
      queryId: 'q2',
      targetTable: 'orders',
      queryType: 'ctas',
      select: {
        columns: [
          {
            displayName: 'user_id',
            sourceTable: 'r',
            sourceColumn: 'user_id',
            exprType: 'column_ref',
            columnRefs: [{ table: 'r', column: 'user_id' }],
            starSourceTable: null,
          },
          {
            displayName: 'amount',
            sourceTable: 'r',
            sourceColumn: 'amount',
            exprType: 'column_ref',
            columnRefs: [{ table: 'r', column: 'amount' }],
            starSourceTable: null,
          },
        ],
      },
      from: {
        tables: [{ name: 'raw_orders', alias: 'r' }],
        joins: [],
        subqueries: [],
      },
    });

    // Act: q1 → 初回 sync（unresolvedBox を確認）→ q2 → 再 sync（queryBox を確認）
    useLineageStore.getState().addQuery(q1);
    const tablesAfterQ1 = useLineageStore.getState().tables;
    useFlowStore.getState().syncFromLineage(tablesAfterQ1);

    // 初回: unresolvedBox
    const nodesAfterQ1 = useFlowStore.getState().nodes;
    const ordersAfterQ1 = nodesAfterQ1.find((n) => n.id === 'orders');
    expect(ordersAfterQ1).toBeDefined();
    expect(ordersAfterQ1!.type).toBe('unresolvedBox');

    useLineageStore.getState().addQuery(q2);
    const tablesAfterQ2 = useLineageStore.getState().tables;
    useFlowStore.getState().syncFromLineage(tablesAfterQ2);

    // 2 回目: queryBox に変わっている
    const nodesAfterQ2 = useFlowStore.getState().nodes;
    const ordersAfterQ2 = nodesAfterQ2.find((n) => n.id === 'orders');
    expect(ordersAfterQ2).toBeDefined();
    expect(ordersAfterQ2!.type).toBe('queryBox');
  });

  it('2 回目の syncFromLineage 後にエッジが再生成されている', () => {
    // Arrange: q1（result ← users JOIN orders）と q2（orders ← raw_orders）
    const q1 = makePQ({
      queryId: 'q1',
      targetTable: 'result',
      queryType: 'ctas',
      select: {
        columns: [
          {
            displayName: 'user_id',
            sourceTable: 'u',
            sourceColumn: 'id',
            exprType: 'column_ref',
            columnRefs: [{ table: 'u', column: 'id' }],
            starSourceTable: null,
          },
        ],
      },
      from: {
        tables: [{ name: 'users', alias: 'u' }],
        joins: [
          {
            joinType: 'LEFT',
            table: 'orders',
            alias: 'o',
            onConditionRefs: [
              { table: 'u', column: 'id' },
              { table: 'o', column: 'user_id' },
            ],
            onConditionText: 'u.id = o.user_id',
          },
        ],
        subqueries: [],
      },
    });

    const q2 = makePQ({
      queryId: 'q2',
      targetTable: 'orders',
      queryType: 'ctas',
      select: {
        columns: [
          {
            displayName: 'user_id',
            sourceTable: 'r',
            sourceColumn: 'user_id',
            exprType: 'column_ref',
            columnRefs: [{ table: 'r', column: 'user_id' }],
            starSourceTable: null,
          },
        ],
      },
      from: {
        tables: [{ name: 'raw_orders', alias: 'r' }],
        joins: [],
        subqueries: [],
      },
    });

    // Act
    useLineageStore.getState().addQuery(q1);
    useLineageStore.getState().addQuery(q2);
    const tables = useLineageStore.getState().tables;
    useFlowStore.getState().syncFromLineage(tables);

    const edges = useFlowStore.getState().edges;

    // Assert: エッジが存在する（table_dependency エッジが少なくとも 1 本）
    expect(edges.length).toBeGreaterThan(0);

    // orders → result の table_dependency エッジが存在する
    const ordersToResultEdge = edges.find(
      (e) =>
        e.source === 'orders' &&
        e.target === 'result' &&
        (e.data as Record<string, unknown>)?.dependencyType === 'table_dependency'
    );
    expect(ordersToResultEdge).toBeDefined();

    // raw_orders → orders の table_dependency エッジが存在する
    const rawToOrdersEdge = edges.find(
      (e) =>
        e.source === 'raw_orders' &&
        e.target === 'orders' &&
        (e.data as Record<string, unknown>)?.dependencyType === 'table_dependency'
    );
    expect(rawToOrdersEdge).toBeDefined();
  });

  it('置換後の queryBox ノードは queryBox 以外のタイプを持たない', () => {
    // Arrange
    const q1 = makePQ({
      queryId: 'q1',
      targetTable: 'result',
      queryType: 'ctas',
      select: {
        columns: [
          {
            displayName: 'id',
            sourceTable: 'u',
            sourceColumn: 'id',
            exprType: 'column_ref',
            columnRefs: [{ table: 'u', column: 'id' }],
            starSourceTable: null,
          },
        ],
      },
      from: {
        tables: [{ name: 'users', alias: 'u' }],
        joins: [
          {
            joinType: 'INNER',
            table: 'orders',
            alias: 'o',
            onConditionRefs: [
              { table: 'u', column: 'id' },
              { table: 'o', column: 'user_id' },
            ],
            onConditionText: 'u.id = o.user_id',
          },
        ],
        subqueries: [],
      },
    });

    const q2 = makePQ({
      queryId: 'q2',
      targetTable: 'orders',
      queryType: 'ctas',
      select: {
        columns: [
          {
            displayName: 'user_id',
            sourceTable: 'r',
            sourceColumn: 'user_id',
            exprType: 'column_ref',
            columnRefs: [{ table: 'r', column: 'user_id' }],
            starSourceTable: null,
          },
        ],
      },
      from: {
        tables: [{ name: 'raw_orders', alias: 'r' }],
        joins: [],
        subqueries: [],
      },
    });

    // Act
    useLineageStore.getState().addQuery(q1);
    useLineageStore.getState().addQuery(q2);
    const tables = useLineageStore.getState().tables;
    useFlowStore.getState().syncFromLineage(tables);

    const nodes = useFlowStore.getState().nodes;

    // Assert: unresolvedBox ノードが残っていないこと（orders は queryBox に変わった）
    const unresolvedNodes = nodes.filter((n) => n.type === 'unresolvedBox');
    const ordersUnresolved = unresolvedNodes.find((n) => n.id === 'orders');
    expect(ordersUnresolved).toBeUndefined();

    // orders ノードは queryBox
    const ordersNode = nodes.find((n) => n.id === 'orders');
    expect(ordersNode).toBeDefined();
    expect(ordersNode!.type).toBe('queryBox');
  });
});
