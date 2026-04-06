"use client";

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { ClauseBoxNodeData } from '@/types/flow';
import styles from './ClauseBoxNode.module.css';

/** JOIN種別→アイコンのマッピング（設計: component-design.md セクション3.2） */
const JOIN_ICONS: Record<string, string> = {
  INNER: '⋈',
  LEFT: '⟕',
  RIGHT: '⟖',
  FULL: '⟗',
  CROSS: '×',
};

/**
 * 句ノード — SELECT, FROM, WHERE 等の句を表すコンテナノード。
 *
 * 対応機能要件: F1-3 (単一クエリの可視化)
 * 設計参照: doc/design/component-design.md セクション3.2
 *
 * 句の種別をヘッダーに表示し、子ノード (ColumnItemNode) は
 * React Flow の parentId 機能で内部に配置される。
 * detail表示時のみ visible。compact時は hidden: true。
 *
 * FROM句の場合、label にJOIN種別が含まれていればアイコンを表示する。
 */
function ClauseBoxNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as ClauseBoxNodeData;
  const { clauseType, label } = nodeData;

  // FROM句のJOINアイコン検出
  const joinIcon = clauseType === 'FROM' ? detectJoinIcon(label) : null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.clauseType}>{clauseType}</span>
        {joinIcon && (
          <span className={styles.joinIcon} title={`${joinIcon.type} JOIN`}>
            {joinIcon.icon}
          </span>
        )}
        {label && label !== clauseType && (
          <span className={styles.label}>{label}</span>
        )}
      </div>
    </div>
  );
}

/**
 * label文字列からJOIN種別を検出し、対応するアイコンを返す。
 */
function detectJoinIcon(label: string): { type: string; icon: string } | null {
  if (!label) return null;
  const upper = label.toUpperCase();
  for (const [type, icon] of Object.entries(JOIN_ICONS)) {
    if (upper.includes(`${type} JOIN`) || upper.includes(type)) {
      return { type, icon };
    }
  }
  return null;
}

export const ClauseBoxNode = memo(ClauseBoxNodeComponent);
