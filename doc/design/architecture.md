# 全体アーキテクチャ設計

## 関連ドキュメント

- [API設計](./api-design.md)
- [コンポーネント設計](./component-design.md)
- [レイアウトエンジン設計](./layout-engine.md)
- [リネージュデータモデル設計](./lineage-model.md)
- [カラム推定エッジケース](./column-inference-edge-cases.md)
- [要件定義](../requirements-phase1-2.md)

---

## 1. システム構成概要

本システムは Next.js (App Router) を基盤とした SPA であり、クライアントサイドで React Flow による可視化を行い、サーバーサイドで SQL パースを実行する。

```
┌─────────────────────────────────────────────────────────────┐
│ Client (Browser)                                            │
│                                                             │
│  ┌──────────────┐    ┌──────────────────────────────────┐   │
│  │ SqlInputPanel │───▶│ Zustand Stores                   │   │
│  │ FileDropZone  │    │  ├── lineageStore (データモデル)  │   │
│  └──────────────┘    │  └── flowStore (React Flow状態)   │   │
│                       └───────────┬──────────────────────┘   │
│                                   │                          │
│                       ┌───────────▼──────────────────────┐   │
│                       │ FlowCanvas (React Flow)          │   │
│                       │  ├── QueryBoxNode                │   │
│                       │  ├── ClauseBoxNode                │   │
│                       │  ├── ColumnItemNode               │   │
│                       │  └── UnresolvedBoxNode            │   │
│                       └──────────────────────────────────┘   │
│                                                             │
└─────────────────────────────┬───────────────────────────────┘
                              │ POST /api/parse
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Server (Next.js Route Handler)                              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ /api/parse/route.ts                                  │   │
│  │  ├── sqlParser.ts (node-sql-parser)                  │   │
│  │  └── astExtractor.ts (AST → 構造化データ)            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 責務分離の原則

| 層 | 責務 | 実行環境 |
|---|---|---|
| **Server (Route Handler)** | SQLパース、AST抽出 | Node.js |
| **Client (Zustand + lib)** | リネージュグラフ構築、SELECT * 伝播、未登録カラム推定、React Flowノード/エッジ生成 | Browser |
| **Client (React Flow)** | 可視化レンダリング、インタラクション | Browser |

**設計判断の根拠**: `node-sql-parser` は Node.js 依存があるためサーバーサイドで実行する。リネージュグラフの構築はクライアントサイドで行うことで、テーブル追加時のインタラクティブな再計算を即座に反映できる。

---

## 2. ディレクトリ構造

```
src/
├── app/
│   ├── layout.tsx                    # ルートレイアウト (Server Component)
│   ├── page.tsx                      # メインページ (Server Component)
│   └── api/
│       └── parse/
│           └── route.ts              # SQLパースAPI (Route Handler)
│
├── components/
│   ├── visualizer/                   # React Flow 関連 (すべて "use client")
│   │   ├── FlowCanvas.tsx            # React Flow メインキャンバス
│   │   ├── nodes/
│   │   │   ├── QueryBoxNode.tsx      # クエリ全体ノード
│   │   │   ├── ClauseBoxNode.tsx     # 句ノード (SELECT, FROM, WHERE等)
│   │   │   ├── ColumnItemNode.tsx    # カラム項目ノード
│   │   │   └── UnresolvedBoxNode.tsx # 未登録テーブルノード
│   │   └── edges/
│   │       └── LineageEdge.tsx       # カスタムエッジ
│   ├── input/
│   │   ├── SqlInputPanel.tsx         # SQL入力パネル ("use client")
│   │   └── FileDropZone.tsx          # ファイルD&Dゾーン ("use client")
│   └── ui/
│       ├── ResetButton.tsx           # リセットボタン
│       └── DialectSelector.tsx       # DB方言セレクタ
│
├── layout/                           # レイアウトエンジン (純粋関数)
│   ├── calculateParentSize.ts        # 子ノード群 → 親サイズ計算
│   ├── recalculateLayout.ts          # ボトムアップ全ノード再計算
│   └── layoutConstants.ts            # パディング、最小サイズ等の定数
│
├── lib/
│   ├── parser/                       # サーバーサイド専用
│   │   ├── sqlParser.ts              # node-sql-parser ラッパー
│   │   └── astExtractor.ts           # AST → 構造化データ変換
│   ├── lineage/                      # クライアントサイド
│   │   ├── buildLineageGraph.ts      # パース結果 → TableNode/ColumnNode 構築
│   │   ├── propagateSelectStar.ts    # SELECT * の伝播処理
│   │   └── inferUnregisteredColumns.ts  # 未登録テーブルのカラム推定
│   └── validators/
│       └── sqlInputValidator.ts      # 入力バリデーション
│
├── hooks/
│   ├── useFlowNodes.ts               # flowStore → React Flow ノード変換
│   └── useLineageHighlight.ts        # カラムクリック時のリネージュ追跡
│
├── stores/
│   ├── lineageStore.ts               # リネージュデータモデル (Zustand)
│   └── flowStore.ts                  # React Flow 状態 (Zustand)
│
└── types/
    ├── lineage.ts                    # TableNode, ColumnNode, ColumnDependency 等
    ├── flow.ts                       # React Flow 関連の型
    └── api.ts                        # API リクエスト/レスポンスの型
```

### モジュール責務一覧

| モジュール | 責務 | 対応機能要件 |
|---|---|---|
| `app/api/parse/` | SQL文字列を受け取りAST構造化データを返却 | F1-2 |
| `lib/parser/` | node-sql-parser のラッパー。DB方言切替対応 | F1-2, F1-5 |
| `lib/lineage/` | リネージュグラフの構築・伝播・推定 | F2-1, F2-3, F2-4, F2-5 |
| `layout/` | React Flow ノードの位置・サイズ計算 | F1-3, F1-8 |
| `components/visualizer/` | React Flow によるノード描画 | F1-3, F1-4, F2-2 |
| `components/input/` | SQL入力UI | F1-1 |
| `stores/` | アプリケーション状態の一元管理 | 全機能共通 |

---

## 3. データフロー

### フェーズ1: 単一クエリ可視化

```
[ユーザー: SQL入力]
    │
    ▼
SqlInputPanel / FileDropZone
    │ SQL文字列
    ▼
POST /api/parse  ─────────────────────────────────────────────
    │                                                  Server
    ▼
sqlParser.ts (node-sql-parser, database: 'BigQuery')
    │ AST
    ▼
astExtractor.ts
    │ ParsedQuery (構造化データ)
    ▼
Response ──────────────────────────────────────────────────────
    │                                                  Client
    ▼
lineageStore.addQuery(parsedQuery)
    │
    ├── buildLineageGraph: ParsedQuery → TableNode + ColumnNode 群
    ├── inferUnregisteredColumns: 未登録テーブルのカラム推定
    └── propagateSelectStar: SELECT * の伝播
    │
    ▼
flowStore.syncFromLineage(lineageStore.state)
    │
    ├── TableNode → QueryBoxNode / UnresolvedBoxNode
    ├── 句情報 → ClauseBoxNode
    ├── カラム情報 → ColumnItemNode
    └── 依存関係 → Edge
    │
    ▼
recalculateLayout (ボトムアップサイズ計算)
    │
    ▼
FlowCanvas (React Flow レンダリング)
```

### フェーズ2: テーブル追加時の再計算フロー

```
[ユーザー: 追加SQLを入力]
    │
    ▼
POST /api/parse → ParsedQuery (新規クエリ分)
    │
    ▼
lineageStore.addQuery(newParsedQuery)
    │
    ├── 新テーブルを既存グラフに追加
    ├── 未登録テーブルの一致チェック → 一致したら置換
    ├── 全テーブルで inferUnregisteredColumns 再実行
    └── 全テーブルで propagateSelectStar 再実行
    │
    ▼
flowStore.syncFromLineage(...) → recalculateLayout → FlowCanvas 再レンダリング
```

---

## 4. 状態管理設計

Zustand で 2つのストアに分離する。

### lineageStore — データモデル層

```typescript
interface LineageState {
  tables: Map<string, TableNode>;
  queries: Map<string, ParsedQuery>;
  dialect: SqlDialect;

  // Actions
  addQuery: (parsed: ParsedQuery) => void;
  removeQuery: (queryId: string) => void;
  resetAll: () => void;
  setDialect: (dialect: SqlDialect) => void;
}
```

### flowStore — ビュー層

```typescript
interface FlowState {
  nodes: Node[];
  edges: Edge[];
  displayModes: Map<string, 'compact' | 'detail'>;

  // Actions
  syncFromLineage: (lineage: LineageState) => void;
  toggleDisplayMode: (tableId: string) => void;
  highlightLineage: (tableId: string, columnName: string) => void;
  clearHighlight: () => void;
}
```

**分離の理由**: データモデル (lineageStore) は純粋なリネージュ情報を保持し、ビュー層 (flowStore) は React Flow のノード/エッジと表示状態を管理する。この分離により、データモデルのテストが容易になり、将来的に異なる可視化エンジンへの切替も可能になる。

---

## 5. Server Component と Client Component の境界

```
app/layout.tsx          ← Server Component
app/page.tsx            ← Server Component (静的シェル)
  └── <MainView />      ← "use client" 境界
       ├── SqlInputPanel
       ├── FlowCanvas
       └── UI controls
```

- `app/page.tsx` は Server Component として静的なレイアウト（ヘッダー、パネル配置）を提供
- React Flow やユーザーインタラクションが必要なコンポーネントは `"use client"` として分離
- `lib/parser/` はサーバーサイドでのみ import され、クライアントバンドルに含まれない

---

## 6. フェーズ3 への拡張ポイント

| 拡張 | 設計上の準備 | 対応箇所 |
|---|---|---|
| 認証 | `(auth)/`, `(app)/` ルートグループの導入 | `app/` |
| DB永続化 | lineageStore の状態をシリアライズ可能な構造で保持 | `stores/lineageStore.ts` |
| Supabase | `lib/supabase/` モジュールの追加。lineageStore のアクションに保存/読込を追加 | `lib/`, `stores/` |
| 複数ユーザー | lineageStore にユーザーID、プロジェクトIDのスコープを追加 | `types/lineage.ts` |

**現時点では実装しない**が、以下を意識した設計とする:
- lineageStore の状態は `JSON.stringify` でシリアライズ可能であること
- 型定義に `id` フィールドを含め、将来の DB 主キーとして利用可能にする
- API レスポンスの型は拡張可能な構造にする（追加フィールドを許容）
