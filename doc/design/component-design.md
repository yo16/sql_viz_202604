# コンポーネント設計

## 関連ドキュメント

- [全体アーキテクチャ設計](./architecture.md)
- [レイアウトエンジン設計](./layout-engine.md)
- [リネージュデータモデル設計](./lineage-model.md)
- [API設計](./api-design.md)
- [要件定義](../requirements-phase1-2.md)

---

## 1. コンポーネントツリー

```
app/layout.tsx (Server Component)
└── app/page.tsx (Server Component)
    └── MainView ("use client") ─────────── アプリケーションルート
        ├── Header
        │   ├── DialectSelector                 DB方言切替 [F1-1]
        │   └── ResetButton                     全リセット [F1-7]
        │
        ├── SqlInputPanel                       SQL入力パネル [F1-1]
        │   ├── <textarea>                      直接入力
        │   └── FileDropZone                    ファイルD&D [F1-1]
        │
        └── FlowCanvas                          React Flow メインキャンバス [F1-3]
            ├── QueryBoxNode (カスタムノード)    クエリbox [F1-3, F1-5, F1-6]
            │   ├── ClauseBoxNode               句box [F1-3]
            │   │   └── ColumnItemNode          カラム項目 [F1-3, F2-3]
            │   └── (ネスト: QueryBoxNode)      CTE/サブクエリ [F1-8]
            │
            ├── UnresolvedBoxNode (カスタムノード)  未登録テーブル [F2-2]
            │   └── ColumnItemNode              推定カラム [F2-4]
            │
            └── LineageEdge (カスタムエッジ)     テーブル間依存 [F2-1, F2-3]
```

---

## 2. コンポーネント仕様

### 2.1 MainView

アプリケーション全体を管理するクライアントコンポーネント。

```typescript
// components/MainView.tsx
"use client";

interface MainViewProps {}

// 責務:
// - SqlInputPanel と FlowCanvas のレイアウト管理
// - レイアウトは左右分割（入力パネル: 左、キャンバス: 右）
// - 入力パネルは折りたたみ可能（キャンバス領域を最大化）
```

**スタイリング**: CSS Modules で左右パネルのレイアウトを制御。入力パネルは `width: 350px` の固定幅で、折りたたみ時にアニメーションで縮小。

### 2.2 SqlInputPanel

SQL入力を受け付けるパネル。

```typescript
// components/input/SqlInputPanel.tsx
"use client";

interface SqlInputPanelProps {
  onSubmit: (sql: string) => void;
  isLoading: boolean;
}

// 責務:
// - テキストエリアへの直接入力 [F1-1]
// - FileDropZone と連携してファイルからのSQL読み込み [F1-1]
// - 「パース実行」ボタンでAPI呼び出しをトリガー
// - ローディング状態の表示

// 動作:
// 1. ユーザーがSQLを入力（テキストエリア or ファイルD&D）
// 2. 「パース実行」ボタンクリック
// 3. onSubmit コールバックで親に通知
// 4. 親コンポーネント (MainView) が POST /api/parse を呼び出し
// 5. 結果を lineageStore に反映
```

### 2.3 FileDropZone

ファイルドラッグ&ドロップによるSQL読み込み。

```typescript
// components/input/FileDropZone.tsx
"use client";

interface FileDropZoneProps {
  onFilesLoaded: (contents: FileContent[]) => void;
}

interface FileContent {
  fileName: string;
  content: string;
}

// 責務:
// - .sql ファイルのD&D受付 [F1-1]
// - 複数ファイルの同時読み込み [F1-1]
// - ファイル拡張子バリデーション（.sql のみ受付）
// - 読み込み済みファイルのリスト表示
// - ファイル個別の削除

// 動作:
// 1. ユーザーが.sqlファイルをドラッグ&ドロップ
// 2. FileReader でテキスト読み込み
// 3. onFilesLoaded コールバックで親に通知
// 4. 読み込み済みファイル名をリスト表示
```

### 2.4 DialectSelector

DB方言の選択UI。

```typescript
// components/ui/DialectSelector.tsx
"use client";

interface DialectSelectorProps {
  value: SqlDialect;
  onChange: (dialect: SqlDialect) => void;
}

// 対応方言:
// - BigQuery（初期選択）
// - PostgreSQL, MySQL, SQLite（将来対応。UIには表示するが disabled）
```

### 2.5 ResetButton

全状態をリセットするボタン。

```typescript
// components/ui/ResetButton.tsx
"use client";

// 責務:
// - lineageStore.resetAll() を呼び出し [F1-7]
// - flowStore もクリアされる（lineageStore のリセットに連動）
// - SqlInputPanel の入力テキストもクリアされる（lineageStore.resetCounter 経由）
// - FileDropZone のファイルリストもクリアされる（同上）
// - 確認ダイアログを表示してから実行
```

**SQL入力 / ファイルリストのクリア機構** (bd-sql_viz_202604_2-5zc):
- lineageStore に `resetCounter: number` を持ち、`resetAll` で +1 する
- SqlInputPanel と FileDropZone は `useLineageStore((s) => s.resetCounter)` を購読し、`useEffect([resetCounter])` 内で local state（textarea / files / error）をクリアする
- これによりリセット後に新しいファイルを読み込んだとき、前回のファイルが再パースされる問題を防ぐ

---

## 3. カスタムノードタイプ

React Flow のカスタムノードとして4種類を実装する。

### 3.1 QueryBoxNode — クエリ全体ノード

対応機能要件: F1-3, F1-4, F1-5, F1-6, F1-8

```typescript
// components/visualizer/nodes/QueryBoxNode.tsx
"use client";

interface QueryBoxNodeData {
  /** テーブル名（CTAS の場合はターゲットテーブル名） */
  tableName: string;
  /** 表示タイトル（F1-6: targetTableがなければ "[問い合わせ]"） */
  title: string;
  /** クエリ種別 */
  queryType: 'select' | 'ctas';
  /** 現在の表示モード */
  displayMode: 'compact' | 'detail';
  /** compact時に表示するカラム名一覧 */
  compactColumns: string[];
  /** このノードが登録済みかどうか */
  isRegistered: boolean;
}
```

**外観仕様**:

| 要素 | compact表示 | detail表示 |
|---|---|---|
| タイトルバー | テーブル名 + 切替アイコン | テーブル名 + 切替アイコン |
| 本体 | カラム名のリスト | 子ノード（ClauseBoxNode群） |
| サイズ | 固定小サイズ | 子ノードに応じた動的サイズ |
| 背景色 | `#eef2f7` (淡い青灰) | 同上 |

**compact モードのテキストクリッピング** (bd-sql_viz_202604_2-3bk):
compact モードでは `.compactBody` 内に列名リストを表示するが、`.container` が
`overflow: visible` (ハンドル用) のため、長い列名が box 右端を超えてはみ出す
問題があった。以下の制約で `.compactBody` 内部だけを clip する:
- `.compactBody`: `width: 100%; box-sizing: border-box; min-width: 0; overflow: hidden`
- `.compactColumn`: `max-width: 100%; min-width: 0` （`overflow: hidden; text-overflow: ellipsis; white-space: nowrap` は従来どおり）
- `.container` の `overflow: visible` は維持（ハンドルのクリップを防ぐため）

**背景色・領域** (bd-sql_viz_202604_2-kfq):
- `.container` は `width: 100%; height: 100%; box-sizing: border-box` で
  React Flow outer wrapper 全体を覆うように拡張
- 背景色は `#eef2f7`（淡い青灰）。子 clauseBox (`#ffffff`) および
  titleBar (`--color-bg-secondary` = `#f8f9fa`) と区別できる階調
- 以前は `.container` のサイズが titleBar 分しかなく、子 clauseBox 領域の
  背景が透明に見えて「ドラッグできるが塗られていない」状態だった

**クリック動作** (F1-4):
- タイトルバークリックで `compact` / `detail` をトグル
- `flowStore.toggleDisplayMode(tableId)` を呼び出し
- トグル後に `recalculateLayout` を実行

**ドラッグ動作** (bd-sql_viz_202604_2-35o):
- ルートの QueryBoxNode のみドラッグ可能（React Flow デフォルト）
- 子ノードである ClauseBoxNode / ColumnItemNode は `draggable: false` で固定し、レイアウトが崩れないようにする

**タイトルルール**:
- CTAS: `targetTable` の値（例: `output_table`）
- 単純SELECT: `[問い合わせ]` (F1-6)
- CTE: CTE名（例: `monthly_sales`）
- FROMサブクエリ: エイリアス名（例: `sub`）
- WHERE IN/EXISTS サブクエリ: エイリアスがあればその名前、無ければ `[サブクエリ]` (F1-8)

**実装** (bd-sql_viz_202604_2-9rp): `createTableNode` 自体は targetTable 由来で
displayTitle を決めるため CTE/サブクエリ内部では `[問い合わせ]` になる。`buildLineageGraph`
の CTE/サブクエリ生成箇所で、内部 TableNode の `displayTitle` を上書きする。

### 3.2 ClauseBoxNode — 句ノード

対応機能要件: F1-3

```typescript
// components/visualizer/nodes/ClauseBoxNode.tsx
"use client";

interface ClauseBoxNodeData {
  /** 句の種別 */
  clauseType: 'SELECT' | 'FROM' | 'WHERE' | 'GROUP BY' | 'HAVING' | 'ORDER BY';
  /** 句のラベル表示 */
  label: string;
}
```

**外観仕様**:
- 句の種別をヘッダーに表示（例: `SELECT`, `FROM`, `WHERE`）
- 内部に ColumnItemNode を子ノードとして配置（SELECT句のみ）
- detail表示時のみ visible。compact時は `hidden: true`
- `draggable: false` で固定（bd-sql_viz_202604_2-35o）

**縦展開** (bd-sql_viz_202604_2-oi5, bd-sql_viz_202604_2-ogr):
- SELECT 以外の clauseBox はヘッダの ▸/▾ アイコンクリックで縦展開可能
- 通常時 (collapsed): ヘッダ内に 1 行で label をトランケート表示（`...` 省略）
- 展開時 (expanded): ヘッダ下に label を複数行折り返し表示。box の `height` を
  `flowStore.toggleClauseExpand` で動的に拡張する
- 展開高さは label の文字数から `computeExpandedClauseHeight` で概算
- SELECT 句は ColumnItem 子があるため対象外（toggle 呼出も no-op）
- **左列再スタック** (bd-sql_viz_202604_2-ogr): 左列に縦積みされた clauseBox
  (FROM/WHERE/GROUP BY/HAVING/ORDER BY) を展開・折り畳みしたとき、`restackLeftColumnClauses`
  が同じ親 QueryBox 内の左列を実行順に縦積みしなおす。各 clauseBox の現在の
  height を尊重して y 座標を順に進めるため、兄弟との重なりが発生しない。
  その後 `recalculateLayout` が親 QueryBox の height を拡張し、最下端の
  clauseBox がはみ出さないようにする。

**エッジ接続用 Handle** (bd-sql_viz_202604_2-q8n):
- `clauseType === 'FROM'` の clauseBox には `<Handle type="target" position="left">` を持たせる
- `table_dependency` エッジは target 表示モードに応じて動的にこの Handle へ接続される
  （詳細は §4.1 LineageEdge を参照）

**句タイプ別の生成ルール** (bd-sql_viz_202604_2-c69 / bd-sql_viz_202604_2-q82):
- **FROM**: `buildFromClauseNode`。ラベルにテーブル一覧と JOIN 情報（例: `users` / `a INNER JOIN b ON a.id = b.a_id`）
- **WHERE**: `buildWhereClauseNode`。ラベルに条件式（`conditionText`）
- **GROUP BY**: `buildGroupByClauseNode`。ラベルに `expressionText`
- **HAVING**: `buildHavingClauseNode`。ラベルに `conditionText`
- **SELECT**: `buildSelectClauseNodes`。ヘッダ + ColumnItemNode 子群
- **ORDER BY**: `buildOrderByClauseNode`。ラベルに `expressionText`

**配置 (2列レイアウト、bd-sql_viz_202604_2-q82 → bd-sql_viz_202604_2-8ud)**:
親 QueryBox の detail モード時、`buildMainClauseNodes` が 2 列構成で配置する。
横幅が長くなりすぎないようにするのが目的。

```
+----------+  +-----------+
|  FROM    |  |           |
+----------+  |           |
|  WHERE   |  |  SELECT   |
+----------+  |   col1    |
| GROUP BY |  |   col2    |
+----------+  |   ...     |
|  HAVING  |  |           |
+----------+  +-----------+
| ORDER BY |
+----------+
```

- **左列**: SELECT 以外 (FROM → WHERE → GROUP BY → HAVING → ORDER BY) を
  実行順で**縦積み**。該当句が無い場合はその clauseBox を生成せず上詰めで詰める
- **右列**: SELECT を左列の右に配置 (x = `startX + QUERY_BOX_MIN_WIDTH + CHILD_GAP_HORIZONTAL`、
  y = `startY`)。SELECT の高さは columnItem の数に追従する
- 以前 (bd-q82) は 6 句全てを横一列に並べていたが、展開時の幅が大きすぎるため
  bd-sql_viz_202604_2-8ud で 2 列レイアウトに変更

**FROM句の特殊表示**:
- テーブル一覧を表示
- JOIN がある場合、JOIN種別をアイコンで区別 (F1-3)

| JOIN種別 | アイコン | 備考 |
|---|---|---|
| INNER JOIN | `⋈` | 両方向矢印 |
| LEFT JOIN | `⟕` | 左矢印付き |
| RIGHT JOIN | `⟖` | 右矢印付き |
| FULL JOIN | `⟗` | 両矢印付き |
| CROSS JOIN | `×` | バツ印 |

JOINアイコンは控えめなサイズ・色で表示する（要件: "よく見れば違う" 程度の強度）。

### 3.3 ColumnItemNode — カラム項目ノード

対応機能要件: F1-3, F2-3, F2-4

**ドラッグ動作** (bd-sql_viz_202604_2-35o): `draggable: false` で固定。親の ClauseBox/QueryBox を動かす場合は親のドラッグで対応する。

```typescript
// components/visualizer/nodes/ColumnItemNode.tsx
"use client";

interface ColumnItemNodeData {
  /** 表示名 */
  displayName: string;
  /** ソーステーブル名（あれば） */
  sourceTable: string | null;
  /** 式の種別 */
  exprType: SelectColumn['exprType'];
  /** カラムの確度 */
  certainty: 'confirmed' | 'inferred' | 'propagated';
  /** リネージュハイライト中かどうか */
  isHighlighted: boolean;
  /** WHERE/HAVING等の条件テキスト（条件ノードの場合） */
  conditionText: string | null;
}
```

**外観仕様**:
- カラム名を1行で表示
- `certainty` に応じたスタイル差異:

| certainty | スタイル | 意味 |
|---|---|---|
| `confirmed` | 通常テキスト | パース確定 |
| `inferred` | イタリック + 薄い背景色 | 未登録テーブルから推定 |
| `propagated` | 通常テキスト + 小アイコン `*` | SELECT * から伝播 |

**クリック動作** (F2-3):
- カラムクリックで `flowStore.highlightLineage(tableId, columnName)` を呼び出し
- 上流方向のリネージュパスをハイライト表示
- 再クリックまたは空白クリックでハイライト解除

### 3.4 UnresolvedBoxNode — 未登録テーブルノード

対応機能要件: F2-2, F2-4

```typescript
// components/visualizer/nodes/UnresolvedBoxNode.tsx
"use client";

interface UnresolvedBoxNodeData {
  /** テーブル名 */
  tableName: string;
  /** 推定されたカラム一覧 */
  inferredColumns: string[];
  /** 表示モード */
  displayMode: 'compact' | 'detail';
}
```

**外観仕様**:
- 点線の枠線で登録済みテーブルと視覚的に区別 (F2-2)
- 背景色を薄いグレーに
- ヘッダーに `[未登録]` プレフィックスを表示
- 推定カラムは `inferred` スタイルで表示

**リネージュハイライト** (bd-sql_viz_202604_2-4et):
- UnresolvedBoxNode は推定カラムを ColumnItemNode ではなくコンポーネント内の
  `<div>` で直接レンダリングしている。そのため `highlightedColumns` を
  `useFlowStore` 経由で購読し、各カラム div のクラス名を動的に切り替える
- ハイライト対象: `.inferredColumnHighlighted` (オレンジ枠＋背景)
- dim 対象: `.inferredColumnDimmed` (opacity: 0.35)
- `highlightPath` が非 null のときのみ dim が発動

**サイズ計算** (bd-sql_viz_202604_2-ple):
- 以前は width/height が未設定で `arrangeTableNodes` が `QUERY_BOX_MIN_HEIGHT=80`
  にフォールバックし、推定カラムが多い未登録テーブル同士が重なっていた
- `computeUnresolvedNodeSize(numColumns, displayMode)` ヘルパーで算出:
  - **detail**: width = QUERY_BOX_MIN_WIDTH (220)、height = COMPACT_BASE_HEIGHT +
    max(numColumns, 1) * COMPACT_COLUMN_ROW_HEIGHT + PADDING_BOTTOM
  - **compact**: width = QUERY_BOX_MIN_WIDTH、height = COMPACT_BASE_HEIGHT +
    COMPACT_COLUMN_ROW_HEIGHT (1行: 推定カラム件数テキスト)
- syncFromLineage でノード生成時に明示的に width/height/style を設定
- `applyCompactSizes` でも unresolvedBox を処理し、toggleDisplayMode で
  compact ⇄ detail 切替時にサイズが更新される

**置換動作** (F2-2):
- 後から該当テーブルを生成するSQLが登録された場合、`lineageStore.addQuery` 内で自動的に UnresolvedBoxNode → QueryBoxNode に置換される
- flowStore の syncFromLineage で React Flow ノードが更新される

---

## 4. カスタムエッジ

### 4.1 LineageEdge

**ネスト子のエッジ生成** (bd-sql_viz_202604_2-ce2):
ネスト子 (CTE / FROMサブクエリ / WHEREサブクエリ) の `dependsOn` からもエッジ
を生成する。`buildQueryBoxNodes` が再帰的に `edges` / `edgeIdSet` / `globalTableIds`
を持ち回り、各子 TableNode の `dependsOn` を以下の順で解決する:
1. 同一親内の **sibling** (自レベルの CTE 名 / サブクエリ alias) → sibling の nodeId
2. **グローバル tables** (外部テーブル、未登録含む) → テーブル名
3. どちらでもない → skip

**親クエリ → 自CTE 参照のエッジ生成** (bd-sql_viz_202604_2-icu):
親クエリの `FROM ranked_users` のように、親自身の CTE を参照するケースを
処理する。`syncFromLineage` の main loop で対象テーブルの `ctes` / `fromSubqueries`
/ `whereSubqueries` から `ownNestedNameToId` を構築し、`dependsOn` の解決時に
global tables より優先してネスト子の nodeId を source にする。
targetTableId は親の tableId のまま保持し、`retargetTableDependencyEdges` で
main FROM clauseBox にリダイレクトされる。

例 (`04_cte_with.sql`):
- `orders`（unresolved）→ `...__cte__monthly_sales` (外部参照エッジ)
- `...__cte__monthly_sales` → `...__cte__ranked_users` (sibling エッジ)
- `...__cte__ranked_users` → main query (親 CTE 参照エッジ、icu で追加)

**動的 target リダイレクト** (bd-sql_viz_202604_2-q8n, bd-sql_viz_202604_2-hnw):

`table_dependency` エッジは target 側 QueryBox の表示モードに応じて接続先を切り替える。
さらに、`targetClauseType` によって FROM clauseBox か WHERE clauseBox のどちらに
接続するかも切替えられる。

- **target が detail モード**: target の該当 clauseBox (`${tid}__clause__${type}`) の左端 Handle に接続
- **target が compact モード**: target の QueryBox (`${tid}`) の左端中央に接続

使い分け (`targetClauseType`):
- **FROM** (default): 通常の上流テーブル → 下流クエリ。例: `users → main (FROM)`
- **WHERE**: WHERE 内サブクエリ → 本体 WHERE clauseBox。例: `[WHERE サブクエリ 1] → main (WHERE)`

実装:
- `LineageEdgeData` に `targetTableId?: string`, `targetClauseType?: 'FROM' | 'WHERE'` を保持
- `flowStore` のヘルパー `computeTableDependencyTarget(targetTableId, nodes, clauseType)` が
  現在の `${targetTableId}__clause__${type}` ノードの存在と hidden 状態を見て、
  適切な target id を返す
- `retargetTableDependencyEdges(edges, nodes)` が全 `table_dependency` エッジに
  対して再ターゲットを実行（デフォルト 'FROM'）
- `syncFromLineage` の最後と `toggleDisplayMode` の最後で再ターゲットを呼ぶ
- `ClauseBoxNode` は FROM / WHERE の両方に target Handle を持つ
- `column_lineage` エッジは現状維持（columnItem ノードに直接接続）
- source 側は常に source QueryBox の右端中央（変更なし）

**WHERE サブクエリエッジ** (bd-sql_viz_202604_2-hnw):
`buildQueryBoxNodes` が対象 table の `whereSubqueries` ごとにエッジを生成する:
- source = `${tableId}__wheresub__${alias}`
- target = `${tableId}` (retargetTableDependencyEdges で WHERE clauseBox にリダイレクト)
- `targetClauseType = 'WHERE'`


対応機能要件: F2-1, F2-3

```typescript
// components/visualizer/edges/LineageEdge.tsx
"use client";

interface LineageEdgeData {
  /** 依存の方向: source → target */
  dependencyType: 'table_dependency' | 'column_lineage';
  /** ハイライト中かどうか */
  isHighlighted: boolean;
}
```

**エッジの種類**:

| 種類 | 用途 | スタイル |
|---|---|---|
| `table_dependency` | テーブル間の依存 (A→B) | 実線、矢印あり、グレー |
| `column_lineage` | カラムレベルの依存 | ハイライト時のみ表示、色付き |

**ハイライト動作**:
- 通常時: `table_dependency` エッジのみ表示（薄いグレー）
- カラムクリック時: 関連する `column_lineage` エッジをハイライト色で表示
- ハイライトパス上にないエッジは更に薄く表示（フォーカス効果）

---

## 5. compact / detail トグル動作仕様

対応機能要件: F1-4, F1-8

### 状態遷移

```
[detail] ←クリック→ [compact]
```

### detail → compact

1. `flowStore.toggleDisplayMode(tableId)` を呼び出し
2. 該当 QueryBoxNode 配下の全子ノード（ClauseBoxNode, ColumnItemNode, ネストされた QueryBoxNode）に `hidden: true` を設定
3. 親 QueryBoxNode のサイズをコンパクト値に変更
4. コンパクト値のサイズ:
   - 幅: `COMPACT_NODE_WIDTH` (200px)
   - 高さ: `COMPACT_BASE_HEIGHT + COMPACT_COLUMN_ROW_HEIGHT * カラム数` (最大10行、それ以上は `+N more` 表示)
5. `recalculateLayout` で祖先ノードのサイズを再計算

### compact → detail

1. `flowStore.toggleDisplayMode(tableId)` を呼び出し
2. 該当 QueryBoxNode 配下の全子ノードに `hidden: false` を設定
3. React Flow の `onNodeChange` で `measured` サイズが更新される
4. `recalculateLayout` で該当ノードおよび祖先ノードのサイズを再計算

### ネスト構造での compact/detail (F1-8)

- 親を compact にすると、全子孫ノードが非表示になる
- 親を detail に戻すと、各子ノードは自身の displayMode に従い表示される
  - 子が compact だった場合: 子は compact のまま表示される
- displayMode は各 QueryBoxNode ごとに独立管理される

**ネスト compact 状態の保持** (bd-sql_viz_202604_2-8dp):
以前は `toggleDisplayMode` が全子孫に `hidden: isNowCompact` を一律設定していた
ため、「外側 detail → 内側 compact → 外側 compact → 外側 detail」の操作列で
内側の compact 状態（より正確には内側の孫の hidden 状態）が壊れていた。

修正: ノードの hidden は `displayModes` マップから派生する**計算値**として扱う。
`computeHiddenStatesFromDisplayModes(nodes, displayModes)` ヘルパーが各ノードの
parentId チェーンを遡り、いずれかの祖先 queryBox が `compact` であればそのノード
は `hidden=true` とする。`toggleDisplayMode` は該当ノードの `displayMode` のみを
書き換え、全ノードの hidden はこのヘルパーで再計算する。

---

## 6. 状態管理 — Zustand ストア設計

### 6.1 lineageStore

データモデル層。[リネージュデータモデル設計](./lineage-model.md) で定義される型を使用。

```typescript
// stores/lineageStore.ts
import { create } from 'zustand';
import { TableNode, ParsedQuery, SqlDialect } from '@/types/lineage';

interface LineageState {
  /** 全テーブルのマップ（テーブル名 → TableNode） */
  tables: Map<string, TableNode>;
  /** 全クエリのマップ（queryId → ParsedQuery） */
  queries: Map<string, ParsedQuery>;
  /** 選択中のDB方言 */
  dialect: SqlDialect;
  /**
   * リセット通知カウンタ（bd-sql_viz_202604_2-5zc）。
   * resetAll のたびに +1。SqlInputPanel / FileDropZone が購読し、
   * 変化を検知して local state をクリアするために使用する。
   */
  resetCounter: number;
}

interface LineageActions {
  /**
   * パース結果を追加してリネージュグラフを再構築
   * 1. ParsedQuery から TableNode を生成
   * 2. 未登録テーブルとの一致チェック→置換
   * 3. inferUnregisteredColumns 再実行
   * 4. propagateSelectStar 再実行
   */
  addQuery: (parsed: ParsedQuery) => void;

  /**
   * 指定クエリを削除してリネージュグラフを再構築
   */
  removeQuery: (queryId: string) => void;

  /**
   * 全状態をクリア
   */
  resetAll: () => void;

  /**
   * DB方言を変更
   */
  setDialect: (dialect: SqlDialect) => void;
}

type LineageStore = LineageState & LineageActions;
```

### 6.2 flowStore

ビュー層。React Flow のノード/エッジと表示状態を管理。

```typescript
// stores/flowStore.ts
import { create } from 'zustand';
import { Node, Edge } from '@xyflow/react';

interface FlowState {
  /** React Flow ノード群 */
  nodes: Node[];
  /** React Flow エッジ群 */
  edges: Edge[];
  /** 各テーブルの表示モード */
  displayModes: Map<string, 'compact' | 'detail'>;
  /** 現在ハイライト中のカラムパス */
  highlightPath: { tableId: string; columnName: string } | null;
  /**
   * リネージュチェーン上のハイライト対象カラム集合 (bd-sql_viz_202604_2-26k)。
   * key = "tableId:columnName"。上流＋下流＋クリックしたカラム自身を含む。
   * null = ハイライト非発動時。
   * ColumnItemNode がこの Set を参照して isHighlighted を判定する。
   */
  highlightedColumns: Set<string> | null;
}

interface FlowActions {
  /**
   * lineageStore の状態から React Flow ノード/エッジを生成
   * - TableNode → QueryBoxNode / UnresolvedBoxNode
   * - 句情報 → ClauseBoxNode（SELECT/FROM/WHERE）
   * - カラム情報 → ColumnItemNode
   * - 依存関係 → Edge
   * - 2フェーズレイアウトを実行 (bd-sql_viz_202604_2-u8l):
   *   1. buildQueryBoxNodes でネスト子を再帰生成（CTE 持ちクエリの main
   *      clauseBox は deferredMainClauses に積んで遅延）
   *   2. recalculateLayout で子サイズ確定
   *   3. deferredMainClauses を処理（子の最下端を計算し、その下に SELECT
   *      → FROM → WHERE を縦積み配置）
   *   4. recalculateLayout 再実行
   *   5. arrangeTableNodes でルートテーブルを左→右配置 (bd-z0e)
   */
  syncFromLineage: (tables: Map<string, TableNode>) => void;

  /**
   * 指定テーブルの compact/detail をトグル
   * - 子ノードの hidden を切替
   * - recalculateLayout を実行
   */
  toggleDisplayMode: (tableId: string) => void;

  /**
   * カラムクリック時のリネージュハイライト (bd-sql_viz_202604_2-26k 拡張)
   * - 上流方向: dependencies を再帰的に辿る (traceUpstream)
   * - 下流方向: 全テーブルの dependencies を逆引きして辿る (traceDownstream)
   * - 関連 column_lineage エッジの isHighlighted を true に
   * - リネージュチェーン上の全カラムを highlightedColumns Set に追加
   */
  highlightLineage: (tableId: string, columnName: string) => void;

  /**
   * ハイライトをクリア
   */
  clearHighlight: () => void;
}

type FlowStore = FlowState & FlowActions;
```

### ストア間の連携

```
lineageStore.addQuery()
    │
    ├── [内部] buildLineageGraph, inferUnregisteredColumns, propagateSelectStar
    │
    └── subscribe (Zustand の subscribe を使用)
            │
            ▼
        flowStore.syncFromLineage(lineageStore.getState().tables)
```

`lineageStore` の状態変更を `flowStore` が購読し、自動的にノード/エッジを再生成する。

```typescript
// stores/flowStore.ts (購読の設定)

// lineageStore の変更を監視
lineageStore.subscribe((state) => {
  flowStore.getState().syncFromLineage(state.tables);
});
```

---

## 7. カスタムフック

### 7.1 useFlowNodes

flowStore からノードを取得し、React Flow に渡す形式に変換する。

```typescript
// hooks/useFlowNodes.ts

function useFlowNodes() {
  const { nodes, edges } = useFlowStore();
  // React Flow の useNodesState, useEdgesState と連携
  // ノードのドラッグ操作、位置変更を flowStore に反映
}
```

### 7.2 useLineageHighlight

カラムクリック時のリネージュ追跡ロジック。

```typescript
// hooks/useLineageHighlight.ts

function useLineageHighlight() {
  const highlightLineage = useFlowStore((s) => s.highlightLineage);
  const clearHighlight = useFlowStore((s) => s.clearHighlight);

  const handleColumnClick = (tableId: string, columnName: string) => {
    highlightLineage(tableId, columnName);
  };

  const handleCanvasClick = () => {
    clearHighlight();
  };

  return { handleColumnClick, handleCanvasClick };
}
```

---

## 8. CSS Modules のスタイル構成

Tailwind CSS は使用しない。CSS Modules + CSS Custom Properties で統一する。

```
src/
├── styles/
│   └── variables.css         # CSS Custom Properties（カラー、スペーシング等）
├── components/
│   ├── visualizer/
│   │   ├── FlowCanvas.module.css
│   │   ├── nodes/
│   │   │   ├── QueryBoxNode.module.css
│   │   │   ├── ClauseBoxNode.module.css
│   │   │   ├── ColumnItemNode.module.css
│   │   │   └── UnresolvedBoxNode.module.css
│   │   └── edges/
│   │       └── LineageEdge.module.css
│   ├── input/
│   │   ├── SqlInputPanel.module.css
│   │   └── FileDropZone.module.css
│   └── ui/
│       ├── ResetButton.module.css
│       └── DialectSelector.module.css
```

### CSS Custom Properties

```css
/* styles/variables.css */

:root {
  /* カラーパレット */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f8f9fa;
  --color-bg-node: #ffffff;
  --color-bg-unresolved: #f0f0f0;
  --color-border-node: #d0d5dd;
  --color-border-unresolved: #98a2b3;
  --color-border-clause: #e4e7ec;
  --color-text-primary: #101828;
  --color-text-secondary: #475467;
  --color-text-inferred: #667085;
  --color-accent: #2563eb;
  --color-highlight: #f59e0b;

  /* スペーシング */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;

  /* ノードサイズ */
  --node-title-height: 32px;
  --node-border-radius: 8px;
  --node-min-width: 180px;
}
```
