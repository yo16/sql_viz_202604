"use client";

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ClauseBoxNodeData } from '@/types/flow';
import { useFlowStore } from '@/stores/flowStore';
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
 *
 * 縦展開 (bd-sql_viz_202604_2-oi5):
 * SELECT 以外の clauseBox はヘッダの ▸/▾ アイコンクリックで縦展開できる。
 * 展開時は label が複数行に折り返し表示され、box の高さが拡張される。
 */
function ClauseBoxNodeComponent({ data, id }: NodeProps) {
  const nodeData = data as unknown as ClauseBoxNodeData;
  const { clauseType, label, expanded } = nodeData;

  const toggleClauseExpand = useFlowStore((s) => s.toggleClauseExpand);
  const isExpandable = clauseType !== 'SELECT';

  const handleToggle = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (isExpandable) toggleClauseExpand(id);
  }, [id, isExpandable, toggleClauseExpand]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle(e);
    }
  }, [handleToggle]);

  // FROM句のJOINアイコン検出
  const joinIcon = clauseType === 'FROM' ? detectJoinIcon(label) : null;

  const containerClass = [styles.container, expanded ? styles.expanded : ''].filter(Boolean).join(' ');

  return (
    <div className={containerClass}>
      {/* FROM / WHERE clauseBox には table_dependency エッジの target Handle を持たせる
          (bd-sql_viz_202604_2-q8n / bd-sql_viz_202604_2-hnw) */}
      {(clauseType === 'FROM' || clauseType === 'WHERE') && (
        <Handle type="target" position={Position.Left} className={styles.handle} />
      )}
      <div
        className={styles.header}
        onClick={isExpandable ? handleToggle : undefined}
        onKeyDown={isExpandable ? handleKeyDown : undefined}
        role={isExpandable ? 'button' : undefined}
        tabIndex={isExpandable ? 0 : undefined}
        title={isExpandable ? (expanded ? '折りたたむ' : '展開') : undefined}
      >
        <span className={styles.clauseType}>{clauseType}</span>
        {joinIcon && (
          <span className={styles.joinIcon} title={`${joinIcon.type} JOIN`}>
            {joinIcon.icon}
          </span>
        )}
        {label && label !== clauseType && !expanded && (
          <span className={styles.label}>{label}</span>
        )}
        {isExpandable && (
          <span className={styles.toggleIcon} aria-hidden="true">
            {expanded ? '▾' : '▸'}
          </span>
        )}
      </div>
      {expanded && label && label !== clauseType && (
        <div className={styles.expandedBody}>
          {label}
        </div>
      )}
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
