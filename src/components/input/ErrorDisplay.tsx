"use client";

import { useState } from 'react';
import type { ParseError } from '@/types/api';
import styles from './ErrorDisplay.module.css';

export interface ErrorDisplayProps {
  /** API/ネットワークエラーの汎用メッセージ */
  generalError?: string | null;
  /** SQLパースエラーのリスト */
  parseErrors?: ParseError[];
  /** エラークリア時のコールバック */
  onClear?: () => void;
}

/**
 * エラー表示UIコンポーネント。
 *
 * SQLパースエラーやAPIエラーをユーザーに分かりやすく表示する。
 * - 汎用エラー（ネットワーク、500等）はトップに表示
 * - パースエラーリストは errorType ごとに分類
 * - 各エラーは展開して詳細SQLを確認可能
 *
 * 設計参照: doc/design/api-design.md, component-design.md
 */
export function ErrorDisplay({ generalError, parseErrors = [], onClear }: ErrorDisplayProps) {
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());

  const hasErrors = !!generalError || parseErrors.length > 0;
  if (!hasErrors) return null;

  const toggleExpand = (index: number) => {
    setExpandedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className={styles.container} role="alert" aria-live="polite">
      <div className={styles.header}>
        <span className={styles.title}>
          エラー
          {parseErrors.length > 0 && ` (${parseErrors.length}件)`}
        </span>
        {onClear && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={onClear}
            aria-label="エラーをクリア"
          >
            ×
          </button>
        )}
      </div>

      {generalError && (
        <div className={styles.generalError}>{generalError}</div>
      )}

      {parseErrors.length > 0 && (
        <ul className={styles.errorList}>
          {parseErrors.map((err, index) => {
            const isExpanded = expandedIndices.has(index);
            return (
              <li key={index} className={styles.errorItem}>
                <div className={styles.errorHeader}>
                  <span className={`${styles.errorType} ${styles[`type_${err.errorType}`] ?? ''}`}>
                    {formatErrorType(err.errorType)}
                  </span>
                  <span className={styles.errorMessage}>{err.message}</span>
                  <button
                    type="button"
                    className={styles.expandButton}
                    onClick={() => toggleExpand(index)}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'SQL詳細を閉じる' : 'SQL詳細を開く'}
                  >
                    {isExpanded ? '▾' : '▸'}
                  </button>
                </div>
                {isExpanded && (
                  <pre className={styles.rawSql}>{err.rawSql}</pre>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * errorType を日本語ラベルに変換する。
 */
function formatErrorType(type: ParseError['errorType']): string {
  switch (type) {
    case 'syntax_error':
      return '構文エラー';
    case 'unsupported_syntax':
      return '非対応構文';
    case 'parse_error':
      return 'パースエラー';
    default:
      return 'エラー';
  }
}
