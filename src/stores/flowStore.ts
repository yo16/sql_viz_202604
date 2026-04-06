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
    // 完全な実装はコンポーネント実装タスク（FlowCanvas等）で行う。
    // ここではストアのインターフェースとして基本的な変換を提供する。

    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const state = get();
    const displayModes = new Map(state.displayModes);

    for (const [tableId, table] of tables) {
      // 各テーブルにデフォルトの displayMode を設定（未設定の場合）
      if (!displayModes.has(tableId)) {
        displayModes.set(tableId, 'detail');
      }

      // テーブルノードを生成（QueryBoxNode or UnresolvedBoxNode 相当）
      const dm = displayModes.get(tableId) ?? 'detail';

      if (table.isRegistered && table.queryType !== 'unresolved') {
        const data: QueryBoxNodeData & Record<string, unknown> = {
          tableName: table.name ?? tableId,
          title: table.displayTitle,
          queryType: table.queryType,
          displayMode: dm,
          compactColumns: Array.from(table.columns.keys()),
          isRegistered: true,
        };
        nodes.push({
          id: tableId,
          type: 'queryBox',
          position: { x: 0, y: 0 },
          data,
        });
      } else {
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
      for (const depTableId of table.dependsOn) {
        if (tables.has(depTableId)) {
          edges.push({
            id: `edge-${depTableId}-${tableId}`,
            source: depTableId,
            target: tableId,
          });
        }
      }
    }

    set({ nodes, edges, displayModes });
  },

  toggleDisplayMode: (tableId: string) => {
    const state = get();
    const displayModes = new Map(state.displayModes);
    const current = displayModes.get(tableId) ?? 'detail';
    const next: DisplayMode = current === 'detail' ? 'compact' : 'detail';
    displayModes.set(tableId, next);

    // ノードのdisplayModeを更新
    const nodes = state.nodes.map((node) => {
      if (node.id === tableId) {
        return {
          ...node,
          data: { ...node.data, displayMode: next },
        };
      }
      return node;
    });

    set({ nodes, displayModes });
  },

  highlightLineage: (tableId: string, columnName: string) => {
    set({ highlightPath: { tableId, columnName } });
  },

  clearHighlight: () => {
    set({ highlightPath: null });
  },
}));
