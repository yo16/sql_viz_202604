# カラム推定のエッジケース

## 関連ドキュメント

- [リネージュデータモデル設計](./lineage-model.md) — [未登録テーブルのカラム推定ロジック](./lineage-model.md#4-未登録テーブルのカラム推定ロジック)
- [API設計](./api-design.md) — [ParsedQuery 型定義](./api-design.md#句の構造化型定義)
- [要件定義 F2-4](../requirements-phase1-2.md) — 未登録テーブルのカラム推定表示

---

## 概要

未登録テーブル（FROM句で参照されるが、SQLが登録されていないテーブル）のカラムは、参照元クエリ内の使用箇所から推定する。本ドキュメントでは、推定ロジックが正しく動作するために対処すべきエッジケースを網羅する。

---

## EC-1: エイリアス → 実テーブル名の逆引き

### ケース

```sql
SELECT a.id, a.name
FROM some_table AS a
JOIN other_table AS b ON a.id = b.ref_id
```

### 問題

カラム参照 `a.id` の `a` はエイリアスであり、実テーブル名は `some_table` である。推定カラムは実テーブル名に紐付ける必要がある。

### 解決策

FROM句からエイリアスマップを構築し、カラム参照のテーブル部分をエイリアスマップで解決する。

```typescript
// エイリアスマップ: { a: 'some_table', b: 'other_table' }
function buildAliasMap(from: FromClause): Map<string, string> {
  const map = new Map<string, string>();

  for (const table of from.tables) {
    if (table.alias) {
      map.set(table.alias, table.name);
    }
    map.set(table.name, table.name);
  }

  for (const join of from.joins) {
    if (join.alias) {
      map.set(join.alias, join.table);
    }
    map.set(join.table, join.table);
  }

  return map;
}
```

### テストケース

| SQL | カラム参照 | 期待結果 |
|---|---|---|
| `SELECT a.id FROM tbl AS a` | `a.id` | `tbl.id` |
| `SELECT tbl.id FROM tbl` | `tbl.id` | `tbl.id` |
| `SELECT a.x FROM tbl1 a JOIN tbl2 b ON a.id = b.id` | `a.x` → `tbl1.x`, `b.id` → `tbl2.id` | 正しくテーブルに帰属 |

---

## EC-2: FROM が1テーブルの場合のプレフィックスなしカラム

### ケース

```sql
SELECT id, name, status
FROM users
WHERE status = 'active'
```

### 問題

カラム参照 `id`, `name`, `status` にテーブルプレフィックスがないが、FROM が1テーブルのみなので帰属先は一意に決まる。

### 解決策

FROM句（テーブル + JOIN の合計）が1テーブルのみの場合、プレフィックスなしのカラム参照はそのテーブルに帰属させる。

```typescript
function resolveTableForRef(
  ref: ColumnRef,
  aliasMap: Map<string, string>,
  fromTableCount: number,
  from: FromClause
): string | null {
  // プレフィックスありの場合
  if (ref.table) {
    return aliasMap.get(ref.table) ?? ref.table;
  }

  // プレフィックスなし + FROM 1テーブル
  if (fromTableCount === 1) {
    const singleTable = from.tables[0];
    return singleTable?.name ?? null;
  }

  // プレフィックスなし + 複数テーブル → 不明
  return null;
}
```

### テストケース

| SQL | カラム参照 | fromTableCount | 期待結果 |
|---|---|---|---|
| `SELECT id FROM users` | `id` (no prefix) | 1 | `users.id` |
| `SELECT id FROM users WHERE name = 'a'` | `id`, `name` | 1 | 両方 `users` |
| `SELECT id FROM users u` | `id` (no prefix) | 1 | `users.id` |

---

## EC-3: 複数テーブルでプレフィックスなしの場合

### ケース

```sql
SELECT a.id, name
FROM users a
JOIN orders b ON a.id = b.user_id
```

### 問題

`name` にプレフィックスがなく、FROM に複数テーブル（`users`, `orders`）がある。`name` がどちらのテーブルに属するか判別できない。

### 解決策

**収集しない**。要件定義 F2-4 に明記されている通り、複数テーブルでプレフィックスなしの場合は不明扱いとする。

```typescript
// fromTableCount > 1 && ref.table === null → return null（収集しない）
```

### テストケース

| SQL | カラム参照 | fromTableCount | 期待結果 |
|---|---|---|---|
| `SELECT a.id, name FROM t1 a JOIN t2 b ON ...` | `name` (no prefix) | 2 | `null`（収集しない） |
| `SELECT a.id, b.name FROM t1 a JOIN t2 b ON ...` | `a.id`, `b.name` | 2 | `t1.id`, `t2.name` |

---

## EC-4: SELECT * EXCEPT の扱い

### ケース (BigQuery固有)

```sql
SELECT * EXCEPT(internal_id, debug_flag)
FROM source_table
```

### 問題

`SELECT * EXCEPT` は全カラムから指定カラムを除外する構文。上流テーブルのカラムが確定していれば除外可能だが、未登録テーブルの場合は全カラムが不明。

### 解決策

1. **上流テーブルが登録済みの場合**: 上流テーブルのカラムから EXCEPT 指定のカラムを除外して伝播
2. **上流テーブルが未登録の場合**: SELECT * と同様に扱い、EXCEPT 情報はメタデータとして保持。上流テーブルが後から登録された際に EXCEPT 除外を適用

```typescript
interface StarColumn extends ColumnNode {
  /** SELECT * EXCEPT の除外カラム名 */
  exceptColumns: string[];
}

function expandStarExcept(
  targetTable: TableNode,
  sourceTable: TableNode,
  exceptColumns: string[]
): void {
  for (const [colName, sourceCol] of sourceTable.columns) {
    // EXCEPT リストに含まれるカラムはスキップ
    if (exceptColumns.includes(colName)) continue;

    targetTable.columns.set(colName, {
      columnName: colName,
      tableId: targetTable.id,
      certainty: 'propagated',
      dependencies: [{
        sourceTableId: sourceTable.id,
        sourceColumn: colName,
        type: 'star',
      }],
      isFromStar: true,
      exprType: 'column_ref',
    });
  }
}
```

### テストケース

| SQL | 上流カラム | 期待結果 |
|---|---|---|
| `SELECT * EXCEPT(x) FROM t` | `[a, b, x]` | `[a, b]` が伝播 |
| `SELECT * EXCEPT(x) FROM t` (未登録) | 不明 | EXCEPT 情報を保持。後で解決 |

---

## EC-5: ネストしたサブクエリ内のカラム

### ケース

```sql
SELECT *
FROM (
  SELECT a.id, a.name
  FROM raw_data a
  WHERE a.status = 'active'
) AS filtered
```

### 問題

サブクエリ内のカラム参照 `a.id`, `a.name` は、外側クエリのスコープではなくサブクエリ自身の FROM 句の `raw_data` に帰属する。スコープの分離が必要。

### 解決策

サブクエリは独立した `ParsedQuery` としてパースされるため、エイリアスマップはサブクエリごとに個別に構築する。外側クエリとサブクエリのスコープは混在しない。

```
外側クエリ:
  FROM: filtered (= サブクエリ)
  エイリアスマップ: { filtered: サブクエリID }

サブクエリ (filtered):
  FROM: raw_data AS a
  エイリアスマップ: { a: 'raw_data' }
  ← このスコープで a.id, a.name を解決
```

### テストケース

| SQL | スコープ | カラム参照 | 期待結果 |
|---|---|---|---|
| `SELECT * FROM (SELECT a.id FROM raw a) sub` | サブクエリ内 | `a.id` | `raw.id` |
| `SELECT sub.id FROM (SELECT a.id FROM raw a) sub` | 外側クエリ | `sub.id` | サブクエリ `filtered` の `id` |

---

## EC-6: CTE 内のカラム参照

### ケース

```sql
WITH monthly AS (
  SELECT user_id, SUM(amount) AS total
  FROM transactions
  GROUP BY user_id
)
SELECT m.user_id, m.total
FROM monthly m
```

### 問題

CTE `monthly` は一時テーブルとして扱われる。外側クエリの `m.user_id` は CTE のカラムを参照しており、CTE の FROM 句の `transactions` テーブルを間接的に参照している。

### 解決策

CTE は親テーブル内のスコープで `TableNode` として登録される。外側クエリの FROM で CTE 名を参照した場合、CTE の TableNode を参照先とする。

```typescript
// CTE の登録
for (const cte of query.ctes) {
  const cteTableNode = buildTableNodeFromParsedQuery(cte.query);
  cteTableNode.id = `${parentTableId}::${cte.name}`;
  cteTableNode.name = cte.name;
  // 親テーブルの ctes 配列に追加
}

// 外側クエリの FROM で CTE 名を参照した場合のエイリアスマップ
// CTE 名 → CTE の TableNode ID にマッピング
```

### テストケース

| SQL | スコープ | カラム参照 | 期待結果 |
|---|---|---|---|
| `WITH c AS (SELECT id FROM t) SELECT c.id FROM c` | 外側 | `c.id` | CTE `c` の `id` |
| `WITH c AS (SELECT id FROM t) SELECT id FROM c` | 外側 (FROM 1テーブル) | `id` | CTE `c` の `id` |

---

## EC-7: 同名カラムの衝突

### ケース

```sql
SELECT a.id, b.id
FROM users a
JOIN orders b ON a.id = b.user_id
```

### 問題

`a.id` と `b.id` は同じカラム名 `id` だが異なるテーブルに属する。推定結果で衝突しないよう、テーブルごとに分離して管理する必要がある。

### 解決策

カラムは `TableNode.columns` マップ（テーブルごと）に格納されるため、テーブルが異なれば同名カラムは衝突しない。ただし、SELECT句のエイリアスがない場合、出力カラム名が重複する可能性がある。

```
出力テーブルのカラム:
  id (from users) — 表示名: id, sourceTable: users
  id (from orders) — 表示名: id, sourceTable: orders

→ 出力テーブルでは displayName に sourceTable を付加して区別
  例: users.id, orders.id
```

### テストケース

| SQL | 期待結果 |
|---|---|
| `SELECT a.id, b.id FROM t1 a JOIN t2 b ON ...` | 出力に `id` が2つ（異なる sourceTable） |
| `SELECT a.id AS user_id, b.id AS order_id FROM ...` | `user_id` (from t1), `order_id` (from t2) |

---

## EC-8: UNNEST のカラム参照

### ケース (BigQuery固有)

```sql
SELECT u.id, item
FROM users u, UNNEST(u.items) AS item
```

### 問題

`UNNEST` は配列を展開して仮想テーブルを生成する。`item` は `UNNEST` から生成された仮想カラムであり、実テーブルのカラムではない。

### 解決策

UNNEST のエイリアスをエイリアスマップに追加する。UNNEST の元となる配列カラム（`u.items`）への依存関係を記録する。

```typescript
// UNNEST のエイリアス処理
// UNNEST(u.items) AS item → item は u.items 由来の仮想テーブル
// エイリアスマップ: { item: '__unnest__u.items' }
// 依存関係: item → users.items (type: 'expression')
```

### テストケース

| SQL | カラム参照 | 期待結果 |
|---|---|---|
| `SELECT item FROM t, UNNEST(t.arr) AS item` | `item` | `t.arr` 由来として記録 |
| `SELECT item.x FROM t, UNNEST(t.arr) AS item` | `item.x` | `t.arr` 由来の構造体アクセスとして記録 |

---

## エッジケース対応優先度

| ID | エッジケース | 優先度 | フェーズ |
|---|---|---|---|
| EC-1 | エイリアス逆引き | 高 | フェーズ2 必須 |
| EC-2 | 1テーブルのプレフィックスなし | 高 | フェーズ2 必須 |
| EC-3 | 複数テーブルのプレフィックスなし | 高 | フェーズ2 必須 |
| EC-4 | SELECT * EXCEPT | 中 | フェーズ2 |
| EC-5 | ネストしたサブクエリ | 高 | フェーズ1-2 |
| EC-6 | CTE 内のカラム参照 | 高 | フェーズ1-2 |
| EC-7 | 同名カラムの衝突 | 中 | フェーズ2 |
| EC-8 | UNNEST のカラム参照 | 低 | フェーズ2 後半 |
