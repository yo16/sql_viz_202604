"use client";

import { useCallback, useEffect, useState } from 'react';
import { useLineageStore } from '@/stores/lineageStore';
import styles from './SqlInputPanel.module.css';

export interface SqlInputPanelProps {
  onSubmit: (sql: string) => void;
  isLoading: boolean;
}

/**
 * SQL入力パネル。
 *
 * 対応機能要件: F1-1 (SQL入力)
 * 設計参照: doc/design/component-design.md セクション2.2
 *
 * 責務:
 * - テキストエリアへの直接入力
 * - 「パース実行」ボタンでonSubmit callback呼び出し
 * - ローディング状態の表示
 *
 * FileDropZoneとの連携は親コンポーネント(MainView)で行う。
 */
export function SqlInputPanel({ onSubmit, isLoading }: SqlInputPanelProps) {
  const [sql, setSql] = useState('');
  const resetCounter = useLineageStore((s) => s.resetCounter);

  // lineageStore.resetAll() が呼ばれたら入力テキストをクリア
  useEffect(() => {
    setSql('');
  }, [resetCounter]);

  const handleSubmit = useCallback(() => {
    if (sql.trim().length === 0 || isLoading) return;
    onSubmit(sql);
  }, [sql, isLoading, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter でパース実行
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleClear = useCallback(() => {
    setSql('');
  }, []);

  const isSubmitDisabled = sql.trim().length === 0 || isLoading;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <label htmlFor="sql-input" className={styles.label}>
          SQL入力
        </label>
        {sql.length > 0 && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={handleClear}
            disabled={isLoading}
            aria-label="クリア"
          >
            クリア
          </button>
        )}
      </div>

      <textarea
        id="sql-input"
        className={styles.textarea}
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="SELECT * FROM users ..."
        disabled={isLoading}
        spellCheck={false}
      />

      <div className={styles.footer}>
        <span className={styles.hint}>
          Ctrl + Enter で実行
        </span>
        <button
          type="button"
          className={styles.submitButton}
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
          aria-label="パース実行"
        >
          {isLoading ? '実行中...' : 'パース実行'}
        </button>
      </div>
    </div>
  );
}
