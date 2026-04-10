"use client";

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { UnresolvedBoxNodeData } from '@/types/flow';
import { useFlowStore } from '@/stores/flowStore';
import styles from './UnresolvedBoxNode.module.css';

/**
 * 未登録テーブルノード — スキーマ未登録テーブルを破線枠で表示。
 *
 * 対応機能要件: F2-2 (未認識テーブルの扱い), F2-4 (未登録テーブルのカラム推定表示)
 * 設計参照: doc/design/component-design.md
 *
 * - 枠線は dashed で登録済みノード（実線）と視覚的に区別する
 * - ヘッダーに [未登録] プレフィックスを表示
 * - compact 時: 推定カラム件数を表示
 * - detail 時: 推定カラム一覧を italic スタイルで表示
 * - React Flow の left/right Handle を保持
 */
function UnresolvedBoxNodeComponent({ data, id }: NodeProps) {
  const nodeData = data as unknown as UnresolvedBoxNodeData;
  const { tableName, inferredColumns, displayMode } = nodeData;

  const toggleDisplayMode = useFlowStore((s) => s.toggleDisplayMode);
  // bd-sql_viz_202604_2-4et: リネージュハイライト対応
  const highlightedColumns = useFlowStore((s) => s.highlightedColumns);
  const highlightPath = useFlowStore((s) => s.highlightPath);

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
        <span className={styles.prefix}>[未登録]</span>
        <span className={styles.title}>{tableName}</span>
        <span className={styles.toggleIcon}>
          {displayMode === 'compact' ? '▸' : '▾'}
        </span>
      </div>

      {displayMode === 'compact' ? (
        <div className={styles.compactBody}>
          <span className={styles.compactCount}>
            {inferredColumns.length > 0
              ? `${inferredColumns.length} 件の推定カラム`
              : 'カラム情報なし'}
          </span>
        </div>
      ) : (
        <div className={styles.detailBody}>
          {inferredColumns.length > 0 ? (
            inferredColumns.map((col) => {
              // bd-sql_viz_202604_2-4et: リネージュハイライト判定
              const isColHighlighted = highlightedColumns !== null &&
                highlightedColumns.has(`${id}:${col}`);
              const isColDimmed = highlightPath !== null && !isColHighlighted;
              const colClass = [
                styles.inferredColumn,
                isColHighlighted ? styles.inferredColumnHighlighted : '',
                isColDimmed ? styles.inferredColumnDimmed : '',
              ].filter(Boolean).join(' ');
              return (
                <div key={col} className={colClass}>
                  {col}
                </div>
              );
            })
          ) : (
            <div className={styles.emptyColumns}>推定カラムなし</div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}

export const UnresolvedBoxNode = memo(UnresolvedBoxNodeComponent);
