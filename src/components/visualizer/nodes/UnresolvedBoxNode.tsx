"use client";

import { memo, useCallback } from 'react';
import { Handle, Position, NodeResizeControl, type NodeProps } from '@xyflow/react';
import type { UnresolvedBoxNodeData } from '@/types/flow';
import { useFlowStore } from '@/stores/flowStore';
import { useLocale } from '@/i18n/useLocale';
import styles from './UnresolvedBoxNode.module.css';

function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`
  );
}

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
  const syncNodeDimensions = useFlowStore((s) => s.syncNodeDimensions);
  // bd-sql_viz_202604_2-4et: リネージュハイライト対応
  const highlightedColumns = useFlowStore((s) => s.highlightedColumns);
  const highlightPath = useFlowStore((s) => s.highlightPath);
  const { t } = useLocale();

  const handleToggle = useCallback(() => {
    toggleDisplayMode(id);
  }, [id, toggleDisplayMode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  }, [handleToggle]);

  const handleResizeEnd = useCallback((_event: unknown, params: { width: number; height: number }) => {
    syncNodeDimensions(id, params.width, params.height);
  }, [id, syncNodeDimensions]);

  return (
    <div className={styles.container}>
      {/* bd-sql_viz_202604_2-eqv: 右下リサイズハンドル */}
      <NodeResizeControl
        minWidth={180}
        minHeight={60}
        position="bottom-right"
        style={{ background: 'transparent', border: 'none', padding: 0 }}
        onResizeEnd={handleResizeEnd}
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
        title={displayMode === 'compact' ? t.node.clickToDetail : t.node.clickToCompact}
      >
        <span className={styles.prefix}>{t.node.unresolvedPrefix}</span>
        <span className={styles.title}>{tableName}</span>
        <span className={styles.toggleIcon}>
          {displayMode === 'compact' ? '▸' : '▾'}
        </span>
      </div>

      {displayMode === 'compact' ? (
        <div className={styles.compactBody}>
          <span className={styles.compactCount}>
            {inferredColumns.length > 0
              ? format(t.node.inferredColumnCount, { count: inferredColumns.length })
              : t.node.noColumnInfo}
          </span>
        </div>
      ) : (
        <div className={styles.detailBody}>
          {inferredColumns.length > 0 ? (
            inferredColumns.map((col) => {
              // bd-sql_viz_202604_2-4et: リネージュハイライト判定
              const isColHighlighted = highlightedColumns !== null &&
                highlightedColumns.has(`${id}:${col}`);
              // bd-sql_viz_202604_2-d58: トリガー列はより目立つスタイル
              const isColTrigger = isColHighlighted &&
                highlightPath?.tableId === id &&
                highlightPath?.columnName === col;
              const isColDimmed = highlightPath !== null && !isColHighlighted;
              const colClass = [
                styles.inferredColumn,
                isColTrigger ? styles.inferredColumnTrigger :
                  (isColHighlighted ? styles.inferredColumnHighlighted : ''),
                isColDimmed ? styles.inferredColumnDimmed : '',
              ].filter(Boolean).join(' ');
              return (
                <div key={col} className={colClass}>
                  {col}
                </div>
              );
            })
          ) : (
            <div className={styles.emptyColumns}>{t.node.noInferredColumns}</div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}

export const UnresolvedBoxNode = memo(UnresolvedBoxNodeComponent);
