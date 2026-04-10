"use client";

import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useFlowStore } from '@/stores/flowStore';
import { useLineageHighlight } from '@/hooks/useLineageHighlight';
import { QueryBoxNode } from './nodes/QueryBoxNode';
import { ClauseBoxNode } from './nodes/ClauseBoxNode';
import { ColumnItemNode } from './nodes/ColumnItemNode';
import { UnresolvedBoxNode } from './nodes/UnresolvedBoxNode';
import { LineageEdge } from './edges/LineageEdge';
import styles from './FlowCanvas.module.css';

const nodeTypes = {
  queryBox: QueryBoxNode,
  clauseBox: ClauseBoxNode,
  columnItem: ColumnItemNode,
  unresolvedBox: UnresolvedBoxNode,
};

const edgeTypes = {
  lineage: LineageEdge,
};

/**
 * React Flow メインキャンバスコンポーネント。
 *
 * 対応機能要件: F1-3 (単一クエリの可視化)
 * 設計参照: doc/design/component-design.md
 *
 * flowStore の nodes/edges を React Flow に渡す。
 * ドラッグ等のローカルな変更はローカルステートで管理し、
 * flowStore への書き戻しは行わない（単方向データフロー）。
 * flowStore が更新されるとローカルステートも同期される。
 * カスタムノードタイプは後続タスク (b0p.2〜b0p.5) で登録する。
 */
export function FlowCanvas() {
  const storeNodes = useFlowStore((s) => s.nodes);
  const storeEdges = useFlowStore((s) => s.edges);

  // ローカルステート: React Flow のインタラクション（ドラッグ等）を管理
  const [localNodes, setLocalNodes] = useState<Node[]>(storeNodes);
  const [localEdges, setLocalEdges] = useState<Edge[]>(storeEdges);

  // flowStore が更新されたらローカルステートを同期
  useEffect(() => {
    setLocalNodes(storeNodes);
  }, [storeNodes]);

  useEffect(() => {
    setLocalEdges(storeEdges);
  }, [storeEdges]);

  const { handleCanvasClick } = useLineageHighlight();
  const expandAll = useFlowStore((s) => s.expandAll);
  const compactAll = useFlowStore((s) => s.compactAll);
  const syncNodePosition = useFlowStore((s) => s.syncNodePosition);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setLocalNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        // リサイズ完了時にストアの位置も同期。
        // setLocalNodes コールバック内で Zustand set() を呼ぶと
        // "Cannot update a component while rendering" エラーになるため
        // queueMicrotask で遅延する。
        for (const c of changes) {
          if (c.type === 'dimensions' && c.dimensions && !c.resizing) {
            const node = updated.find((n) => n.id === c.id);
            if (node) {
              const { id, position } = node;
              const w = node.measured?.width ?? node.width;
              const h = node.measured?.height ?? node.height;
              const dims = (w !== undefined && h !== undefined) ? { width: w, height: h } : undefined;
              queueMicrotask(() => syncNodePosition(id, position, dims));
            }
          }
        }
        return updated;
      });
    },
    [syncNodePosition]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setLocalEdges((eds) => applyEdgeChanges(changes, eds));
    },
    []
  );

  // ドラッグ完了時にストアへ位置を同期。toggleDisplayMode 等で位置がリセットされるのを防ぐ。
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      syncNodePosition(node.id, node.position);
    },
    [syncNodePosition]
  );

  return (
    <div className={styles.container}>
      {/* bd-sql_viz_202604_2-f4z: 全部開く / 全部閉じるボタン */}
      <div className={styles.viewControls}>
        <button
          type="button"
          className={styles.viewButton}
          onClick={expandAll}
          aria-label="全部開く"
          title="全部開く"
        >
          全部開く
        </button>
        <button
          type="button"
          className={styles.viewButton}
          onClick={compactAll}
          aria-label="全部閉じる"
          title="全部閉じる"
        >
          全部閉じる
        </button>
      </div>
      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={handleCanvasClick}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}
