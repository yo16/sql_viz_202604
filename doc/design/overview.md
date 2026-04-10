# 設計概要 — SQL Lineage Visualizer

## 設計ドキュメント一覧

| ドキュメント | 概要 |
|---|---|
| [全体アーキテクチャ設計](./architecture.md) | システム構成、ディレクトリ構造、データフロー、状態管理方針 |
| [API設計](./api-design.md) | POST /api/parse のリクエスト/レスポンス仕様、バリデーション、エラーハンドリング |
| [コンポーネント設計](./component-design.md) | コンポーネントツリー、カスタムノード仕様、compact/detail トグル、Zustand ストア設計 |
| [レイアウトエンジン設計](./layout-engine.md) | 親ノード動的サイズ計算、ボトムアップ再帰レイアウト、レイアウト定数 |
| [リネージュデータモデル設計](./lineage-model.md) | TableNode/ColumnNode/ColumnDependency 型定義、AST変換パイプライン、SELECT * 伝播、リネージュ追跡 |
| [カラム推定エッジケース](./column-inference-edge-cases.md) | 未登録テーブルのカラム推定における8つのエッジケースと対処方針 |

---

## 要件の要約

DWH構築時のSQLクエリ群における**カラムレベルリネージュ**を可視化するWebツール。

### フェーズ1: 単一クエリ可視化
- SQL入力（テキスト入力 + ファイルD&D）を受け取り、Box-in-Box構造で可視化
- 最外枠がクエリ（テーブル）、中枠が各句（SELECT/FROM/WHERE等）、内枠がカラム
- compact（カラム一覧）/ detail（全句展開）の表示切替
- CTE・サブクエリのネスト表示（最大5段）
- CTAS、単純SELECTに対応

### フェーズ2: 複数クエリ連携
- テーブル間の依存関係を自動検出し、左→右のフローで可視化
- カラムレベルのリネージュ追跡（クリックでハイライト）
- 未登録テーブルの自動生成と、後からのSQL登録による置換
- SELECT * の上流→下流カラム伝播
- 未登録テーブルのカラム推定

---

## アーキテクチャ方針

### 技術スタック

| 区分 | 技術 |
|---|---|
| フレームワーク | Next.js (App Router) |
| 可視化 | React Flow v12 |
| SQLパーサー | node-sql-parser（サーバーサイド） |
| 状態管理 | Zustand（lineageStore + flowStore の2分割） |
| スタイリング | CSS Modules + CSS Custom Properties |
| デプロイ | Vercel |
| テスト | Jest + Playwright |

### 設計判断

1. **SQLパースはサーバーサイド**: node-sql-parser の Node.js 依存を考慮し、Route Handler (POST /api/parse) で実行。Server Actions は使わない
2. **リネージュ構築はクライアントサイド**: テーブル追加時のインタラクティブな再計算を即座に反映するため、ブラウザ上で処理
3. **Zustand 2ストア分離**: データモデル (lineageStore) とビュー (flowStore) を分離し、テスト容易性と将来の可視化エンジン差替え可能性を確保
4. **レイアウトエンジン自作**: React Flow は親ノードの動的サイズ計算を提供しないため、ボトムアップ再帰計算の独自モジュールを実装
5. **CSS Modules**: Tailwind CSS は禁止。CSS Custom Properties で統一的なデザイントークンを管理

### データフロー

```
SQL入力 → POST /api/parse → ParsedQuery[]
  → lineageStore.addQuery()
    → buildLineageGraph → inferUnregisteredColumns → propagateSelectStar
  → flowStore.syncFromLineage()
    → recalculateLayout
  → FlowCanvas (React Flow レンダリング)
```

### フェーズ3への拡張ポイント

- `(auth)/`, `(app)/` ルートグループの導入準備
- lineageStore の状態は JSON シリアライズ可能な構造
- 型定義に `id` フィールドを含め、将来の DB 主キーとして利用可能

---

## 機能要件 ↔ 設計ドキュメント マッピング

| 機能ID | 機能名 | 主な設計ドキュメント |
|---|---|---|
| F1-1 | SQL入力 | [コンポーネント設計](./component-design.md#22-sqlinputpanel) |
| F1-2 | SQLパース | [API設計](./api-design.md#2-post-apiparse), [アーキテクチャ](./architecture.md#2-ディレクトリ構造) |
| F1-3 | 単一クエリの可視化 | [コンポーネント設計](./component-design.md#3-カスタムノードタイプ), [レイアウトエンジン](./layout-engine.md) |
| F1-4 | インタラクション | [コンポーネント設計](./component-design.md#5-compact--detail-トグル動作仕様) |
| F1-5 | CTAS対応 | [API設計](./api-design.md#2-post-apiparse), [コンポーネント設計](./component-design.md#31-queryboxnode--クエリ全体ノード) |
| F1-6 | 単純SELECTの表示 | [コンポーネント設計](./component-design.md#31-queryboxnode--クエリ全体ノード) |
| F1-7 | リセット機能 | [コンポーネント設計](./component-design.md#25-resetbutton) |
| F1-8 | CTE・サブクエリのネスト | [レイアウトエンジン](./layout-engine.md#8-ネスト上限の処理-f1-8), [コンポーネント設計](./component-design.md#5-compact--detail-トグル動作仕様) |
| F2-1 | テーブル依存関係の自動検出 | [リネージュモデル](./lineage-model.md#2-ast--リネージュグラフ変換パイプライン), [レイアウトエンジン](./layout-engine.md#7-テーブル間レイアウト左右フロー) |
| F2-2 | 未認識テーブルの扱い | [リネージュモデル](./lineage-model.md#5-テーブル追加時のグラフ再構築フロー), [コンポーネント設計](./component-design.md#34-unresolvedboxnode--未登録テーブルノード) |
| F2-3 | カラムレベルリネージュ | [リネージュモデル](./lineage-model.md#6-リネージュ追跡ハイライト), [コンポーネント設計](./component-design.md#41-lineageedge) |
| F2-4 | 未登録テーブルのカラム推定 | [カラム推定エッジケース](./column-inference-edge-cases.md), [リネージュモデル](./lineage-model.md#4-未登録テーブルのカラム推定ロジック) |
| F2-5 | SELECT * のカラム解決 | [リネージュモデル](./lineage-model.md#3-select--伝播アルゴリズム) |
