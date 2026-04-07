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
} from '@/types/flow';
import { recalculateLayout } from '@/layout/recalculateLayout';
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
  displayModes: Map<string, DisplayMode>
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

  // CTE 子ノードを水平に配置（LEFT → RIGHT）
  let cteX = LAYOUT.PADDING_HORIZONTAL;
  const cteY = LAYOUT.PADDING_TOP;
  for (const cte of table.ctes) {
    const cteNodeId = `${tableId}__cte__${cte.name}`;
    buildQueryBoxNodes(
      cteNodeId,
      cte.tableNode,
      tableId,
      nestDepth + 1,
      nodes,
      displayModes
    );
    // 生成されたノードに位置を設定
    const cteNode = nodes.find((n) => n.id === cteNodeId);
    if (cteNode) {
      cteNode.position = { x: cteX, y: cteY };
      const cteWidth = cteNode.width ?? LAYOUT.QUERY_BOX_MIN_WIDTH;
      cteX += cteWidth + LAYOUT.CTE_GAP_HORIZONTAL;
    }
  }

  // FROM サブクエリ子ノードを垂直に配置
  let fromSubY = LAYOUT.PADDING_TOP;
  // CTE がある場合は CTE の下に配置
  if (table.ctes.length > 0) {
    fromSubY = LAYOUT.PADDING_TOP + LAYOUT.QUERY_BOX_MIN_HEIGHT + LAYOUT.CHILD_GAP_VERTICAL;
  }
  for (const sub of table.fromSubqueries) {
    const subNodeId = `${tableId}__fromsub__${sub.alias}`;
    buildQueryBoxNodes(
      subNodeId,
      sub.tableNode,
      tableId,
      nestDepth + 1,
      nodes,
      displayModes
    );
    const subNode = nodes.find((n) => n.id === subNodeId);
    if (subNode) {
      subNode.position = { x: LAYOUT.PADDING_HORIZONTAL, y: fromSubY };
      const subHeight = subNode.height ?? LAYOUT.QUERY_BOX_MIN_HEIGHT;
      fromSubY += subHeight + LAYOUT.CHILD_GAP_VERTICAL;
    }
  }

  // WHERE サブクエリ子ノードを垂直に配置（FROM サブクエリの下）
  let whereSubY = fromSubY;
  for (const sub of table.whereSubqueries) {
    const subNodeId = `${tableId}__wheresub__${sub.alias}`;
    buildQueryBoxNodes(
      subNodeId,
      sub.tableNode,
      tableId,
      nestDepth + 1,
      nodes,
      displayModes
    );
    const subNode = nodes.find((n) => n.id === subNodeId);
    if (subNode) {
      subNode.position = { x: LAYOUT.PADDING_HORIZONTAL, y: whereSubY };
      const subHeight = subNode.height ?? LAYOUT.QUERY_BOX_MIN_HEIGHT;
      whereSubY += subHeight + LAYOUT.CHILD_GAP_VERTICAL;
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

    for (const [tableId, table] of tables) {
      if (table.isRegistered && table.queryType !== 'unresolved') {
        // F1-8: CTE/サブクエリを含む QueryBoxNode を再帰的に生成
        buildQueryBoxNodes(tableId, table, undefined, 0, nodes, displayModes);
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
      for (const depTableId of table.dependsOn) {
        if (tables.has(depTableId)) {
          const edgeId = `edge-${depTableId}-${tableId}`;
          if (!edgeIdSet.has(edgeId)) {
            edgeIdSet.add(edgeId);
            edges.push({
              id: edgeId,
              source: depTableId,  // 上流
              target: tableId,     // 下流
              type: 'lineage',
              data: { dependencyType: 'table_dependency', isHighlighted: false },
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
    const recalculated = recalculateLayout(sortedNodes as Node[]);

    set({ nodes: recalculated as FlowNode[], edges, displayModes });
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
    const recalculated = recalculateLayout(updatedNodes);

    set({ nodes: recalculated as typeof state.nodes, displayModes });
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
