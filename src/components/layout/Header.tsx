"use client";

import { useLineageStore } from '@/stores/lineageStore';
import { useLocale } from '@/i18n/useLocale';
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
 * タイトル "SQL Lineage Viz" は英語固定だが、キー経由で取得して呼出側を統一する
 * （ja/en 両リソースで同一値。FI-5 の英語固定文字列ルール）。
 *
 * 設計参照:
 * - doc/design/component-design.md セクション1 コンポーネントツリー
 * - doc/design/component-design.md §2.6 LanguageSelector
 * - doc/design/i18n.md §9 useLocale 化方針
 */
export function Header() {
  const dialect = useLineageStore((s) => s.dialect);
  const setDialect = useLineageStore((s) => s.setDialect);
  const { t } = useLocale();

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{t.header.title}</h1>
      <div className={styles.actions}>
        <DialectSelector value={dialect} onChange={setDialect} />
        <ResetButton />
        <LanguageSelector />
      </div>
    </header>
  );
}
