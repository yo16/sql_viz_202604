"use client";

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ColumnItemNodeData } from '@/types/flow';
import { useLineageHighlight } from '@/hooks/useLineageHighlight';
import { useFlowStore } from '@/stores/flowStore';
import styles from './ColumnItemNode.module.css';

/**
 * カラム項目ノード — カラム1件を表す最小単位ノード。
 *
 * 対応機能要件: F1-3 (単一クエリの可視化), F2-3 (リネージュ追跡), F2-4 (未登録テーブルカラム推定), F2-5 (SELECT * 伝播表示)
 * 設計参照: doc/design/component-design.md セクション3.3
 *
 * certainty に応じたスタイル差異:
 * - confirmed: 通常テキスト
 * - inferred: イタリック + 薄い背景色
 * - propagated: 薄い紫背景 + 左ボーダー + `*` バッジ（SELECT * 由来を明示）
 *
 * isFromStar=true の場合: certainty=propagated と同義。ツールチップで由来を説明。
 *
 * クリック動作: ハイライトのトグル（再クリックで解除）
 * useLineageHighlight フックと連携してリネージュパスをハイライト表示する。
 */
function ColumnItemNodeComponent({ data, id }: NodeProps) {
  const nodeData = data as unknown as ColumnItemNodeData;
  const { displayName, certainty, conditionText, isFromStar } = nodeData;

  const { handleColumnClick, highlightPath } = useLineageHighlight();
  // bd-sql_viz_202604_2-26k: highlightedColumns からリネージュチェーン上の
  // 全カラム（上流＋下流＋クリック自身）のハイライトを判定する
  const highlightedColumns = useFlowStore((s) => s.highlightedColumns);
  const parts = id.split(':');
  const tableId = parts[0] ?? id;
  const isHighlighted = highlightedColumns !== null &&
    highlightedColumns.has(`${tableId}:${displayName}`);
  // ハイライト発動中で自分が対象外の場合はdim
  const isDimmed = highlightPath !== null && !isHighlighted;

  // SELECT * 由来かどうか（certainty または isFromStar で判定）
  const isPropagated = certainty === 'propagated' || isFromStar === true;

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
    isPropagated ? styles.propagated : '',
    isHighlighted ? styles.highlighted : '',
    isDimmed ? styles.dimmed : '',
  ].filter(Boolean).join(' ');

  const titleText = isPropagated
    ? `SELECT * から伝播: ${displayName}`
    : conditionText ?? undefined;

  return (
    <div
      className={containerClass}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      title={titleText}
    >
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <span className={styles.name}>
        {displayName}
      </span>
      {isPropagated && (
        <span className={styles.starBadge} aria-label="SELECT * 由来">
          *
        </span>
      )}
      {certainty === 'inferred' && (
        <span className={styles.inferredBadge} aria-label="推定カラム">
          ?
        </span>
      )}
      {conditionText && !isPropagated && (
        <span className={styles.condition} title={conditionText}>
          {conditionText}
        </span>
      )}
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}

export const ColumnItemNode = memo(ColumnItemNodeComponent);
