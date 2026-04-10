"use client";

import { memo, useCallback } from 'react';
import { Handle, Position, NodeResizeControl, type NodeProps } from '@xyflow/react';
import type { QueryBoxNodeData } from '@/types/flow';
import { useFlowStore } from '@/stores/flowStore';
import styles from './QueryBoxNode.module.css';

/**
 * クエリ全体ノード — クエリ1つを表す最外殻ノード。
 *
 * 対応機能要件: F1-3 (可視化), F1-4 (compact/detail), F1-5 (CTAS), F1-6 (単純SELECT), F1-8 (CTE/サブクエリネスト)
 * 設計参照: doc/design/component-design.md セクション3.1
 *
 * タイトルルール:
 * - CTAS: targetTable の値（例: output_table）
 * - 単純SELECT: [問い合わせ] (F1-6)
 * - CTE: CTE名
 * - FROMサブクエリ: エイリアス名
 * - WHERE IN/EXISTS: [サブクエリ]
 *
 * isOmitted=true の場合: ネスト上限超過による省略メッセージを表示
 * compact表示: カラム名一覧を表示
 * detail表示: 子ノード（ClauseBoxNode群、ネストされたQueryBoxNode群）を内包
 */
function QueryBoxNodeComponent({ data, id }: NodeProps) {
  const nodeData = data as unknown as QueryBoxNodeData;
  const { title, queryType, displayMode, compactColumns, isOmitted, omitMessage } = nodeData;

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

  // isOmitted=true の場合は省略プレースホルダーを表示
  if (isOmitted) {
    return (
      <div className={`${styles.container} ${styles.omitted}`}>
        <Handle type="target" position={Position.Left} className={styles.handle} />
        <div className={styles.omittedBody}>
          <span className={styles.omittedMessage}>
            {omitMessage ?? '...（省略）'}
          </span>
        </div>
        <Handle type="source" position={Position.Right} className={styles.handle} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* bd-sql_viz_202604_2-eqv: 右下リサイズハンドル */}
      <NodeResizeControl
        minWidth={180}
        minHeight={60}
        position="bottom-right"
        style={{ background: 'transparent', border: 'none', padding: 0 }}
      >
        <div className={styles.resizeIcon}>⟋</div>
      </NodeResizeControl>
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
