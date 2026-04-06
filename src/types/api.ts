/** DB方言 */
export type SqlDialect = 'BigQuery' | 'PostgreSQL' | 'MySQL' | 'SQLite';

/** POST /api/parse リクエスト */
export interface ParseRequest {
  /** SQL文字列（複数クエリはセミコロン区切り） */
  sql: string;
  /** DB方言（デフォルト: 'BigQuery'） */
  dialect?: SqlDialect;
}

/** POST /api/parse レスポンス — 成功時 (200) */
export interface ParseResponse {
  /** パースに成功したクエリ群 */
  queries: ParsedQuery[];
  /** パースに失敗したクエリ群（部分的成功を許容） */
  errors: ParseError[];
}

/** パース済みクエリ */
export interface ParsedQuery {
  /** クエリの一意識別子（サーバー側で生成する UUID v4） */
  queryId: string;
  /** 元のSQL文字列 */
  rawSql: string;
  /** CTAS の場合のターゲットテーブル名。なければ null */
  targetTable: string | null;
  /** クエリ種別 */
  queryType: 'select' | 'ctas';
  /** SELECT句の情報 */
  select: SelectClause;
  /** FROM句の情報 */
  from: FromClause;
  /** WHERE句の情報（なければ null） */
  where: WhereClause | null;
  /** GROUP BY句の情報（なければ null） */
  groupBy: GroupByClause | null;
  /** HAVING句の情報（なければ null） */
  having: HavingClause | null;
  /** ORDER BY句の情報（なければ null） */
  orderBy: OrderByClause | null;
  /** CTE（WITH句）の情報 */
  ctes: CteDefinition[];
}

/** パースエラー */
export interface ParseError {
  /** 元のSQL文字列 */
  rawSql: string;
  /** エラーメッセージ */
  message: string;
  /** エラー種別 */
  errorType: 'syntax_error' | 'unsupported_syntax' | 'parse_error';
}

/** SELECT句 */
export interface SelectClause {
  columns: SelectColumn[];
}

/** SELECTカラム */
export interface SelectColumn {
  /** 表示名（AS指定があればそれ、なければ元のカラム名/式） */
  displayName: string;
  /** カラム参照の場合のソーステーブル名（エイリアスまたは実テーブル名） */
  sourceTable: string | null;
  /** カラム参照の場合の元カラム名 */
  sourceColumn: string | null;
  /** 式の種別 */
  exprType: 'column_ref' | 'star' | 'table_star' | 'expression' | 'aggr_func' | 'literal';
  /** 式内で参照されるカラム群（expressionやaggr_funcの場合） */
  columnRefs: ColumnRef[];
  /** SELECT * の場合のソーステーブル（t.* の t 部分）。* なら null */
  starSourceTable: string | null;
}

/** カラム参照 */
export interface ColumnRef {
  table: string | null;
  column: string;
}

/** FROM句 */
export interface FromClause {
  tables: FromTable[];
  joins: JoinInfo[];
  subqueries: SubqueryInfo[];
}

/** FROMテーブル */
export interface FromTable {
  /** 実テーブル名 */
  name: string;
  /** エイリアス（AS指定がなければ null） */
  alias: string | null;
}

/** JOIN情報 */
export interface JoinInfo {
  /** JOIN種別 */
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';
  /** 結合先テーブル名 */
  table: string;
  /** 結合先エイリアス */
  alias: string | null;
  /** ON条件のカラム参照群 */
  onConditionRefs: ColumnRef[];
  /** ON条件の表示用文字列 */
  onConditionText: string;
}

/** サブクエリ情報 */
export interface SubqueryInfo {
  /** サブクエリのエイリアス */
  alias: string;
  /** サブクエリの内容（ParsedQuery として再帰的に表現） */
  query: ParsedQuery;
}

/** WHERE句 */
export interface WhereClause {
  /** 条件内で参照されるカラム群 */
  columnRefs: ColumnRef[];
  /** 条件式の表示用文字列 */
  conditionText: string;
  /** WHERE IN/EXISTS サブクエリ */
  subqueries: SubqueryInfo[];
}

/** GROUP BY句 */
export interface GroupByClause {
  /** GROUP BY のカラム参照群 */
  columnRefs: ColumnRef[];
  /** 表示用文字列 */
  expressionText: string;
}

/** HAVING句 */
export interface HavingClause {
  /** 条件内で参照されるカラム群 */
  columnRefs: ColumnRef[];
  /** 条件式の表示用文字列 */
  conditionText: string;
}

/** ORDER BY句 */
export interface OrderByClause {
  /** ORDER BY のカラム参照群 */
  columnRefs: ColumnRef[];
  /** 表示用文字列 */
  expressionText: string;
}

/** CTE定義 */
export interface CteDefinition {
  /** CTE名 */
  name: string;
  /** CTEの内容（ParsedQuery として再帰的に表現） */
  query: ParsedQuery;
}

/** バリデーションエラーレスポンス (400) */
export interface ApiValidationError {
  error: 'VALIDATION_ERROR';
  message: string;
  details: {
    field: string;
    constraint: string;
  };
}

/** サーバーエラーレスポンス (500) */
export interface ApiInternalError {
  error: 'INTERNAL_ERROR';
  message: string;
}

/** APIエラーレスポンスの共用型 */
export type ApiError = ApiValidationError | ApiInternalError;
