import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { TableNode } from '@/types/lineage';
import type {
  FlowNode,
  FlowEdge,
  FlowState,
  FlowActions,
  FlowStore,
  DisplayMode,
  QueryBoxNodeData,
  UnresolvedBoxNodeData,
  ClauseBoxNodeData,
  ColumnItemNodeData,
  LineageEdgeData,
} from '@/types/flow';
import { recalculateLayout } from '@/layout/recalculateLayout';
import { arrangeTableNodes } from '@/layout/tableFlowLayout';
import { LAYOUT } from '@/layout/layoutConstants';
import { useLineageStore } from '@/stores/lineageStore';

/**
 * 指定ノードの全子孫IDを再帰的に収集する。
 * React Flow の parentId 関係を辿って親→子の依存を見つける。
 */
function collectDescendantIds(nodes: Node[], rootId: string): Set<string> {
  const descendants = new Set<string>();

  // 親ID → 子IDリストのマップを構築
  const childrenMap = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.parentId) {
      const list = childrenMap.get(node.parentId) ?? [];
      list.push(node.id);
      childrenMap.set(node.parentId, list);
    }
  }

  // BFSで子孫を収集
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const children = childrenMap.get(id) ?? [];
    for (const childId of children) {
      if (!descendants.has(childId)) {
        descendants.add(childId);
        queue.push(childId);
      }
    }
  }

  return descendants;
}

/**
 * ノード配列を親→子の順序にソートする。
 * React Flow v12 の要件: parentId を持つノードは親より後に配置する必要がある。
 * 設計参照: doc/design/layout-engine.md セクション9
 */
function sortNodesParentFirst(nodes: FlowNode[]): FlowNode[] {
  const result: FlowNode[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();

  function visit(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return;

    // 親が先
    if (node.parentId && !visited.has(node.parentId)) {
      visit(node.parentId);
    }

    result.push(node);
  }

  for (const node of nodes) {
    visit(node.id);
  }

  return result;
}

/**
 * table_dependency エッジの実際の target ノード ID を計算する
 * (bd-sql_viz_202604_2-q8n)。
 *
 * - 該当 QueryBox に `__clause__FROM` 子ノードがあり hidden でなければ
 *   FROM clauseBox の id を返す
 * - それ以外（compact モード等）は targetTableId をそのまま返す
 */
function computeTableDependencyTarget(
  targetTableId: string,
  nodes: FlowNode[]
): string {
  const fromClauseId = `${targetTableId}__clause__FROM`;
  const fromClause = nodes.find((n) => n.id === fromClauseId);
  if (fromClause && !fromClause.hidden) {
    return fromClauseId;
  }
  return targetTableId;
}

/**
 * 全 table_dependency エッジを現在のノード状態に応じて再ターゲットする
 * (bd-sql_viz_202604_2-q8n)。
 */
function retargetTableDependencyEdges(edges: FlowEdge[], nodes: FlowNode[]): FlowEdge[] {
  return edges.map((edge) => {
    const data = edge.data as LineageEdgeData | undefined;
    if (data?.dependencyType !== 'table_dependency') return edge;
    const targetTableId = data.targetTableId;
    if (!targetTableId) return edge;
    const newTarget = computeTableDependencyTarget(targetTableId, nodes);
    if (edge.target === newTarget) return edge;
    return { ...edge, target: newTarget };
  });
}

/**
 * ClauseBoxNode を縦展開した時の高さを概算する (bd-sql_viz_202604_2-oi5)。
 * label の文字数と clauseBox 幅から折り返し行数を見積もる。
 *
 * 概算式:
 *   chars per line ≒ floor((width - inner padding) / char width)
 *                  ≒ floor((150 - 16) / 7) ≒ 19
 *   height = HEADER + ceil(label.length / chars_per_line) * line_height + body padding
 */
function computeExpandedClauseHeight(label: string): number {
  if (!label) return LAYOUT.CLAUSE_HEADER_HEIGHT;
  const charsPerLine = 19;
  const lineHeight = 16;
  const bodyPadding = 12;
  const lines = Math.max(1, Math.ceil(label.length / charsPerLine));
  return LAYOUT.CLAUSE_HEADER_HEIGHT + lines * lineHeight + bodyPadding;
}

/**
 * 句 clauseBox 共通生成ヘルパー（ヘッダのみ、子カラムなし）。
 * 横並びレイアウト対応 (bd-sql_viz_202604_2-q82)。
 *
 * @returns 生成した clauseBox の幅。生成しなかった場合は 0。
 */
function pushSimpleClauseNode(
  clauseId: string,
  clauseType: ClauseBoxNodeData['clauseType'],
  label: string,
  clauseParentId: string,
  position: { x: number; y: number },
  nodes: FlowNode[]
): number {
  const clauseData: ClauseBoxNodeData & Record<string, unknown> = {
    clauseType,
    label,
  };
  nodes.push({
    id: clauseId,
    type: 'clauseBox',
    position,
    data: clauseData,
    parentId: clauseParentId,
    extent: 'parent',
    draggable: false,
    width: LAYOUT.QUERY_BOX_MIN_WIDTH,
    height: LAYOUT.CLAUSE_HEADER_HEIGHT,
  } as FlowNode);
  return LAYOUT.QUERY_BOX_MIN_WIDTH;
}

/**
 * TableNode の SELECT句カラムから ClauseBoxNode + ColumnItemNode を生成する。
 * 設計参照: doc/design/component-design.md セクション3.2, 3.3
 *
 * 横並びレイアウトのため、引数は startX に変更 (bd-sql_viz_202604_2-q82)。
 *
 * @returns 生成した clauseBox の幅（ない場合は 0）
 */
function buildSelectClauseNodes(
  tableId: string,
  table: TableNode,
  clauseParentId: string,
  startX: number,
  startY: number,
  nodes: FlowNode[]
): number {
  const columns = Array.from(table.columns.values());
  if (columns.length === 0) return 0;

  const clauseId = `${tableId}__clause__SELECT`;
  const clauseHeaderH = LAYOUT.CLAUSE_HEADER_HEIGHT;
  const clauseData: ClauseBoxNodeData & Record<string, unknown> = {
    clauseType: 'SELECT',
    label: 'SELECT',
  };
  nodes.push({
    id: clauseId,
    type: 'clauseBox',
    position: { x: startX, y: startY },
    data: clauseData,
    parentId: clauseParentId,
    extent: 'parent',
    draggable: false,
    width: LAYOUT.QUERY_BOX_MIN_WIDTH,
    height: clauseHeaderH + columns.length * LAYOUT.COLUMN_ITEM_HEIGHT,
  } as FlowNode);

  // 各カラムを ColumnItemNode として ClauseBoxNode の子に配置
  columns.forEach((col, idx) => {
    const colNodeId = `${tableId}:${col.columnName}`;
    const colData: ColumnItemNodeData & Record<string, unknown> = {
      displayName: col.columnName,
      sourceTable: col.dependencies[0]?.sourceTableId ?? null,
      exprType: col.exprType,
      certainty: col.certainty,
      conditionText: null,
      isFromStar: col.isFromStar,
    };
    nodes.push({
      id: colNodeId,
      type: 'columnItem',
      position: { x: 0, y: clauseHeaderH + idx * LAYOUT.COLUMN_ITEM_HEIGHT },
      data: colData,
      parentId: clauseId,
      extent: 'parent',
      draggable: false,
      width: LAYOUT.QUERY_BOX_MIN_WIDTH,
      height: LAYOUT.COLUMN_ITEM_HEIGHT,
    } as FlowNode);
  });

  return LAYOUT.QUERY_BOX_MIN_WIDTH;
}

/**
 * FROM句 ClauseBoxNode を1件生成する。
 * @returns 生成した clauseBox の幅（ない場合は 0）
 */
function buildFromClauseNode(
  tableId: string,
  table: TableNode,
  clauseParentId: string,
  startX: number,
  startY: number,
  nodes: FlowNode[]
): number {
  const from = table.clauses.from;
  if (!from || from.tables.length === 0) return 0;

  const tableLabels = from.tables.map((t) =>
    t.alias ? `${t.name} ${t.alias}` : t.name
  );
  const joinLabels = from.joins.map((j) => {
    const aliasPart = j.alias ? ` ${j.alias}` : '';
    return `${j.joinType} JOIN ${j.table}${aliasPart} ON ${j.onConditionText}`;
  });
  const label = [tableLabels.join(', '), ...joinLabels].join(' ');

  return pushSimpleClauseNode(
    `${tableId}__clause__FROM`, 'FROM', label, clauseParentId, { x: startX, y: startY }, nodes
  );
}

/**
 * WHERE句 ClauseBoxNode を1件生成する。
 * @returns 生成した clauseBox の幅（ない場合は 0）
 */
function buildWhereClauseNode(
  tableId: string,
  table: TableNode,
  clauseParentId: string,
  startX: number,
  startY: number,
  nodes: FlowNode[]
): number {
  const where = table.clauses.where;
  if (!where) return 0;
  return pushSimpleClauseNode(
    `${tableId}__clause__WHERE`, 'WHERE', where.conditionText, clauseParentId, { x: startX, y: startY }, nodes
  );
}

/**
 * GROUP BY句 ClauseBoxNode を生成する (bd-sql_viz_202604_2-q82)。
 */
function buildGroupByClauseNode(
  tableId: string,
  table: TableNode,
  clauseParentId: string,
  startX: number,
  startY: number,
  nodes: FlowNode[]
): number {
  const gb = table.clauses.groupBy;
  if (!gb) return 0;
  return pushSimpleClauseNode(
    `${tableId}__clause__GROUP_BY`, 'GROUP BY', gb.expressionText, clauseParentId, { x: startX, y: startY }, nodes
  );
}

/**
 * HAVING句 ClauseBoxNode を生成する (bd-sql_viz_202604_2-q82)。
 */
function buildHavingClauseNode(
  tableId: string,
  table: TableNode,
  clauseParentId: string,
  startX: number,
  startY: number,
  nodes: FlowNode[]
): number {
  const h = table.clauses.having;
  if (!h) return 0;
  return pushSimpleClauseNode(
    `${tableId}__clause__HAVING`, 'HAVING', h.conditionText, clauseParentId, { x: startX, y: startY }, nodes
  );
}

/**
 * ORDER BY句 ClauseBoxNode を生成する (bd-sql_viz_202604_2-q82)。
 */
function buildOrderByClauseNode(
  tableId: string,
  table: TableNode,
  clauseParentId: string,
  startX: number,
  startY: number,
  nodes: FlowNode[]
): number {
  const ob = table.clauses.orderBy;
  if (!ob) return 0;
  return pushSimpleClauseNode(
    `${tableId}__clause__ORDER_BY`, 'ORDER BY', ob.expressionText, clauseParentId, { x: startX, y: startY }, nodes
  );
}

/**
 * 全 main clauseBox を実行順で横並び生成する (bd-sql_viz_202604_2-q82)。
 * 順序: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY
 */
function buildMainClauseNodes(
  tableId: string,
  table: TableNode,
  clauseParentId: string,
  startX: number,
  startY: number,
  nodes: FlowNode[]
): void {
  const builders: Array<typeof buildFromClauseNode> = [
    buildFromClauseNode,
    buildWhereClauseNode,
    buildGroupByClauseNode,
    buildHavingClauseNode,
    buildSelectClauseNodes,
    buildOrderByClauseNode,
  ];
  let x = startX;
  for (const builder of builders) {
    const w = builder(tableId, table, clauseParentId, x, startY, nodes);
    if (w > 0) x += w + LAYOUT.CHILD_GAP_HORIZONTAL;
  }
}

/**
 * TableNode から QueryBoxNode（子ノード）を再帰的に生成する。
 * CTE / FROM サブクエリ / WHERE サブクエリを親QueryBoxNode内にネスト表示する。
 * 設計参照: doc/design/layout-engine.md セクション8
 *
 * @param tableId - TableNode の ID
 * @param table - TableNode
 * @param parentId - 親ノードのID（ルートの場合は undefined）
 * @param nestDepth - 現在のネスト深さ（ルート = 0）
 * @param nodes - 生成したノードを追加するための配列（出力用）
 * @param displayModes - 各テーブルの表示モードマップ
 */
function buildQueryBoxNodes(
  tableId: string,
  table: TableNode,
  parentId: string | undefined,
  nestDepth: number,
  nodes: FlowNode[],
  displayModes: Map<string, DisplayMode>,
  deferredMainClauses: Array<{ tableId: string; table: TableNode }>,
  edges: FlowEdge[],
  edgeIdSet: Set<string>,
  globalTableIds: Set<string>
): void {
  // displayMode を設定（未設定の場合はデフォルト 'detail'）
  if (!displayModes.has(tableId)) {
    displayModes.set(tableId, 'detail');
  }
  const dm = displayModes.get(tableId) ?? 'detail';

  // ネスト上限超過の場合は省略プレースホルダーに
  const isOmitted = nestDepth >= LAYOUT.MAX_NEST_DEPTH;
  const data: QueryBoxNodeData & Record<string, unknown> = {
    tableName: table.name ?? tableId,
    title: table.displayTitle,
    queryType: table.queryType === 'ctas' ? 'ctas' : 'select',
    displayMode: dm,
    compactColumns: Array.from(table.columns.keys()),
    isRegistered: true,
    isOmitted,
    omitMessage: isOmitted ? `...（${nestDepth + 1}段目以降は省略）` : undefined,
    nestDepth,
  };

  const node: FlowNode = {
    id: tableId,
    type: 'queryBox',
    position: { x: 0, y: 0 },
    data,
    ...(parentId !== undefined ? { parentId, extent: 'parent' as const } : {}),
  };

  nodes.push(node);

  // 省略されている場合は子ノードを生成しない
  if (isOmitted) return;

  // ネスト子ノード（CTE / FROMサブクエリ / WHEREサブクエリ）を生成する。
  // 位置 (x,y) は仮で (0,0) のまま放置し、syncFromLineage の post-pass で
  // arrangeTableNodes により依存順に左→右配置する (bd-sql_viz_202604_2-47d)。
  //
  // ネスト子のエッジ生成 (bd-sql_viz_202604_2-ce2):
  // sibling 名 → nodeId のマップを作り、各子の dependsOn を解決してエッジを張る。
  // - sibling 参照 → sibling nodeId へエッジ
  // - グローバル tables 参照 → 外部テーブルからのエッジ
  const siblingNameToId = new Map<string, string>();
  for (const cte of table.ctes) {
    siblingNameToId.set(cte.name, `${tableId}__cte__${cte.name}`);
  }
  for (const sub of table.fromSubqueries) {
    siblingNameToId.set(sub.alias, `${tableId}__fromsub__${sub.alias}`);
  }
  for (const sub of table.whereSubqueries) {
    siblingNameToId.set(sub.alias, `${tableId}__wheresub__${sub.alias}`);
  }
  const addNestedEdges = (childNodeId: string, childTable: TableNode): void => {
    for (const depName of childTable.dependsOn) {
      let sourceId: string | undefined;
      if (siblingNameToId.has(depName)) {
        sourceId = siblingNameToId.get(depName);
      } else if (globalTableIds.has(depName)) {
        sourceId = depName;
      }
      if (!sourceId || sourceId === childNodeId) continue;
      const edgeId = `edge-${sourceId}-${childNodeId}`;
      if (edgeIdSet.has(edgeId)) continue;
      edgeIdSet.add(edgeId);
      edges.push({
        id: edgeId,
        source: sourceId,
        target: childNodeId,
        type: 'lineage',
        data: {
          dependencyType: 'table_dependency',
          isHighlighted: false,
          targetTableId: childNodeId,
        },
      });
    }
  };
  for (const cte of table.ctes) {
    const cteNodeId = `${tableId}__cte__${cte.name}`;
    buildQueryBoxNodes(
      cteNodeId, cte.tableNode, tableId, nestDepth + 1, nodes, displayModes, deferredMainClauses,
      edges, edgeIdSet, globalTableIds
    );
    addNestedEdges(cteNodeId, cte.tableNode);
  }
  for (const sub of table.fromSubqueries) {
    const subNodeId = `${tableId}__fromsub__${sub.alias}`;
    buildQueryBoxNodes(
      subNodeId, sub.tableNode, tableId, nestDepth + 1, nodes, displayModes, deferredMainClauses,
      edges, edgeIdSet, globalTableIds
    );
    addNestedEdges(subNodeId, sub.tableNode);
  }
  for (const sub of table.whereSubqueries) {
    const subNodeId = `${tableId}__wheresub__${sub.alias}`;
    buildQueryBoxNodes(
      subNodeId, sub.tableNode, tableId, nestDepth + 1, nodes, displayModes, deferredMainClauses,
      edges, edgeIdSet, globalTableIds
    );
    addNestedEdges(subNodeId, sub.tableNode);
  }

  // detail モードの場合は main 句の ClauseBoxNode を実行順で横並びに生成する
  // 順序: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY
  // (bd-sql_viz_202604_2-q82)
  if (dm === 'detail') {
    const hasNested =
      table.ctes.length > 0 ||
      table.fromSubqueries.length > 0 ||
      table.whereSubqueries.length > 0;
    if (hasNested) {
      // ネスト子のサイズ確定後に位置決めするため遅延 (bd-sql_viz_202604_2-u8l)
      deferredMainClauses.push({ tableId, table });
    } else {
      // リーフクエリは即時生成
      buildMainClauseNodes(tableId, table, tableId, LAYOUT.PADDING_HORIZONTAL, LAYOUT.PADDING_TOP, nodes);
    }
  }
}

/**
 * flowStore — React Flow のノード/エッジと表示状態を管理。
 *
 * lineageStore の状態変更を受けて、TableNode マップから
 * React Flow のノード/エッジを生成する。
 *
 * 設計参照: doc/design/component-design.md セクション6.2
 *
 * lineageStore.subscribe による自動同期は、タスク 6k0.6
 * (ストア間連携 subscribe設定) で設定する。
 */
export const useFlowStore = create<FlowStore>((set, get) => ({
  nodes: [],
  edges: [],
  displayModes: new Map(),
  highlightPath: null,

  syncFromLineage: (tables: Map<string, TableNode>) => {
    // TableNode マップから React Flow ノード/エッジを生成する。
    // F1-8: CTE・FROMサブクエリ・WHERE IN/EXISTSサブクエリを親QueryBoxNode内にネスト表示する。
    // F2-2: 未登録テーブル（isRegistered=false）は unresolvedBox として、
    //        登録済みテーブル（isRegistered=true）は queryBox として生成する。
    //        lineageStore.addQuery で新クエリが追加され unresolved → registered に変わった場合、
    //        次の syncFromLineage 呼び出しで自動的に unresolvedBox → queryBox に置換される。

    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const edgeIdSet = new Set<string>();
    const state = get();
    const displayModes = new Map(state.displayModes);
    // CTE/サブクエリを持つ親クエリの main SELECT/FROM/WHERE clauseBox 生成は
    // 子ノードのサイズ確定後（recalculateLayout 後）に遅延実行する。
    const deferredMainClauses: Array<{ tableId: string; table: TableNode }> = [];

    // bd-sql_viz_202604_2-ce2: ネスト子のエッジ生成に使うグローバルテーブル ID 集合
    const globalTableIds = new Set(tables.keys());

    for (const [tableId, table] of tables) {
      if (table.isRegistered && table.queryType !== 'unresolved') {
        // F1-8: CTE/サブクエリを含む QueryBoxNode を再帰的に生成
        buildQueryBoxNodes(
          tableId, table, undefined, 0, nodes, displayModes, deferredMainClauses,
          edges, edgeIdSet, globalTableIds
        );
      } else {
        // 未登録テーブルは UnresolvedBoxNode
        if (!displayModes.has(tableId)) {
          displayModes.set(tableId, 'detail');
        }
        const dm = displayModes.get(tableId) ?? 'detail';
        const data: UnresolvedBoxNodeData & Record<string, unknown> = {
          tableName: table.name ?? tableId,
          inferredColumns: Array.from(table.columns.keys()),
          displayMode: dm,
        };
        nodes.push({
          id: tableId,
          type: 'unresolvedBox',
          position: { x: 0, y: 0 },
          data,
        });
      }

      // テーブル間のエッジを生成（dependsOn から）
      // 重複エッジ防止のため edgeIds Set で管理
      // bd-sql_viz_202604_2-q8n: targetTableId を保持し、target は post-pass で
      // FROM clauseBox にリダイレクトする
      for (const depTableId of table.dependsOn) {
        if (tables.has(depTableId)) {
          const edgeId = `edge-${depTableId}-${tableId}`;
          if (!edgeIdSet.has(edgeId)) {
            edgeIdSet.add(edgeId);
            edges.push({
              id: edgeId,
              source: depTableId,  // 上流
              target: tableId,     // 下流（後段で FROM clauseBox に再ターゲット）
              type: 'lineage',
              data: {
                dependencyType: 'table_dependency',
                isHighlighted: false,
                targetTableId: tableId,
              },
            });
          }
        }
      }

      // カラムレベルリネージュエッジを生成（各カラムの dependencies から）
      for (const [columnName, col] of table.columns) {
        for (const dep of col.dependencies) {
          if (tables.has(dep.sourceTableId)) {
            const colEdgeId = `col-edge-${dep.sourceTableId}-${tableId}-${dep.sourceColumn}-${columnName}`;
            if (!edgeIdSet.has(colEdgeId)) {
              edgeIdSet.add(colEdgeId);
              edges.push({
                id: colEdgeId,
                source: dep.sourceTableId,
                target: tableId,
                type: 'lineage',
                data: {
                  dependencyType: 'column_lineage',
                  isHighlighted: false,
                  isDimmed: false,
                },
              });
            }
          }
        }
      }
    }

    // React Flow v12 要件: 親ノードは子ノードより配列の前に配置する
    const sortedNodes = sortNodesParentFirst(nodes);
    // 1回目の recalculateLayout: ネスト子ノードのサイズを確定させる
    let recalculated = recalculateLayout(sortedNodes as Node[]) as FlowNode[];

    // 遅延されていた main clauseBox 群を生成する（bd-sql_viz_202604_2-u8l）。
    // ネスト子のサイズ確定後に位置決めするため deferred で処理する。
    // bd-sql_viz_202604_2-47d: ネスト子も依存順で arrangeTableNodes により再配置する。
    if (deferredMainClauses.length > 0) {
      for (const { tableId, table } of deferredMainClauses) {
        // 1. ネスト子（直下の queryBox）を集める
        const childNodes = recalculated.filter(
          (n) => n.parentId === tableId && n.type === 'queryBox'
        );

        // 2. ネスト子間の依存エッジを構築する (bd-47d)
        //    sibling-name → cteNodeId/subNodeId のマップを作る
        const siblingNameToId = new Map<string, string>();
        for (const cte of table.ctes) {
          siblingNameToId.set(cte.name, `${tableId}__cte__${cte.name}`);
        }
        for (const sub of table.fromSubqueries) {
          siblingNameToId.set(sub.alias, `${tableId}__fromsub__${sub.alias}`);
        }
        for (const sub of table.whereSubqueries) {
          siblingNameToId.set(sub.alias, `${tableId}__wheresub__${sub.alias}`);
        }
        // 各ネスト子の dependsOn から sibling 参照を抽出
        const siblingDeps: Array<{ source: string; target: string }> = [];
        const childIdToTableNode = new Map<string, TableNode>();
        for (const cte of table.ctes) {
          childIdToTableNode.set(`${tableId}__cte__${cte.name}`, cte.tableNode);
        }
        for (const sub of table.fromSubqueries) {
          childIdToTableNode.set(`${tableId}__fromsub__${sub.alias}`, sub.tableNode);
        }
        for (const sub of table.whereSubqueries) {
          childIdToTableNode.set(`${tableId}__wheresub__${sub.alias}`, sub.tableNode);
        }
        for (const [childId, childTable] of childIdToTableNode) {
          for (const depName of childTable.dependsOn) {
            const sourceId = siblingNameToId.get(depName);
            if (sourceId && sourceId !== childId) {
              siblingDeps.push({ source: sourceId, target: childId });
            }
          }
        }

        // 3. arrangeTableNodes で childNodes を依存順に左→右配置
        if (childNodes.length > 0) {
          arrangeTableNodes(childNodes as Node[], siblingDeps);
          // arrangeTableNodes は (0,0) 始点で配置するので親内パディング分オフセット
          for (const c of childNodes) {
            c.position = {
              x: c.position.x + LAYOUT.PADDING_HORIZONTAL,
              y: c.position.y + LAYOUT.PADDING_TOP,
            };
          }
        }

        // 4. ネスト子の最右端を算出し、main clauseBox を横並びでその右に配置
        //    (bd-sql_viz_202604_2-hk1: 下ではなく右に配置 — 実行順の左→右を守る)
        let mainX = LAYOUT.PADDING_HORIZONTAL;
        if (childNodes.length > 0) {
          const maxRight = Math.max(
            ...childNodes.map((n) => {
              const w = n.width ?? LAYOUT.QUERY_BOX_MIN_WIDTH;
              return n.position.x + w;
            })
          );
          mainX = maxRight + LAYOUT.CHILD_GAP_HORIZONTAL;
        }
        buildMainClauseNodes(tableId, table, tableId, mainX, LAYOUT.PADDING_TOP, recalculated);
      }
      // 2回目の recalculateLayout: ネスト子の再配置と main clauseBox を含めて親サイズ再計算
      const resortedNodes = sortNodesParentFirst(recalculated);
      recalculated = recalculateLayout(resortedNodes as Node[]) as FlowNode[];
    }

    // ルートレベルのテーブルノード（parentId を持たない）を依存関係に基づき左→右に配置
    // bd-sql_viz_202604_2-z0e: syncFromLineage から arrangeTableNodes を呼ぶ修正
    const rootNodes = recalculated.filter((n) => n.parentId === undefined);
    const nonRootNodes = recalculated.filter((n) => n.parentId !== undefined);
    const tableDependencies = edges
      .filter((e) => e.data?.dependencyType === 'table_dependency')
      .map((e) => ({ source: e.source, target: e.target }));
    const arrangedRoots = arrangeTableNodes(rootNodes as Node[], tableDependencies) as FlowNode[];
    const finalNodes = [...arrangedRoots, ...nonRootNodes];

    // bd-sql_viz_202604_2-q8n: table_dependency エッジを FROM clauseBox に再ターゲット
    const finalEdges = retargetTableDependencyEdges(edges, finalNodes);

    set({ nodes: finalNodes, edges: finalEdges, displayModes });
  },

  toggleDisplayMode: (tableId: string) => {
    const state = get();
    const displayModes = new Map(state.displayModes);
    const current = displayModes.get(tableId) ?? 'detail';
    const next: DisplayMode = current === 'detail' ? 'compact' : 'detail';
    displayModes.set(tableId, next);

    // 対象ノードの全子孫IDを再帰的に収集
    const descendantIds = collectDescendantIds(state.nodes, tableId);

    // ノードを更新:
    // - 対象ノード: displayMode を切替
    // - 子孫ノード: compact なら hidden=true, detail なら hidden=false
    const isNowCompact = next === 'compact';
    const updatedNodes = state.nodes.map((node) => {
      if (node.id === tableId) {
        return {
          ...node,
          data: { ...node.data, displayMode: next },
        };
      }
      if (descendantIds.has(node.id)) {
        return {
          ...node,
          hidden: isNowCompact,
        };
      }
      return node;
    });

    // recalculateLayout でボトムアップにサイズ再計算
    const recalculated = recalculateLayout(updatedNodes) as FlowNode[];

    // bd-sql_viz_202604_2-q8n: 表示モード変更後 table_dependency エッジを再ターゲット
    const retargetedEdges = retargetTableDependencyEdges(state.edges, recalculated);

    set({ nodes: recalculated as typeof state.nodes, edges: retargetedEdges, displayModes });
  },

  /**
   * ClauseBoxNode の縦展開をトグル (bd-sql_viz_202604_2-oi5)。
   * SELECT 句は ColumnItem 子を持つため対象外（no-op）。
   */
  toggleClauseExpand: (clauseId: string) => {
    const state = get();
    const target = state.nodes.find((n) => n.id === clauseId);
    if (!target || target.type !== 'clauseBox') return;
    const data = target.data as ClauseBoxNodeData;
    // SELECT 句は ColumnItem 子を持つため展開対象外
    if (data.clauseType === 'SELECT') return;

    const nextExpanded = !(data.expanded ?? false);
    const expandedHeight = computeExpandedClauseHeight(data.label);
    const collapsedHeight = LAYOUT.CLAUSE_HEADER_HEIGHT;
    const nextHeight = nextExpanded ? expandedHeight : collapsedHeight;

    const updatedNodes = state.nodes.map((n) => {
      if (n.id !== clauseId) return n;
      return {
        ...n,
        height: nextHeight,
        style: { ...n.style, height: nextHeight },
        data: { ...n.data, expanded: nextExpanded },
      };
    });

    // 親 QueryBox サイズを再計算
    const recalculated = recalculateLayout(updatedNodes);
    set({ nodes: recalculated as typeof state.nodes });
  },

  highlightLineage: (tableId: string, columnName: string) => {
    // リネージュパスを辿り、関連エッジを特定してハイライト/dim状態を更新する。
    // F2-3: カラムレベルリネージュ対応
    const state = get();
    const tables = useLineageStore.getState().tables;

    // ハイライト対象のエッジIDを収集する（上流方向へ再帰的に辿る）
    const highlightedEdgeIds = new Set<string>();

    function traceUpstream(currentTableId: string, currentColumn: string): void {
      const table = tables.get(currentTableId);
      if (!table) return;

      const col = table.columns.get(currentColumn);
      if (!col) return;

      for (const dep of col.dependencies) {
        const edgeId = `col-edge-${dep.sourceTableId}-${currentTableId}-${dep.sourceColumn}-${currentColumn}`;
        if (!highlightedEdgeIds.has(edgeId)) {
          highlightedEdgeIds.add(edgeId);
          traceUpstream(dep.sourceTableId, dep.sourceColumn);
        }
      }
    }

    traceUpstream(tableId, columnName);

    // ハイライト対象エッジが存在しない場合はhighlightPathを設定しない（ノード/エッジをdimさせない）
    if (highlightedEdgeIds.size === 0) {
      return;
    }

    // エッジを更新: ハイライト対象はisHighlighted=true、それ以外はisDimmed=true
    const hasHighlight = highlightedEdgeIds.size > 0;
    const updatedEdges = state.edges.map((edge) => {
      const edgeData = edge.data as { dependencyType: string; isHighlighted: boolean; isDimmed?: boolean } | undefined;
      const depType = edgeData?.dependencyType ?? 'table_dependency';

      if (depType === 'table_dependency') {
        // table_dependency エッジ: ハイライト発動中はdimにする
        return {
          ...edge,
          data: {
            ...edgeData,
            isHighlighted: false,
            isDimmed: hasHighlight,
          },
        };
      }

      // column_lineage エッジ: ハイライト対象ならisHighlighted=true
      const isHighlighted = highlightedEdgeIds.has(edge.id);
      return {
        ...edge,
        data: {
          ...edgeData,
          isHighlighted,
          isDimmed: hasHighlight && !isHighlighted,
        },
      };
    });

    set({ highlightPath: { tableId, columnName }, edges: updatedEdges });
  },

  clearHighlight: () => {
    const state = get();
    // 全エッジのハイライト/dim状態をリセット
    const updatedEdges = state.edges.map((edge) => {
      const edgeData = edge.data as { dependencyType: string; isHighlighted: boolean; isDimmed?: boolean } | undefined;
      return {
        ...edge,
        data: {
          ...edgeData,
          isHighlighted: false,
          isDimmed: false,
        },
      };
    });
    set({ highlightPath: null, edges: updatedEdges });
  },
}));
