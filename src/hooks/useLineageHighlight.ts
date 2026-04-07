"use client";

import { useCallback } from 'react';
import { useFlowStore } from '@/stores/flowStore';

/**
 * カラムクリックによるリネージュハイライト操作フック。
 *
 * 対応機能要件: F2-3 (カラムレベルリネージュ)
 * 設計参照: doc/design/component-design.md セクション7.2
 *
 * - handleColumnClick: カラムクリック時にリネージュハイライトを設定。
 *   同じカラムを再クリックした場合はトグルで解除する。
 * - handleCanvasClick: キャンバス空白クリック時にハイライトを解除する。
 */
export function useLineageHighlight() {
  const highlightLineage = useFlowStore((s) => s.highlightLineage);
  const clearHighlight = useFlowStore((s) => s.clearHighlight);
  const highlightPath = useFlowStore((s) => s.highlightPath);

  const handleColumnClick = useCallback(
    (tableId: string, columnName: string) => {
      if (
        highlightPath?.tableId === tableId &&
        highlightPath?.columnName === columnName
      ) {
        clearHighlight();
      } else {
        highlightLineage(tableId, columnName);
      }
    },
    [highlightLineage, clearHighlight, highlightPath]
  );

  const handleCanvasClick = useCallback(() => {
    clearHighlight();
  }, [clearHighlight]);

  return { handleColumnClick, handleCanvasClick, highlightPath };
}
