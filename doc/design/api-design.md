# API設計

## 関連ドキュメント

- [全体アーキテクチャ設計](./architecture.md)
- [リネージュデータモデル設計](./lineage-model.md)
- [要件定義 F1-2: SQLパース](../requirements-phase1-2.md)

---

## 1. エンドポイント一覧

フェーズ1-2 で実装するエンドポイントは1つのみ。

| メソッド | パス | 用途 | 対応機能要件 |
|---|---|---|---|
| POST | `/api/parse` | SQL文字列をパースし構造化データを返却 | F1-2, F1-5, F1-6 |

---

## 2. POST /api/parse

### 概要

1つ以上のSQL文を受け取り、各クエリをパースして構造化データを返す。CTAS (CREATE TABLE AS SELECT) にも対応し、テーブル名の抽出も行う。

### リクエスト

```typescript
// types/api.ts

type SqlDialect = 'BigQuery' | 'PostgreSQL' | 'MySQL' | 'SQLite';

interface ParseRequest {
  /** SQL文字列（複数クエリはセミコロン区切り） */
  sql: string;
  /** DB方言（デフォルト: 'BigQuery'） */
  dialect?: SqlDialect;
}
```

```
POST /api/parse
Content-Type: application/json

{
  "sql": "CREATE TABLE output AS SELECT a.id, b.name FROM table_a a JOIN table_b b ON a.id = b.id WHERE a.status = 'active';",
  "dialect": "BigQuery"
}
```

### レスポンス — 成功時 (200)

```typescript
// types/api.ts

interface ParseResponse {
  /** パースに成功したクエリ群 */
  queries: ParsedQuery[];
  /** パースに失敗したクエリ群（部分的成功を許容） */
  errors: ParseError[];
}

interface ParsedQuery {
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

interface ParseError {
  /** 元のSQL文字列 */
  rawSql: string;
  /** エラーメッセージ */
  message: string;
  /** エラー種別 */
  errorType: 'syntax_error' | 'unsupported_syntax' | 'parse_error';
}
```

### 句の構造化型定義

```typescript
// types/api.ts

/** SELECT句 */
interface SelectClause {
  columns: SelectColumn[];
}

interface SelectColumn {
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

interface ColumnRef {
  table: string | null;
  column: string;
}

/** FROM句 */
interface FromClause {
  tables: FromTable[];
  joins: JoinInfo[];
  subqueries: SubqueryInfo[];
}

interface FromTable {
  /** 実テーブル名 */
  name: string;
  /** エイリアス（AS指定がなければ null） */
  alias: string | null;
}

interface JoinInfo {
  /** JOIN種別 */
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';
  /** 結合先テーブル名（サブクエリ JOIN の場合はサブクエリ alias、bd-sql_viz_202604_2-ih7）*/
  table: string;
  /** 結合先エイリアス */
  alias: string | null;
  /** ON条件のカラム参照群 */
  onConditionRefs: ColumnRef[];
  /** ON条件の表示用文字列 */
  onConditionText: string;
}

// サブクエリ JOIN 注記 (bd-sql_viz_202604_2-ih7):
// `INNER JOIN (SELECT ...) AS alias ON ...` のように JOIN 対象が
// サブクエリである場合、抽出結果は以下のように FromClause に現れる:
// - `from.subqueries`: alias と内部 ParsedQuery が記録される
// - `from.joins`: 同じ alias を `table` フィールドに入れた JoinInfo も追加される
//   - これにより dependsOn にサブクエリ alias が含まれ、可視化レイヤーで
//     ネスト子 → メインクエリのエッジが描画される

interface SubqueryInfo {
  /** サブクエリのエイリアス */
  alias: string;
  /** サブクエリの内容（ParsedQuery として再帰的に表現） */
  query: ParsedQuery;
}

/** WHERE句 */
interface WhereClause {
  /** 条件内で参照されるカラム群 */
  columnRefs: ColumnRef[];
  /** 条件式の表示用文字列 */
  conditionText: string;
  /** WHERE IN/EXISTS サブクエリ */
  subqueries: SubqueryInfo[];
}

/** GROUP BY句 */
interface GroupByClause {
  /** GROUP BY のカラム参照群 */
  columnRefs: ColumnRef[];
  /** 表示用文字列 */
  expressionText: string;
}

/** HAVING句 */
interface HavingClause {
  /** 条件内で参照されるカラム群 */
  columnRefs: ColumnRef[];
  /** 条件式の表示用文字列 */
  conditionText: string;
}

/** ORDER BY句 */
interface OrderByClause {
  /** ORDER BY のカラム参照群 */
  columnRefs: ColumnRef[];
  /** 表示用文字列 */
  expressionText: string;
}

/** CTE定義 */
interface CteDefinition {
  /** CTE名 */
  name: string;
  /** CTEの内容（ParsedQuery として再帰的に表現） */
  query: ParsedQuery;
}
```

### レスポンス例 — 成功

```json
{
  "queries": [
    {
      "queryId": "550e8400-e29b-41d4-a716-446655440000",
      "rawSql": "CREATE TABLE output AS SELECT a.id, b.name FROM table_a a JOIN table_b b ON a.id = b.id WHERE a.status = 'active'",
      "targetTable": "output",
      "queryType": "ctas",
      "select": {
        "columns": [
          {
            "displayName": "id",
            "sourceTable": "a",
            "sourceColumn": "id",
            "exprType": "column_ref",
            "columnRefs": [{ "table": "a", "column": "id" }],
            "starSourceTable": null
          },
          {
            "displayName": "name",
            "sourceTable": "b",
            "sourceColumn": "name",
            "exprType": "column_ref",
            "columnRefs": [{ "table": "b", "column": "name" }],
            "starSourceTable": null
          }
        ]
      },
      "from": {
        "tables": [
          { "name": "table_a", "alias": "a" }
        ],
        "joins": [
          {
            "joinType": "INNER",
            "table": "table_b",
            "alias": "b",
            "onConditionRefs": [
              { "table": "a", "column": "id" },
              { "table": "b", "column": "id" }
            ],
            "onConditionText": "a.id = b.id"
          }
        ],
        "subqueries": []
      },
      "where": {
        "columnRefs": [{ "table": "a", "column": "status" }],
        "conditionText": "a.status = 'active'",
        "subqueries": []
      },
      "groupBy": null,
      "having": null,
      "orderBy": null,
      "ctes": []
    }
  ],
  "errors": []
}
```

### レスポンス — バリデーションエラー (400)

```json
{
  "error": "VALIDATION_ERROR",
  "message": "SQL文字列が空です",
  "details": {
    "field": "sql",
    "constraint": "required"
  }
}
```

### レスポンス — パースエラー（部分的成功, 200）

複数クエリの入力で一部がパース失敗した場合、成功分は `queries` に、失敗分は `errors` に格納する。

```json
{
  "queries": [
    { "queryId": "...", "rawSql": "SELECT ...", "..." : "..." }
  ],
  "errors": [
    {
      "rawSql": "MERGE INTO ...",
      "message": "MERGE文はサポート対象外です。SELECT文またはCREATE TABLE AS SELECT文を入力してください。",
      "errorType": "unsupported_syntax"
    }
  ]
}
```

### レスポンス — サーバーエラー (500)

```json
{
  "error": "INTERNAL_ERROR",
  "message": "パース処理中に予期しないエラーが発生しました"
}
```

---

## 3. バリデーション

### リクエストバリデーション

| フィールド | ルール | エラーメッセージ |
|---|---|---|
| `sql` | 必須、空文字列不可 | "SQL文字列が空です" |
| `sql` | 最大長 100,000 文字 | "SQL文字列が長すぎます（最大100,000文字）" |
| `dialect` | 指定された場合、`SqlDialect` の値のいずれか | "サポートされていないDB方言です: {value}" |

### バリデーション実装

```typescript
// lib/validators/sqlInputValidator.ts

interface ValidationResult {
  valid: boolean;
  error?: {
    field: string;
    message: string;
    constraint: string;
  };
}

function validateParseRequest(body: unknown): ValidationResult {
  // 1. body が object であること
  // 2. sql フィールドが string であること
  // 3. sql が空文字列でないこと
  // 4. sql が 100,000 文字以内であること
  // 5. dialect が指定されていれば SqlDialect のいずれかであること
}
```

---

## 4. エラーハンドリング方針

### エラー分類

| ステータス | エラー種別 | 説明 |
|---|---|---|
| 200 | (部分的成功) | 複数クエリの一部がパース失敗。成功分は返却、失敗分は `errors` に格納 |
| 400 | `VALIDATION_ERROR` | リクエスト形式が不正 |
| 500 | `INTERNAL_ERROR` | 予期しないサーバーエラー |

### 非対応構文の検出

node-sql-parser がパースエラーを返した場合、エラーメッセージの内容から非対応構文を推定し、ユーザーフレンドリーなメッセージに変換する。

```typescript
// lib/parser/sqlParser.ts

const UNSUPPORTED_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /^MERGE\s/i,
    message: 'MERGE文はサポート対象外です。SELECT文またはCREATE TABLE AS SELECT文を入力してください。'
  },
  {
    pattern: /UNPIVOT/i,
    message: 'UNPIVOT構文はサポート対象外です。'
  },
];
```

### WITH RECURSIVE の前処理

スパイク結果に基づき、`WITH RECURSIVE` を `WITH` に置換する前処理を実施する。

```typescript
function preprocessSql(sql: string): string {
  return sql.replace(/WITH\s+RECURSIVE\b/gi, 'WITH');
}
```

---

## 5. Route Handler 実装方針

```typescript
// app/api/parse/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { parseSql } from '@/lib/parser/sqlParser';
import { extractQueryStructure } from '@/lib/parser/astExtractor';
import { validateParseRequest } from '@/lib/validators/sqlInputValidator';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. リクエストボディ取得
  const body = await request.json();

  // 2. バリデーション
  const validation = validateParseRequest(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: validation.error.message, details: validation.error },
      { status: 400 }
    );
  }

  // 3. SQL分割（セミコロン区切り）
  const { sql, dialect = 'BigQuery' } = body;
  const statements = splitStatements(sql);

  // 4. 各ステートメントをパース
  const queries: ParsedQuery[] = [];
  const errors: ParseError[] = [];

  for (const stmt of statements) {
    try {
      const ast = parseSql(stmt, dialect);
      const parsed = extractQueryStructure(ast, stmt);
      queries.push(parsed);
    } catch (e) {
      errors.push({
        rawSql: stmt,
        message: toUserFriendlyMessage(e, stmt),
        errorType: classifyError(e, stmt),
      });
    }
  }

  // 5. レスポンス
  return NextResponse.json({ queries, errors });
}
```

### SQL文の分割ルール

セミコロンで分割するが、以下に注意:
- 文字列リテラル内のセミコロンは分割しない
- 空白のみのステートメントはスキップ
- コメント（`--` および `/* */`）を適切に処理

---

## 6. セキュリティ考慮事項

| 脅威 | 対策 |
|---|---|
| 巨大入力によるDoS | `sql` フィールドの最大長制限 (100,000文字) |
| SQLインジェクション | パーサーはAST生成のみで、DBへのクエリ実行は行わないため影響なし |
| node-sql-parser の脆弱性 | パースはサーバーサイドの隔離された環境で実行。定期的なパッケージ更新を実施 |
