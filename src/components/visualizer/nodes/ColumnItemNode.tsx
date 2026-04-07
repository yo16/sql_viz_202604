"use client";

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ColumnItemNodeData } from '@/types/flow';
import { useLineageHighlight } from '@/hooks/useLineageHighlight';
import styles from './ColumnItemNode.module.css';

/**
 * カラム項目ノード — カラム1件を表す最小単位ノード。
 *
 * 対応機能要件: F1-3 (単一クエリの可視化), F2-3 (リネージュ追跡), F2-4 (未登録テーブルカラム推定)
 * 設計参照: doc/design/component-design.md セクション3.3
 *
 * certainty に応じたスタイル差異:
 * - confirmed: 通常テキスト
 * - inferred: イタリック + 薄い背景色
 * - propagated: 通常テキスト + 小アイコン *
 *
 * クリック動作: ハイライトのトグル（再クリックで解除）
 * useLineageHighlight フックと連携してリネージュパスをハイライト表示する。
 */
function ColumnItemNodeComponent({ data, id }: NodeProps) {
  const nodeData = data as unknown as ColumnItemNodeData;
  const { displayName, certainty, conditionText } = nodeData;

  const { handleColumnClick, highlightPath } = useLineageHighlight();
  // highlightPath から isHighlighted を動的計算する（ColumnItemNodeData.isHighlighted に依存しない）
  const parts = id.split(':');
  const tableId = parts[0] ?? id;
  const isHighlighted =
    highlightPath?.tableId === tableId &&
    highlightPath?.columnName === displayName;
  // ハイライト発動中で自分が対象外の場合はdim
  const isDimmed = highlightPath !== null && !isHighlighted;

  const handleClick = useCallback(() => {
    handleColumnClick(tableId, displayName);
  }, [tableId, displayName, handleColumnClick]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  const containerClass = [
    styles.container,
    certainty === 'inferred' ? styles.inferred : '',
    certainty === 'propagated' ? styles.propagated : '',
    isHighlighted ? styles.highlighted : '',
    isDimmed ? styles.dimmed : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={containerClass}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <span className={styles.name}>
        {displayName}
        {certainty === 'propagated' && <span className={styles.starIcon}>*</span>}
      </span>
      {conditionText && (
        <span className={styles.condition} title={conditionText}>
          {conditionText}
        </span>
      )}
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}

export const ColumnItemNode = memo(ColumnItemNodeComponent);
