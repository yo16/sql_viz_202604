# プロジェクト固有設定

## 技術スタック

- フレームワーク: Next.js (App Router)
- デプロイ: Vercel
- DB/Auth: Supabase（フェーズ3で導入）
- タスク管理: Beads
- テスト: Jest（+ Playwright: E2Eが必要な場合）
- スタイリング: CSS Modules（Tailwind CSS は禁止）
- 可視化: React Flow v12
- SQLパーサー: node-sql-parser（サーバーサイド）
- 状態管理: Zustand

## Git戦略

### ブランチ構成
- `release`: 正式版ブランチ（エージェント操作禁止）
- `preview`: プレビュー版ブランチ（エージェント操作禁止）
- `dev`: 開発ブランチ（featureブランチのマージ先）
- `feature/bd-{beads-id}`: タスクごとのブランチ

### ルール
- Git Worktreeを使い、並行で進められるタスクは並行で進める
- featureブランチはBeadsのIDを使って命名する
- release, previewブランチはエージェントが操作しない

## 要件定義ドキュメント

- 配置先: `doc/requirements-phase1-2.md`

## 設計ドキュメント構成

設計エージェント(`design-architect`)が作成する設計ドキュメントの一覧です。

- `doc/design/overview.md`: 設計概要（各ドキュメントへのリンク集）
- `doc/design/architecture.md`: 全体アーキテクチャ設計（システム構成、ディレクトリ構造、データフロー、状態管理方針）
- `doc/design/api-design.md`: API設計（POST /api/parse のリクエスト/レスポンス仕様、バリデーション、エラーハンドリング）
- `doc/design/component-design.md`: コンポーネント設計（コンポーネントツリー、カスタムノード仕様、compact/detail トグル、Zustand ストア設計）
- `doc/design/layout-engine.md`: レイアウトエンジン設計（親ノード動的サイズ計算、ボトムアップ再帰レイアウト、レイアウト定数）
- `doc/design/lineage-model.md`: リネージュデータモデル設計（TableNode/ColumnNode/ColumnDependency 型定義、AST変換パイプライン、SELECT * 伝播、リネージュ追跡）
- `doc/design/column-inference-edge-cases.md`: カラム推定エッジケース（未登録テーブルのカラム推定における8つのエッジケースと対処方針）

## プロジェクト固有ルール

- node-sql-parserはサーバーサイド（Route Handler）でのみ使用する。クライアントからimportしない
- リネージュグラフの構築・再計算はクライアントサイド（Zustand store）で行う
- React FlowのカスタムノードはすべてCSS Modulesでスタイリングする
