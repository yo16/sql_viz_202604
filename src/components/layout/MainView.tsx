"use client";

import { useCallback, useEffect, useState } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { SqlInputPanel } from '@/components/input/SqlInputPanel';
import { FileDropZone, type FileContent } from '@/components/input/FileDropZone';
import { FlowCanvas } from '@/components/visualizer/FlowCanvas';
import { useLineageStore } from '@/stores/lineageStore';
import { initStoreSubscriptions } from '@/stores/storeSubscriptions';
import type { ParseResponse, ParsedQuery } from '@/types/api';
import styles from './MainView.module.css';

/**
 * アプリケーション全体のレイアウト管理コンポーネント。
 *
 * 対応機能要件: 全機能統合
 * 設計参照: doc/design/component-design.md セクション2.1
 *
 * 責務:
 * - Header, SqlInputPanel, FileDropZone, FlowCanvas の配置
 * - SQL入力 → POST /api/parse → lineageStore 更新のフロー
 * - ストア間連携の初期化
 * - 左右分割レイアウト（入力: 左、キャンバス: 右）
 */
export function MainView() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLeftPaneCollapsed, setIsLeftPaneCollapsed] = useState(false);
  const dialect = useLineageStore((s) => s.dialect);
  const addQuery = useLineageStore((s) => s.addQuery);

  const toggleLeftPane = useCallback(() => {
    setIsLeftPaneCollapsed((prev) => !prev);
  }, []);

  // ストア間連携を初期化（lineageStore → flowStore）
  useEffect(() => {
    const unsubscribe = initStoreSubscriptions();
    return unsubscribe;
  }, []);

  const parseSql = useCallback(
    async (sql: string) => {
      if (!sql.trim()) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql, dialect }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message ?? `エラー: HTTP ${res.status}`);
        }
        const data: ParseResponse = await res.json();

        // パース成功分を lineageStore に追加
        data.queries.forEach((query: ParsedQuery) => {
          addQuery(query);
        });

        // パースエラーがあれば表示
        if (data.errors.length > 0) {
          const errMessages = data.errors.map((e) => e.message).join('\n');
          setError(`一部のクエリでエラー: ${errMessages}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'パースに失敗しました');
      } finally {
        setIsLoading(false);
      }
    },
    [dialect, addQuery]
  );

  const handleFilesLoaded = useCallback(
    (contents: FileContent[]) => {
      if (contents.length === 0) return;
      // 全ファイルの内容を結合してパース
      const combinedSql = contents.map((f) => f.content).join('\n;\n');
      parseSql(combinedSql);
    },
    [parseSql]
  );

  return (
    <div className={styles.mainView}>
      <Header />
      <div className={styles.body}>
        <aside
          className={`${styles.leftPane} ${isLeftPaneCollapsed ? styles.collapsed : ''}`}
          aria-hidden={isLeftPaneCollapsed}
        >
          <SqlInputPanel onSubmit={parseSql} isLoading={isLoading} />
          <FileDropZone onFilesLoaded={handleFilesLoaded} />
          {error && (
            <div className={styles.errorBox} role="alert">
              {error}
            </div>
          )}
        </aside>
        <button
          type="button"
          className={styles.toggleButton}
          onClick={toggleLeftPane}
          aria-label={isLeftPaneCollapsed ? '入力パネルを開く' : '入力パネルを閉じる'}
          aria-expanded={!isLeftPaneCollapsed}
        >
          {isLeftPaneCollapsed ? '▸' : '◂'}
        </button>
        <main className={styles.rightPane}>
          <FlowCanvas />
        </main>
      </div>
      <Footer />
    </div>
  );
}
