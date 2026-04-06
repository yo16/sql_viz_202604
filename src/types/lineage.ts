/** SqlDialect は api.ts で定義済み。lineage.ts からも再エクスポート */
export { type SqlDialect } from './api';

/** 依存種別 */
export type DependencyType =
  | 'direct'       // 単純カラム参照: SELECT a.id
  | 'expression'   // 式内カラム参照: SELECT a.x + a.y AS total
  | 'condition'    // WHERE/HAVING条件: WHERE a.status = 'active'
  | 'aggregate'    // 集約関数内: SUM(a.amount)
  | 'join_key'     // JOIN ON条件: ON a.id = b.user_id
  | 'star';        // SELECT *による伝播: SELECT * FROM table_b

/** カラムの確度 */
export type Certainty =
  | 'confirmed'    // パース結果から確定
  | 'inferred'     // 未登録テーブルから推定（F2-4）
  | 'propagated';  // SELECT * から伝播（F2-5）

/** カラム依存関係 */
export interface ColumnDependency {
  /** 依存元テーブルのID */
  sourceTableId: string;
  /** 依存元カラム名 */
  sourceColumn: string;
  /** 依存の種別 */
  type: DependencyType;
}

/** カラムノード — テーブル内の1カラムを表す */
export interface ColumnNode {
  /** カラム名（AS で指定された名前、または元のカラム名） */
  columnName: string;
  /** 所属テーブルのID */
  tableId: string;
  /** カラムの確度 */
  certainty: Certainty;
  /** このカラムの依存関係（上流カラムへの参照） */
  dependencies: ColumnDependency[];
  /** SELECT * を含むかどうか */
  isFromStar: boolean;
  /** 式の種別（可視化のヒント用） */
  exprType: 'column_ref' | 'star' | 'table_star' | 'expression' | 'aggr_func' | 'literal';
}

/** 句情報（可視化用） */
export interface ClauseInfo {
  select: {
    columns: Array<{
      displayName: string;
      sourceTable: string | null;
      sourceColumn: string | null;
      exprType: string;
    }>;
  };
  from: {
    tables: Array<{ name: string; alias: string | null }>;
    joins: Array<{
      joinType: string;
      table: string;
      alias: string | null;
      onConditionText: string;
    }>;
  };
  where: { conditionText: string } | null;
  groupBy: { expressionText: string } | null;
  having: { conditionText: string } | null;
  orderBy: { expressionText: string } | null;
}

/** CTE ノード */
export interface CteNode {
  /** CTE名 */
  name: string;
  /** CTE内部のTableNode */
  tableNode: TableNode;
}

/** サブクエリノード */
export interface SubqueryNode {
  /** エイリアス名（FROMサブクエリ）または "[サブクエリ]"（WHERE IN/EXISTS） */
  alias: string;
  /** サブクエリ内部のTableNode */
  tableNode: TableNode;
}

/** テーブルノード — リネージュグラフの頂点 */
export interface TableNode {
  /** テーブルの一意識別子（CTAS の場合はテーブル名、SELECT の場合は queryId） */
  id: string;
  /** テーブル名（CTAS: ターゲットテーブル名, SELECT: null） */
  name: string | null;
  /** 表示用タイトル */
  displayTitle: string;
  /** 登録済みか（SQLが提供されているか） */
  isRegistered: boolean;
  /** クエリ種別 */
  queryType: 'select' | 'ctas' | 'unresolved';
  /** 対応する queryId（未登録テーブルの場合は null） */
  queryId: string | null;
  /** カラムマップ（カラム名 → ColumnNode） */
  columns: Map<string, ColumnNode>;
  /** このテーブルが依存するテーブル名の集合（FROM/JOIN で参照するテーブル） */
  dependsOn: Set<string>;
  /** CTE定義（WITH句がある場合） */
  ctes: CteNode[];
  /** FROM句サブクエリ */
  fromSubqueries: SubqueryNode[];
  /** WHERE句サブクエリ */
  whereSubqueries: SubqueryNode[];
  /** 句情報（可視化用） */
  clauses: ClauseInfo;
}

/** リネージュパス — ハイライト追跡用 */
export interface LineagePath {
  sourceTableId: string;
  sourceColumn: string;
  targetTableId: string;
  targetColumn: string;
  dependencyType: DependencyType;
}
