import { create } from 'zustand';
import type { ParsedQuery } from '@/types/api';
import type { TableNode } from '@/types/lineage';
import type { SqlDialect } from '@/types/api';
import { buildLineageGraph } from '@/lib/lineage/buildLineageGraph';
import { inferUnregisteredColumns } from '@/lib/lineage/inferUnregisteredColumns';
import { propagateSelectStar } from '@/lib/lineage/propagateSelectStar';

/** lineageStore の状態型 */
export interface LineageState {
  /** 全テーブルのマップ（テーブル名/queryId → TableNode） */
  tables: Map<string, TableNode>;
  /** 全クエリのマップ（queryId → ParsedQuery） */
  queries: Map<string, ParsedQuery>;
  /** 選択中のDB方言 */
  dialect: SqlDialect;
}

/** lineageStore のアクション型 */
export interface LineageActions {
  /**
   * パース結果を追加してリネージュグラフを再構築。
   * 1. ParsedQuery から TableNode を生成
   * 2. 未登録テーブルとの一致チェック→置換
   * 3. inferUnregisteredColumns 再実行
   * 4. propagateSelectStar 再実行
   */
  addQuery: (parsed: ParsedQuery) => void;

  /** 指定クエリを削除してリネージュグラフを再構築 */
  removeQuery: (queryId: string) => void;

  /** 全状態をクリア */
  resetAll: () => void;

  /** DB方言を変更 */
  setDialect: (dialect: SqlDialect) => void;
}

/** lineageStore の完全型 */
export type LineageStore = LineageState & LineageActions;

/**
 * lineageStore — リネージュグラフのデータモデル管理。
 *
 * Zustand ストアとして、テーブル/カラムの依存関係グラフを保持し、
 * クエリ追加時にグラフを再構築する。
 */
export const useLineageStore = create<LineageStore>((set, get) => ({
  tables: new Map(),
  queries: new Map(),
  dialect: 'BigQuery',

  addQuery: (parsed: ParsedQuery) => {
    const state = get();
    const queries = new Map(state.queries);
    queries.set(parsed.queryId, parsed);

    // 全クエリからグラフを再構築
    const allQueries = Array.from(queries.values());
    let tables = buildLineageGraph(allQueries);
    tables = inferUnregisteredColumns(tables, allQueries);
    tables = propagateSelectStar(tables);

    set({ tables, queries });
  },

  removeQuery: (queryId: string) => {
    const state = get();
    const queries = new Map(state.queries);
    queries.delete(queryId);

    if (queries.size === 0) {
      set({ tables: new Map(), queries });
      return;
    }

    // 残りのクエリからグラフを再構築
    const allQueries = Array.from(queries.values());
    let tables = buildLineageGraph(allQueries);
    tables = inferUnregisteredColumns(tables, allQueries);
    tables = propagateSelectStar(tables);

    set({ tables, queries });
  },

  resetAll: () => {
    set({
      tables: new Map(),
      queries: new Map(),
      dialect: 'BigQuery',
    });
  },

  setDialect: (dialect: SqlDialect) => {
    set({ dialect });
  },
}));
