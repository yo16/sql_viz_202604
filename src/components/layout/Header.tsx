"use client";

import { useLineageStore } from '@/stores/lineageStore';
import { DialectSelector } from '@/components/ui/DialectSelector';
import { ResetButton } from '@/components/ui/ResetButton';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import styles from './Header.module.css';

/**
 * アプリケーションヘッダー。
 *
 * DialectSelector, ResetButton, LanguageSelector を配置し、グローバル操作UIを集約する。
 * LanguageSelector は FI-1 対応で、画面右端から常にアクセス可能にする。
 *
 * 設計参照:
 * - doc/design/component-design.md セクション1 コンポーネントツリー
 * - doc/design/component-design.md §2.6 LanguageSelector
 */
export function Header() {
  const dialect = useLineageStore((s) => s.dialect);
  const setDialect = useLineageStore((s) => s.setDialect);

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>SQL Lineage Viz</h1>
      <div className={styles.actions}>
        <DialectSelector value={dialect} onChange={setDialect} />
        <ResetButton />
        <LanguageSelector />
      </div>
    </header>
  );
}
