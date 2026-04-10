# スパイク3: カラムリネージュ データモデル検証 — 結論

## 結論

**カラムレベルリネージュのデータモデルとアルゴリズムは実現可能。** node-sql-parserのASTから必要な情報を抽出でき、SELECT *の伝播・未登録テーブルのカラム推定も動作確認済み。

## データモデル

### 3層構造

```
TableNode
  ├── name: string
  ├── isRegistered: boolean
  └── columns: Map<string, ColumnNode>

ColumnNode
  ├── tableName: string
  ├── columnName: string
  ├── certainty: 'confirmed' | 'inferred' | 'propagated'
  └── dependencies: ColumnDependency[]

ColumnDependency
  ├── sourceTable: string
  ├── sourceColumn: string
  └── type: DependencyType
```

### 依存種別 (DependencyType)

| 種別 | 意味 | 例 |
|---|---|---|
| `direct` | 単純カラム参照 | `SELECT a.id` |
| `expression` | 式内のカラム参照 | `SELECT a.x + a.y AS total` |
| `condition` | WHERE/HAVING等の条件参照 | `WHERE a.status = 'active'` |
| `aggregate` | 集約関数内の参照 | `SUM(a.amount)` |
| `join_key` | JOIN ON条件の参照 | `ON a.id = b.user_id` |
| `star` | SELECT *による伝播 | `SELECT * FROM table_b` |

### カラムの確度 (Certainty)

| 確度 | 意味 |
|---|---|
| `confirmed` | パース結果から確定したカラム |
| `inferred` | 未登録テーブルから推定されたカラム |
| `propagated` | SELECT *により上流テーブルから伝播されたカラム |

## アルゴリズム検証結果

### 1. ASTからのカラム依存関係抽出 ✅

node-sql-parserのAST構造:
- `columns[].expr.type === 'column_ref'` → `table` と `column` が分離
- `columns[].expr.type === 'aggr_func'` → `args.expr` にカラム参照
- `from[].as` → エイリアスマップ構築に利用
- `column === '*'` → SELECT * の検出

extractColumnRef + collectColumnRefs の再帰走査で、式・関数・CASE式内のカラム参照を網羅的に収集可能。

### 2. SELECT * 伝播 ✅

アルゴリズム:
1. テーブル依存関係からトポロジカルソート
2. ソート順（上流→下流）で各テーブルを処理
3. `*` カラムを検出したら、ソーステーブルの全カラムに展開
4. `t.*` の場合はそのテーブルのカラムのみ伝播

循環依存の検出: トポロジカルソートで順序が決まらないノードがあれば警告。

### 3. 未登録テーブルのカラム推定 ✅

収集対象:
- SELECT句のカラム参照
- WHERE句の条件参照
- JOIN ON条件の参照
- GROUP BY のカラム参照

テーブル帰属ルール:
- テーブルプレフィックスあり → エイリアスマップで解決
- FROM 1テーブル + プレフィックスなし → そのテーブルに帰属
- FROM 複数テーブル + プレフィックスなし → 収集しない（要件通り）

## 設計への推奨事項

### 1. パイプライン構成

```
SQLテキスト
  → [パース] node-sql-parser → AST
  → [抽出] extractSelectDependencies → カラム依存関係
  → [推定] inferUnregisteredColumns → 未登録テーブルのカラム
  → [伝播] propagateSelectStar → SELECT * 解決
  → [グラフ] TableNode/ColumnNode/ColumnDependency
```

処理順: パース → テーブル登録 → カラム抽出 → 未登録推定 → SELECT *伝播

### 2. テーブル追加・削除時の再計算

未登録テーブルが後から登録された場合:
- 全テーブルの依存グラフを再構築するのが最もシンプル
- 差分更新も可能だが、初期実装ではフル再計算で十分（数十テーブル規模なら <100ms）

### 3. 未検証の課題（本実装で対応）

- CASE式の分岐ごとの依存追跡（現状は全分岐のカラムをフラットに収集）
- ウィンドウ関数のPARTITION BY / ORDER BYのカラム追跡
- CTE間の依存関係（CTEをテーブルとして扱えば既存ロジックで対応可能）
- SELECT t.* の伝播（データモデルにsourceTableフィールドを追加済み）
