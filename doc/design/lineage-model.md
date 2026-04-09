# リネージュデータモデル設計

## 関連ドキュメント

- [全体アーキテクチャ設計](./architecture.md)
- [API設計](./api-design.md) — [ParsedQuery 型定義](./api-design.md#句の構造化型定義)
- [カラム推定エッジケース](./column-inference-edge-cases.md)
- [コンポーネント設計](./component-design.md) — [Zustand ストア設計](./component-design.md#6-状態管理--zustand-ストア設計)
- [要件定義](../requirements-phase1-2.md)
- [スパイク: カラムリネージュ データモデル検証](../spikes/column-lineage-model/findings.md)

---

## 1. 型定義

### 1.1 TableNode — テーブルノード

リネージュグラフの頂点。1つのクエリ（SELECT / CTAS）が1つの TableNode に対応する。

```typescript
// types/lineage.ts

interface TableNode {
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
```

### 1.2 ColumnNode — カラムノード

テーブル内の1カラムを表す。

```typescript
// types/lineage.ts

interface ColumnNode {
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
```

### 1.3 ColumnDependency — カラム依存関係

カラム間の依存を表すエッジ。

```typescript
// types/lineage.ts

interface ColumnDependency {
  /** 依存元テーブルのID */
  sourceTableId: string;
  /** 依存元カラム名 */
  sourceColumn: string;
  /** 依存の種別 */
  type: DependencyType;
}
```

### 1.4 DependencyType — 依存種別

```typescript
// types/lineage.ts

type DependencyType =
  | 'direct'       // 単純カラム参照: SELECT a.id
  | 'expression'   // 式内カラム参照: SELECT a.x + a.y AS total
  | 'condition'    // WHERE/HAVING条件: WHERE a.status = 'active'
  | 'aggregate'    // 集約関数内: SUM(a.amount)
  | 'join_key'     // JOIN ON条件: ON a.id = b.user_id
  | 'star';        // SELECT *による伝播: SELECT * FROM table_b
```

### 1.5 Certainty — カラムの確度

```typescript
// types/lineage.ts

type Certainty =
  | 'confirmed'    // パース結果から確定
  | 'inferred'     // 未登録テーブルから推定（F2-4）
  | 'propagated';  // SELECT * から伝播（F2-5）
```

### 1.6 補助型

```typescript
// types/lineage.ts

interface CteNode {
  /** CTE名 */
  name: string;
  /** CTE内部のTableNode */
  tableNode: TableNode;
}

interface SubqueryNode {
  /** エイリアス名（FROMサブクエリ）または "[サブクエリ]"（WHERE IN/EXISTS） */
  alias: string;
  /** サブクエリ内部のTableNode */
  tableNode: TableNode;
}

interface ClauseInfo {
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

type SqlDialect = 'BigQuery' | 'PostgreSQL' | 'MySQL' | 'SQLite';
```

---

## 2. AST → リネージュグラフ変換パイプライン

対応機能要件: F1-2, F1-3, F2-1, F2-3, F2-4, F2-5

### パイプライン全体図

```
入力: ParsedQuery[] (APIレスポンス)
  │
  ▼
[ステップ1] registerTables
  │  ParsedQuery → TableNode 生成
  │  未登録テーブル → UnresolvedTableNode 生成
  ▼
[ステップ2] buildColumnDependencies
  │  各 TableNode のカラム依存関係を構築
  │  エイリアス → 実テーブル名の解決
  ▼
[ステップ3] inferUnregisteredColumns
  │  未登録テーブルのカラムを推定
  │  詳細: column-inference-edge-cases.md
  ▼
[ステップ4] propagateSelectStar
  │  SELECT * のカラムを上流から伝播
  │  トポロジカル順で再帰処理
  ▼
出力: Map<string, TableNode> (完成したリネージュグラフ)
```

### ステップ1: registerTables

**CTE名は未登録扱いしない** (bd-sql_viz_202604_2-r11):
トップレベルクエリの FROM/JOIN 参照が CTE 名と一致する場合、`createUnresolvedTableNode`
を呼ばない。CTE は親 TableNode の `ctes` 配列にネスト構造として保持され、
グローバル `tables` マップには登録されない。そのため単純に `!tables.has(name)`
で判定すると CTE 参照も未登録扱いされてしまう。クエリごとに `cteNames` 集合を
作り、FROM/JOIN チェックで skip する。

**CTE / サブクエリ内部の FROM 参照も再帰的に walk する** (bd-sql_viz_202604_2-uqr):
以前は registerTables がトップレベルの FROM/JOIN しか巡回しておらず、CTE 内部
から参照される外部テーブル (例: `WITH monthly_sales AS (SELECT ... FROM orders)`
の `orders`) が unresolved として登録されなかった。
`collectUnresolvedRefs(query, ancestorScope, tables)` というヘルパーで
ParsedQuery を再帰的に walk し、各スコープで利用可能な名前 (先祖スコープの
CTE 名 + そのレベルの CTE 名 + FROM/WHERE サブクエリの alias) の集合を維持
しつつ、FROM/JOIN 参照がその集合に含まれない場合に unresolved として登録する。
SQL の lexical scoping に従い、内側のスコープは外側の名前を参照可能。

```typescript
// lib/lineage/buildLineageGraph.ts

/**
 * ParsedQuery 群から TableNode を生成し、マップに登録する。
 * FROM/JOIN で参照されるテーブルがまだ存在しなければ未登録テーブルとして追加。
 */
function registerTables(
  queries: ParsedQuery[],
  existingTables: Map<string, TableNode>
): Map<string, TableNode> {
  const tables = new Map(existingTables);

  for (const query of queries) {
    // 1. メインテーブルの登録
    const tableId = query.targetTable ?? query.queryId;
    const tableNode = createTableNode(query);
    tables.set(tableId, tableNode);

    // 2. FROM/JOIN で参照されるテーブルの未登録チェック
    for (const fromTable of query.from.tables) {
      if (!tables.has(fromTable.name)) {
        tables.set(fromTable.name, createUnresolvedTableNode(fromTable.name));
      }
    }
    for (const join of query.from.joins) {
      if (!tables.has(join.table)) {
        tables.set(join.table, createUnresolvedTableNode(join.table));
      }
    }

    // 3. CTE の登録（親テーブル内のスコープで管理）
    for (const cte of query.ctes) {
      // CTE は親テーブル内のネスト構造として登録
      // CTE名は親テーブルIDとスコープで一意化
    }
  }

  return tables;
}

function createUnresolvedTableNode(name: string): TableNode {
  return {
    id: name,
    name: name,
    displayTitle: `[未登録] ${name}`,
    isRegistered: false,
    queryType: 'unresolved',
    queryId: null,
    columns: new Map(),
    dependsOn: new Set(),
    ctes: [],
    fromSubqueries: [],
    whereSubqueries: [],
    clauses: { select: { columns: [] }, from: { tables: [], joins: [] }, where: null, groupBy: null, having: null, orderBy: null },
  };
}
```

### ステップ1.5: createTableNode 内でのカラム populate (bd-sql_viz_202604_2-2ml)

`createTableNode` は CTE / FROMサブクエリ / WHEREサブクエリの内部 ParsedQuery
からも再帰的に呼ばれる。これら**ネスト内部の TableNode** にもカラム情報が必要
（QueryBoxNode を detail で開いたとき SELECT clauseBox を生成するため）。

そのため `createTableNode` 自体が `query.select.columns` から `columns: Map<string, ColumnNode>`
を populate する。`buildAliasMap` と `createColumnNode` を流用する。

```typescript
function createTableNode(query: ParsedQuery): TableNode {
  // ... ctes / fromSubqueries / whereSubqueries は再帰的に createTableNode で生成 ...

  // bd-sql_viz_202604_2-2ml: カラム情報を即時 populate
  // （以前は new Map() で空にし、buildColumnDependencies に任せていたが、
  //   それはトップレベル queries しか巡回しないため、ネスト内部のカラムが
  //   一切設定されず CTE 内部 QueryBox が空表示になっていた）
  const aliasMap = buildAliasMap(query.from);
  const columns = new Map<string, ColumnNode>();
  for (const col of query.select.columns) {
    const columnNode = createColumnNode(col, tableId, aliasMap);
    columns.set(columnNode.columnName, columnNode);
  }

  return { id: tableId, ..., columns, ctes, fromSubqueries, whereSubqueries, ... };
}
```

ステップ2 (`buildColumnDependencies`) はトップレベルクエリのカラムを同一データで
上書きする形になり実質 no-op だが、後方互換のため残している。

### ステップ2: buildColumnDependencies

```typescript
// lib/lineage/buildLineageGraph.ts

/**
 * 各テーブルのカラム依存関係を構築する。
 * エイリアスマップを使って、カラム参照を実テーブルに解決する。
 */
function buildColumnDependencies(
  tables: Map<string, TableNode>,
  queries: ParsedQuery[]
): Map<string, TableNode> {
  for (const query of queries) {
    const tableId = query.targetTable ?? query.queryId;
    const table = tables.get(tableId);
    if (!table) continue;

    // エイリアスマップの構築
    const aliasMap = buildAliasMap(query.from);

    // SELECT句のカラム依存
    for (const col of query.select.columns) {
      const columnNode = createColumnNode(col, tableId, aliasMap);
      table.columns.set(columnNode.columnName, columnNode);
    }
  }

  return tables;
}

/**
 * FROM句からエイリアス → 実テーブル名のマップを構築する。
 */
function buildAliasMap(from: FromClause): Map<string, string> {
  const map = new Map<string, string>();

  for (const table of from.tables) {
    if (table.alias) {
      map.set(table.alias, table.name);
    }
    // エイリアスなしの場合もテーブル名で自己マップ
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

/**
 * SelectColumn から ColumnNode を生成する。
 */
function createColumnNode(
  col: SelectColumn,
  tableId: string,
  aliasMap: Map<string, string>
): ColumnNode {
  const dependencies: ColumnDependency[] = [];

  for (const ref of col.columnRefs) {
    const resolvedTable = ref.table ? (aliasMap.get(ref.table) ?? ref.table) : null;
    if (resolvedTable) {
      dependencies.push({
        sourceTableId: resolvedTable,
        sourceColumn: ref.column,
        type: classifyDependencyType(col.exprType),
      });
    }
  }

  return {
    columnName: col.displayName,
    tableId,
    certainty: 'confirmed',
    dependencies,
    isFromStar: col.exprType === 'star' || col.exprType === 'table_star',
    exprType: col.exprType,
  };
}
```

### ステップ3: inferUnregisteredColumns

詳細は [カラム推定エッジケース](./column-inference-edge-cases.md) を参照。

```typescript
// lib/lineage/inferUnregisteredColumns.ts

/**
 * 未登録テーブルのカラムを、参照元クエリの情報から推定する。
 *
 * 対応機能要件: F2-4
 * 収集対象: SELECT句、JOIN ON条件、集約関数、CASE式、関数引数
 */
function inferUnregisteredColumns(
  tables: Map<string, TableNode>,
  queries: ParsedQuery[]
): Map<string, TableNode> {
  for (const query of queries) {
    const aliasMap = buildAliasMap(query.from);
    const fromTableCount = query.from.tables.length + query.from.joins.length;

    // 全カラム参照を収集
    const allRefs = collectAllColumnRefs(query);

    for (const ref of allRefs) {
      const resolvedTable = resolveTableForRef(ref, aliasMap, fromTableCount, query.from);
      if (!resolvedTable) continue;

      const table = tables.get(resolvedTable);
      if (!table || table.isRegistered) continue;

      // 未登録テーブルにカラムを追加
      if (!table.columns.has(ref.column)) {
        table.columns.set(ref.column, {
          columnName: ref.column,
          tableId: resolvedTable,
          certainty: 'inferred',
          dependencies: [],
          isFromStar: false,
          exprType: 'column_ref',
        });
      }
    }
  }

  return tables;
}
```

### ステップ4: propagateSelectStar

```typescript
// lib/lineage/propagateSelectStar.ts

/**
 * SELECT * のカラムを上流テーブルから伝播する。
 *
 * 対応機能要件: F2-5
 * 処理順: トポロジカルソート順（上流 → 下流）
 */
function propagateSelectStar(
  tables: Map<string, TableNode>
): Map<string, TableNode> {
  // 1. テーブル間の依存関係からトポロジカルソート
  const sortedTableIds = topologicalSort(tables);

  // 2. ソート順（上流→下流）で各テーブルを処理
  for (const tableId of sortedTableIds) {
    const table = tables.get(tableId);
    if (!table) continue;

    // 3. SELECT * を含むカラムを検出
    const starColumns = Array.from(table.columns.values())
      .filter((col) => col.isFromStar);

    for (const starCol of starColumns) {
      if (starCol.exprType === 'star') {
        // SELECT * : FROM の全テーブルのカラムを伝播
        expandStar(table, tables);
      } else if (starCol.exprType === 'table_star') {
        // SELECT t.* : 特定テーブルのカラムのみ伝播
        const sourceTableId = starCol.dependencies[0]?.sourceTableId;
        if (sourceTableId) {
          expandTableStar(table, sourceTableId, tables);
        }
      }
    }
  }

  return tables;
}
```

---

## 3. SELECT * 伝播アルゴリズム

対応機能要件: F2-5

### 3.1 全体フロー

```
1. トポロジカルソートで処理順を決定
   src_a (Layer 0) → mid_b (Layer 1) → out_c (Layer 2)

2. 各テーブルの SELECT * を上流→下流の順で展開

3. 例:
   src_a: columns = [id, name, status]
   mid_b: SELECT * FROM src_a WHERE status = 'active'
     → mid_b.columns = [id*, name*, status*]  (* = propagated)
   out_c: SELECT * FROM mid_b
     → out_c.columns = [id*, name*, status*]
```

### 3.2 expandStar — SELECT * の展開

```typescript
/**
 * SELECT * を展開し、FROM の全テーブルのカラムを伝播する。
 */
function expandStar(
  targetTable: TableNode,
  allTables: Map<string, TableNode>
): void {
  // * カラムを削除
  targetTable.columns.delete('*');

  // FROM で参照する全テーブルのカラムを追加
  for (const sourceTableId of targetTable.dependsOn) {
    const sourceTable = allTables.get(sourceTableId);
    if (!sourceTable) continue;

    for (const [colName, sourceCol] of sourceTable.columns) {
      if (!targetTable.columns.has(colName)) {
        targetTable.columns.set(colName, {
          columnName: colName,
          tableId: targetTable.id,
          certainty: 'propagated',
          dependencies: [{
            sourceTableId: sourceTableId,
            sourceColumn: colName,
            type: 'star',
          }],
          isFromStar: true,
          exprType: 'column_ref',
        });
      }
    }
  }
}
```

### 3.3 expandTableStar — SELECT t.* の展開

```typescript
/**
 * SELECT t.* を展開し、指定テーブルのカラムのみ伝播する。
 */
function expandTableStar(
  targetTable: TableNode,
  sourceTableId: string,
  allTables: Map<string, TableNode>
): void {
  const sourceTable = allTables.get(sourceTableId);
  if (!sourceTable) return;

  // t.* カラムを削除
  targetTable.columns.delete(`${sourceTableId}.*`);

  // 指定テーブルのカラムのみ追加
  for (const [colName, sourceCol] of sourceTable.columns) {
    if (!targetTable.columns.has(colName)) {
      targetTable.columns.set(colName, {
        columnName: colName,
        tableId: targetTable.id,
        certainty: 'propagated',
        dependencies: [{
          sourceTableId: sourceTableId,
          sourceColumn: colName,
          type: 'star',
        }],
        isFromStar: true,
        exprType: 'column_ref',
      });
    }
  }
}
```

### 3.4 トポロジカルソート

```typescript
/**
 * テーブル間の依存関係からトポロジカルソートを実行する。
 * 循環依存がある場合は警告を返す。
 */
function topologicalSort(
  tables: Map<string, TableNode>
): string[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();  // 循環検出用
  const sorted: string[] = [];
  const warnings: string[] = [];

  function visit(tableId: string) {
    if (visited.has(tableId)) return;
    if (visiting.has(tableId)) {
      warnings.push(`循環依存を検出: ${tableId}`);
      return;
    }

    visiting.add(tableId);

    const table = tables.get(tableId);
    if (table) {
      for (const depId of table.dependsOn) {
        visit(depId);
      }
    }

    visiting.delete(tableId);
    visited.add(tableId);
    sorted.push(tableId);
  }

  for (const tableId of tables.keys()) {
    visit(tableId);
  }

  return sorted;
}
```

---

## 4. 未登録テーブルのカラム推定ロジック

対応機能要件: F2-4

### 4.1 収集対象

| 収集場所 | 例 |
|---|---|
| SELECT句のカラム参照 | `SELECT a.id, a.name` |
| JOIN ON条件のカラム参照 | `ON a.id = b.user_id` |
| WHERE句のカラム参照 | `WHERE a.status = 'active'` |
| GROUP BY のカラム参照 | `GROUP BY a.category` |
| HAVING句のカラム参照 | `HAVING COUNT(a.id) > 5` |
| 集約関数内のカラム参照 | `SUM(a.amount)` |
| CASE式内のカラム参照 | `CASE WHEN a.type = 1 THEN ...` |
| 関数引数のカラム参照 | `COALESCE(a.value, 0)` |

### 4.2 テーブル帰属ルール

```typescript
/**
 * カラム参照がどのテーブルに帰属するかを解決する。
 */
function resolveTableForRef(
  ref: ColumnRef,
  aliasMap: Map<string, string>,
  fromTableCount: number,
  from: FromClause
): string | null {
  if (ref.table) {
    // テーブルプレフィックスあり → エイリアスマップで解決
    return aliasMap.get(ref.table) ?? ref.table;
  }

  if (fromTableCount === 1) {
    // FROM が1テーブルのみ → そのテーブルに帰属
    return from.tables[0]?.name ?? null;
  }

  // 複数テーブルでプレフィックスなし → 不明（収集しない）
  return null;
}
```

エッジケースの詳細は [カラム推定エッジケース](./column-inference-edge-cases.md) を参照。

---

## 5. テーブル追加時のグラフ再構築フロー

対応機能要件: F2-2

### 5.1 フロー

```
[新しいSQLが登録される]
    │
    ▼
1. 新 ParsedQuery から TableNode 生成
    │
    ▼
2. 既存の未登録テーブルとの照合
   - 新テーブルの targetTable 名が既存の未登録テーブル名と一致するか
   - 一致した場合:
     a. 未登録テーブルの inferred カラムを保持（参考情報として）
     b. 新テーブルの confirmed カラムで置換
     c. isRegistered を true に更新
     d. queryType を 'ctas' または 'select' に更新
    │
    ▼
3. 全テーブルで inferUnregisteredColumns を再実行
   - 新テーブルが FROM で参照する未登録テーブルの推定
    │
    ▼
4. 全テーブルで propagateSelectStar を再実行
   - 新テーブルのカラムが確定したことで、下流の SELECT * が解決される可能性
    │
    ▼
5. flowStore.syncFromLineage で React Flow ノード/エッジを再生成
```

### 5.2 パフォーマンス見積もり

- 初期実装ではフル再計算（ステップ3, 4を全テーブルに対して実行）
- 数十テーブル規模では <100ms で完了する見込み（スパイク検証結果）
- 将来的にテーブル数が増加した場合、差分更新の最適化を検討

---

## 6. リネージュ追跡（ハイライト）

対応機能要件: F2-3

### 6.1 アルゴリズム

カラムクリック時に上流方向へ依存関係を再帰的に辿り、パスを収集する。

```typescript
/**
 * 指定カラムから上流方向にリネージュを追跡し、
 * ハイライトすべきカラムパスを返す。
 */
function traceLineage(
  tableId: string,
  columnName: string,
  tables: Map<string, TableNode>
): LineagePath[] {
  const paths: LineagePath[] = [];
  const visited = new Set<string>();

  function trace(currentTableId: string, currentColumn: string) {
    const key = `${currentTableId}.${currentColumn}`;
    if (visited.has(key)) return;
    visited.add(key);

    const table = tables.get(currentTableId);
    if (!table) return;

    const column = table.columns.get(currentColumn);
    if (!column) return;

    for (const dep of column.dependencies) {
      paths.push({
        sourceTableId: dep.sourceTableId,
        sourceColumn: dep.sourceColumn,
        targetTableId: currentTableId,
        targetColumn: currentColumn,
        dependencyType: dep.type,
      });

      // 再帰的に上流を追跡
      trace(dep.sourceTableId, dep.sourceColumn);
    }
  }

  trace(tableId, columnName);
  return paths;
}

interface LineagePath {
  sourceTableId: string;
  sourceColumn: string;
  targetTableId: string;
  targetColumn: string;
  dependencyType: DependencyType;
}
```

### 6.2 ハイライト表示

- 追跡パスに含まれるカラムの `isHighlighted` を `true` に設定
- 追跡パスに含まれるエッジの `isHighlighted` を `true` に設定
- 関連しないノード/エッジは opacity を下げて背景化
