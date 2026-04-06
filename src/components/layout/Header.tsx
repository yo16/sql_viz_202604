"use client";

import { useLineageStore } from '@/stores/lineageStore';
import { DialectSelector } from '@/components/ui/DialectSelector';
import { ResetButton } from '@/components/ui/ResetButton';
import styles from './Header.module.css';

/**
 * アプリケーションヘッダー。
 *
 * DialectSelector と ResetButton を配置し、グローバル操作UIを集約する。
 * 設計参照: doc/design/component-design.md セクション1 コンポーネントツリー
 */
export function Header() {
  const dialect = useLineageStore((s) => s.dialect);
  const setDialect = useLineageStore((s) => s.setDialect);

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>SQL Visualizer</h1>
      <div className={styles.actions}>
        <DialectSelector value={dialect} onChange={setDialect} />
        <ResetButton />
      </div>
    </header>
  );
}
