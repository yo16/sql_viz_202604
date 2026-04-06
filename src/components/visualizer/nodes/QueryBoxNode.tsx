"use client";

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { QueryBoxNodeData } from '@/types/flow';
import { useFlowStore } from '@/stores/flowStore';
import styles from './QueryBoxNode.module.css';

/**
 * クエリ全体ノード — クエリ1つを表す最外殻ノード。
 *
 * 対応機能要件: F1-3 (可視化), F1-4 (compact/detail), F1-5 (CTAS), F1-6 (単純SELECT)
 * 設計参照: doc/design/component-design.md セクション3.1
 *
 * タイトルルール:
 * - CTAS: targetTable の値（例: output_table）
 * - 単純SELECT: [問い合わせ] (F1-6)
 *
 * compact表示: カラム名一覧を表示
 * detail表示: 子ノード（ClauseBoxNode群）を内包（React Flow parentIdで管理）
 */
function QueryBoxNodeComponent({ data, id }: NodeProps) {
  const nodeData = data as unknown as QueryBoxNodeData;
  const { title, queryType, displayMode, compactColumns } = nodeData;

  const toggleDisplayMode = useFlowStore((s) => s.toggleDisplayMode);

  const handleToggle = useCallback(() => {
    toggleDisplayMode(id);
  }, [id, toggleDisplayMode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  }, [handleToggle]);

  return (
    <div className={styles.container}>
      <Handle type="target" position={Position.Left} className={styles.handle} />

      <div
        className={styles.titleBar}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        title={displayMode === 'compact' ? 'クリックで詳細表示' : 'クリックでコンパクト表示'}
      >
        <span className={styles.title}>{title}</span>
        <span className={styles.badge}>
          {queryType === 'ctas' ? 'CTAS' : 'SELECT'}
        </span>
        <span className={styles.toggleIcon}>
          {displayMode === 'compact' ? '▸' : '▾'}
        </span>
      </div>

      {displayMode === 'compact' && compactColumns.length > 0 && (
        <div className={styles.compactBody}>
          {compactColumns.slice(0, 10).map((col) => (
            <div key={col} className={styles.compactColumn}>{col}</div>
          ))}
          {compactColumns.length > 10 && (
            <div className={styles.compactMore}>
              +{compactColumns.length - 10} more
            </div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}

export const QueryBoxNode = memo(QueryBoxNodeComponent);
