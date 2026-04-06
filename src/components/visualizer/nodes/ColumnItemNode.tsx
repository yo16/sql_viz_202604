"use client";

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ColumnItemNodeData } from '@/types/flow';
import { useFlowStore } from '@/stores/flowStore';
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
 */
function ColumnItemNodeComponent({ data, id }: NodeProps) {
  const nodeData = data as unknown as ColumnItemNodeData;
  const { displayName, certainty, isHighlighted, conditionText } = nodeData;

  const highlightLineage = useFlowStore((s) => s.highlightLineage);
  const clearHighlight = useFlowStore((s) => s.clearHighlight);
  const highlightPath = useFlowStore((s) => s.highlightPath);

  const handleClick = useCallback(() => {
    const parts = id.split(':');
    const tableId = parts[0] ?? id;

    // トグル: 同じカラムが既にハイライト中なら解除
    if (highlightPath?.tableId === tableId && highlightPath?.columnName === displayName) {
      clearHighlight();
    } else {
      highlightLineage(tableId, displayName);
    }
  }, [id, displayName, highlightPath, highlightLineage, clearHighlight]);

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
