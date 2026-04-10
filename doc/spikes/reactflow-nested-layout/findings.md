# スパイク2: React Flow ネスト＋動的リサイズ検証 — 結論

## 結論

**React Flowでネスト構造＋動的リサイズは実現可能。** ただし、親ノードのサイズ自動計算はReact Flowに組み込まれていないため、自前のレイアウト計算モジュールが必要。これが本プロジェクト最大の自作ロジックになる。

## 検証項目と結果

| # | 検証項目 | 結果 | 備考 |
|---|---|---|---|
| 1 | 親子ノード配置 | ✅ | `parentId` で標準サポート。子の position は親からの相対座標 |
| 2 | 動的リサイズ | ⚠️ | 自前のレイアウト計算ロジックが必要 |
| 3 | compact/detail切替 | ✅ | `hidden` プロパティ + サイズ再計算で実現 |
| 4 | 多段ネスト (3〜5段) | ✅ | ボトムアップ再帰計算で対応。パフォーマンス問題なし |
| 5 | 親box境界貫通エッジ | ✅ | 子ノードのハンドルにエッジ接続可能。zIndex調整が必要 |

## React Flow v12 の重要な仕様

### ノードサイズの扱い
- `node.width` / `node.height` を設定 → **固定サイズ**（inline styleとして適用）
- 設定しない → **コンテンツベースの動的サイズ**、`node.measured.width` / `node.measured.height` で取得
- 親ノードは子ノードのサイズを**自動認識しない**（子ノードはHTML的には別要素）

### 親子ノードのルール
- `parentId` で親子関係を定義（v12で`parentNode`から改名）
- 親ノードは`nodes`配列で子ノードより**前に配置**する必要がある
- `extent: 'parent'` で子ノードのドラッグ範囲を親内に制限可能

## 設計への推奨事項

### 1. レイアウトエンジンの設計（独立モジュール）

```
src/layout/
  calculateParentSize.ts    — 子ノード群から親サイズを計算
  recalculateLayout.ts      — ボトムアップで全親ノードを再計算
  layoutConstants.ts        — パディング、最小サイズ等の定数
```

**calculateParentSize**: 子ノードの `position + measured.width/height` の最大値にパディングを加算

**recalculateLayout**: 
1. 全ノードの深さ(depth)を算出
2. 深い親ノードから順にサイズ再計算（ボトムアップ）
3. 各親のサイズ更新後、その親の親のサイズも連鎖的に更新

### 2. カスタムノードタイプ

| ノードタイプ | 用途 | 振る舞い |
|---|---|---|
| `queryBox` | クエリ全体（= テーブル） | クリックでcompact/detail切替。タイトル表示 |
| `clauseBox` | 各句（SELECT, FROM, WHERE等） | detail時のみ表示 |
| `columnItem` | カラム・条件の個別項目 | clauseBox内に配置 |
| `unresolvedBox` | 未登録テーブル | 外観を区別（点線枠等） |

### 3. compact/detail切替の実装方針

- **compact**: 子ノード群を`hidden: true`に。親ノードのサイズをコンパクト値に変更。カラム一覧はカスタムノードのdata内で直接レンダリング
- **detail**: 子ノード群を`hidden: false`に。`recalculateLayout`で親サイズを再計算

### 4. パフォーマンス見積もり

- 数十クエリ × 各5〜10句 × 各3〜5カラム = 数百〜千ノード
- ボトムアップ再計算は O(n) なのでパフォーマンス問題なし
- React Flowのレンダリング自体がボトルネックになる可能性は低い（仮想化対応済み）
