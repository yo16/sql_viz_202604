"use client";

import type { SqlDialect } from '@/types/api';
import styles from './DialectSelector.module.css';

interface DialectSelectorProps {
  value: SqlDialect;
  onChange: (dialect: SqlDialect) => void;
}

const DIALECT_OPTIONS: Array<{ value: SqlDialect; label: string; disabled: boolean }> = [
  { value: 'BigQuery', label: 'BigQuery', disabled: false },
  { value: 'PostgreSQL', label: 'PostgreSQL', disabled: true },
  { value: 'MySQL', label: 'MySQL', disabled: true },
  { value: 'SQLite', label: 'SQLite', disabled: true },
];

/**
 * DB方言セレクタコンポーネント。
 *
 * 対応機能要件: F1-1
 * 設計参照: doc/design/component-design.md セクション2.4
 *
 * BigQuery が初期選択。PostgreSQL/MySQL/SQLite は将来対応（disabled表示）。
 */
export function DialectSelector({ value, onChange }: DialectSelectorProps) {
  return (
    <div className={styles.container}>
      <label className={styles.label} htmlFor="dialect-selector">
        DB方言
      </label>
      <select
        id="dialect-selector"
        className={styles.select}
        value={value}
        onChange={(e) => onChange(e.target.value as SqlDialect)}
      >
        {DIALECT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
