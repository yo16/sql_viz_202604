"use client";

import { memo } from 'react';
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import type { LineageEdgeData } from '@/types/flow';
import styles from './LineageEdge.module.css';

/**
 * リネージュエッジコンポーネント。
 *
 * 対応機能要件: F2-1 (テーブル依存関係の自動検出), F2-3 (カラムレベルリネージュ)
 * 設計参照: doc/design/component-design.md
 *
 * dependencyType に応じてスタイルを切り替える:
 * - table_dependency: 実線・薄グレー・矢印（常時表示）
 * - column_lineage: isHighlighted=true のときのみ強調、非ハイライト時はフェード
 */
function LineageEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) {
  const edgeData = data as unknown as (LineageEdgeData & { highlightDirection?: string }) | undefined;
  const dependencyType = edgeData?.dependencyType ?? 'table_dependency';
  const isHighlighted = edgeData?.isHighlighted ?? false;
  const isDimmed = edgeData?.isDimmed ?? false;
  // bd-sql_viz_202604_2-2vk: アニメーション方向（トリガーから外向き）
  const highlightDirection = edgeData?.highlightDirection;

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeClassName = [
    styles.edge,
    dependencyType === 'table_dependency' ? styles.tableDependency : styles.columnLineage,
    isHighlighted ? styles.highlighted : '',
    isDimmed && !isHighlighted ? styles.dimmed : '',
    isHighlighted && highlightDirection === 'upstream' ? styles.upstream : '',
    isHighlighted && highlightDirection === 'downstream' ? styles.downstream : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      className={edgeClassName}
      markerEnd={markerEnd}
    />
  );
}

export const LineageEdge = memo(LineageEdgeComponent);
