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
import styles from './FlowCanvas.module.css';

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

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setLocalNodes((nds) => applyNodeChanges(changes, nds));
    },
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setLocalEdges((eds) => applyEdgeChanges(changes, eds));
    },
    []
  );

  const handleCanvasClick = useCallback(() => {
    useFlowStore.getState().clearHighlight();
  }, []);

  return (
    <div className={styles.container}>
      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
