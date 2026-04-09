# レイアウトエンジン設計

## 関連ドキュメント

- [全体アーキテクチャ設計](./architecture.md)
- [コンポーネント設計](./component-design.md) — [compact/detail トグル動作仕様](./component-design.md#5-compact--detail-トグル動作仕様)
- [要件定義 F1-3](../requirements-phase1-2.md) — 単一クエリの可視化
- [要件定義 F1-8](../requirements-phase1-2.md) — CTE・サブクエリの入れ子表示
- [スパイク: React Flow ネスト＋動的リサイズ検証](../spikes/reactflow-nested-layout/findings.md)

---

## 1. 概要

React Flow は親ノードのサイズを子ノードに応じて自動計算しない。本プロジェクトでは独自のレイアウトエンジンを実装し、ボトムアップの再帰計算で親ノードのサイズを動的に決定する。

対応機能要件:
- F1-3: Box-in-Box構造のサイズ計算
- F1-8: ネスト構造の親boxサイズ動的拡大
- F1-4: compact/detail切替時のレイアウト再計算

---

## 2. ファイル構成

```
src/layout/
├── calculateParentSize.ts    # 子ノード群から親ノードのサイズを計算
├── recalculateLayout.ts      # ボトムアップで全ノードのサイズを再計算
└── layoutConstants.ts        # レイアウト定数の定義
```

---

## 3. レイアウト定数

```typescript
// layout/layoutConstants.ts

export const LAYOUT = {
  /** 親ノード内部の上パディング（タイトルバー分を含む） */
  PADDING_TOP: 44,
  /** 親ノード内部の左右パディング */
  PADDING_HORIZONTAL: 12,
  /** 親ノード内部の下パディング */
  PADDING_BOTTOM: 12,

  /** 子ノード間の垂直ギャップ */
  CHILD_GAP_VERTICAL: 8,
  /** 子ノード間の水平ギャップ（横並びの場合） */
  CHILD_GAP_HORIZONTAL: 16,

  /** compact表示時のノード幅 */
  COMPACT_NODE_WIDTH: 200,
  /** compact表示時のベース高さ（タイトルバー + 余白） */
  COMPACT_BASE_HEIGHT: 44,
  /** compact表示時の1カラム行あたりの高さ */
  COMPACT_COLUMN_ROW_HEIGHT: 22,
  /** compact表示時の最大カラム表示数 */
  COMPACT_MAX_COLUMNS: 10,

  /** ColumnItemNodeの高さ */
  COLUMN_ITEM_HEIGHT: 28,
  /** ColumnItemNodeの最小幅 */
  COLUMN_ITEM_MIN_WIDTH: 150,

  /** ClauseBoxのヘッダー高さ */
  CLAUSE_HEADER_HEIGHT: 28,

  /** QueryBoxの最小幅 */
  QUERY_BOX_MIN_WIDTH: 220,
  /** QueryBoxの最小高さ */
  QUERY_BOX_MIN_HEIGHT: 80,

  /** UnresolvedBoxの最小幅 */
  UNRESOLVED_BOX_MIN_WIDTH: 180,

  /** テーブルbox間の水平ギャップ（左→右フロー） */
  TABLE_GAP_HORIZONTAL: 80,
  /** テーブルbox間の垂直ギャップ（同レイヤー内） */
  TABLE_GAP_VERTICAL: 40,

  /** CTE box間の水平ギャップ（親box内の左→右フロー） */
  CTE_GAP_HORIZONTAL: 40,

  /** ネスト上限 */
  MAX_NEST_DEPTH: 5,
} as const;
```

---

## 4. calculateParentSize — 親ノードサイズ計算

### アルゴリズム

子ノード群の配置情報（position + サイズ）から、それらをすべて包含する最小の親ノードサイズを計算する。

```typescript
// layout/calculateParentSize.ts

import { Node } from '@xyflow/react';
import { LAYOUT } from './layoutConstants';

interface NodeSize {
  width: number;
  height: number;
}

/**
 * 子ノード群から親ノードのサイズを計算する。
 *
 * @param children - 親ノードに属する子ノード群
 * @returns 親ノードに必要なサイズ
 */
export function calculateParentSize(children: Node[]): NodeSize {
  if (children.length === 0) {
    return {
      width: LAYOUT.QUERY_BOX_MIN_WIDTH,
      height: LAYOUT.QUERY_BOX_MIN_HEIGHT,
    };
  }

  // 表示中の子ノードのみ対象（hidden でないもの）
  const visibleChildren = children.filter((c) => !c.hidden);

  if (visibleChildren.length === 0) {
    return {
      width: LAYOUT.QUERY_BOX_MIN_WIDTH,
      height: LAYOUT.QUERY_BOX_MIN_HEIGHT,
    };
  }

  // 各子ノードの右端・下端の最大値を求める
  let maxRight = 0;
  let maxBottom = 0;

  for (const child of visibleChildren) {
    const childWidth = child.width ?? child.measured?.width ?? 0;
    const childHeight = child.height ?? child.measured?.height ?? 0;

    const right = child.position.x + childWidth;
    const bottom = child.position.y + childHeight;

    maxRight = Math.max(maxRight, right);
    maxBottom = Math.max(maxBottom, bottom);
  }

  // パディングを加算
  const width = Math.max(
    maxRight + LAYOUT.PADDING_HORIZONTAL,
    LAYOUT.QUERY_BOX_MIN_WIDTH
  );
  const height = Math.max(
    maxBottom + LAYOUT.PADDING_BOTTOM,
    LAYOUT.QUERY_BOX_MIN_HEIGHT
  );

  return { width, height };
}
```

### 子ノード配置ロジック

子ノードの `position` は親ノードからの相対座標。配置パターンは以下の2種類:

#### パターン A: 垂直配置（句の積み重ね）

QueryBoxNode 内の ClauseBoxNode は縦方向に並べる。

```
QueryBoxNode (parent)
┌──────────────────────┐
│ タイトル              │ ← PADDING_TOP
├──────────────────────┤
│ ┌──────────────────┐ │ ← x: PADDING_HORIZONTAL
│ │ SELECT           │ │    y: PADDING_TOP
│ │  ├─ id           │ │
│ │  └─ name         │ │
│ └──────────────────┘ │
│ ┌──────────────────┐ │ ← y: PADDING_TOP + selectHeight + CHILD_GAP_VERTICAL
│ │ FROM             │ │
│ │  └─ table_a      │ │
│ └──────────────────┘ │
│ ┌──────────────────┐ │
│ │ WHERE            │ │
│ │  └─ status=...   │ │
│ └──────────────────┘ │
│         PADDING_BOTTOM│
└──────────────────────┘
```

```typescript
/**
 * 句ノード群を垂直に配置し、各ノードの position を設定する。
 */
function arrangeClauseBoxes(
  clauseNodes: Node[],
  startX: number,
  startY: number
): Node[] {
  let currentY = startY;

  return clauseNodes.map((node) => {
    const positioned = {
      ...node,
      position: { x: startX, y: currentY },
    };
    const nodeHeight = node.height ?? node.measured?.height ?? LAYOUT.CLAUSE_HEADER_HEIGHT;
    currentY += nodeHeight + LAYOUT.CHILD_GAP_VERTICAL;
    return positioned;
  });
}
```

#### パターン B: 水平配置（CTE間の左→右フロー）

CTE ボックスは親 QueryBoxNode 内で左→右に並べる。

```
QueryBoxNode (parent with CTEs)
┌────────────────────────────────────────────────────┐
│ タイトル                                            │
├────────────────────────────────────────────────────┤
│ ┌──────────┐  CTE_GAP  ┌──────────┐  CTE_GAP     │
│ │ cte_a    │───────────▶│ cte_b    │──────────┐   │
│ │ (SELECT) │            │ (SELECT) │          │   │
│ └──────────┘            └──────────┘          │   │
│                                               ▼   │
│ ┌──────────────────────────────────────────────┐  │
│ │ メインSELECT                                 │  │
│ └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

---

## 5. recalculateLayout — ボトムアップ全ノード再計算

### アルゴリズム

1. 全ノードの深さ (depth) を算出する
2. 最も深いノードから順に（ボトムアップで）サイズを再計算
3. 各親ノードのサイズ更新後、その親の親のサイズも連鎖的に更新

```typescript
// layout/recalculateLayout.ts

import { Node } from '@xyflow/react';
import { calculateParentSize } from './calculateParentSize';

/**
 * 全ノードのレイアウトをボトムアップで再計算する。
 *
 * @param nodes - 現在の全ノード
 * @returns サイズ更新済みのノード配列
 */
export function recalculateLayout(nodes: Node[]): Node[] {
  // 1. 親子関係マップの構築
  const childrenMap = buildChildrenMap(nodes);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // 2. 各ノードの深さを算出
  const depthMap = calculateDepths(nodes);

  // 3. 深さの降順でソート（最も深いノードから処理）
  const sortedParentIds = Array.from(childrenMap.keys())
    .sort((a, b) => (depthMap.get(b) ?? 0) - (depthMap.get(a) ?? 0));

  // 4. ボトムアップでサイズ再計算
  const updatedNodes = new Map(nodes.map((n) => [n.id, { ...n }]));

  for (const parentId of sortedParentIds) {
    const childIds = childrenMap.get(parentId) ?? [];
    const children = childIds
      .map((id) => updatedNodes.get(id))
      .filter((n): n is Node => n !== undefined);

    const newSize = calculateParentSize(children);
    const parent = updatedNodes.get(parentId);

    if (parent) {
      updatedNodes.set(parentId, {
        ...parent,
        width: newSize.width,
        height: newSize.height,
        style: {
          ...parent.style,
          width: newSize.width,
          height: newSize.height,
        },
      });
    }
  }

  return Array.from(updatedNodes.values());
}

/**
 * 親子関係マップを構築する。
 * key: 親ノードID, value: 子ノードIDの配列
 */
function buildChildrenMap(nodes: Node[]): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const node of nodes) {
    if (node.parentId) {
      const children = map.get(node.parentId) ?? [];
      children.push(node.id);
      map.set(node.parentId, children);
    }
  }

  return map;
}

/**
 * 各ノードのネスト深さを算出する。
 * ルートノード = 0, その子 = 1, ...
 */
function calculateDepths(nodes: Node[]): Map<string, number> {
  const depthMap = new Map<string, number>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  function getDepth(nodeId: string): number {
    if (depthMap.has(nodeId)) {
      return depthMap.get(nodeId)!;
    }

    const node = nodeMap.get(nodeId);
    if (!node || !node.parentId) {
      depthMap.set(nodeId, 0);
      return 0;
    }

    const depth = getDepth(node.parentId) + 1;
    depthMap.set(nodeId, depth);
    return depth;
  }

  for (const node of nodes) {
    getDepth(node.id);
  }

  return depthMap;
}
```

### 計算量

- 親子関係マップ構築: O(n)
- 深さ算出: O(n)（メモ化あり）
- ボトムアップ再計算: O(n)（各ノードを1回ずつ処理）
- **合計: O(n)** — 数百〜千ノード規模でもパフォーマンス問題なし

---

## 6. compact / detail 切替時のレイアウト再計算

### detail → compact

```
1. displayMode を 'compact' に変更
2. 対象 QueryBoxNode の全子孫ノードを hidden: true に設定
3. 対象 QueryBoxNode のサイズをコンパクト値に設定:
   width  = COMPACT_NODE_WIDTH (200px)
   height = COMPACT_BASE_HEIGHT + COMPACT_COLUMN_ROW_HEIGHT * min(columnCount, COMPACT_MAX_COLUMNS)
           + (columnCount > COMPACT_MAX_COLUMNS ? COMPACT_COLUMN_ROW_HEIGHT : 0)  // "+N more" 行
4. recalculateLayout を実行（祖先ノードのサイズが連鎖的に縮小）
```

### compact → detail

```
1. displayMode を 'detail' に変更
2. 対象 QueryBoxNode の直接の子ノードを hidden: false に設定
   - ただし、子の QueryBoxNode が compact モードの場合、
     その子の子孫は hidden: true のまま
3. React Flow の onNodeChange で measured サイズが更新される
4. recalculateLayout を実行（祖先ノードのサイズが連鎖的に拡大）
```

### 実装上の注意点

- React Flow の `measured` プロパティは非同期で更新される。`onNodesChange` コールバックで measured が更新されたことを検知してから `recalculateLayout` を実行する
- `requestAnimationFrame` を使って1フレーム待ってから再計算する、あるいは React Flow の `useOnSelectionChange` 等のコールバックを活用する

```typescript
// hooks/useLayoutRecalculation.ts

import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { recalculateLayout } from '@/layout/recalculateLayout';

export function useLayoutRecalculation() {
  const { getNodes, setNodes } = useReactFlow();

  const triggerRecalculation = useCallback(() => {
    // 1フレーム待ってから再計算（measured の更新を待つ）
    requestAnimationFrame(() => {
      const currentNodes = getNodes();
      const updatedNodes = recalculateLayout(currentNodes);
      setNodes(updatedNodes);
    });
  }, [getNodes, setNodes]);

  return { triggerRecalculation };
}
```

---

## 7. テーブル間レイアウト（左→右フロー）

フェーズ2でのテーブル間配置。依存関係に基づいて左→右のフローで配置する。

### 呼び出し元 (bd-sql_viz_202604_2-z0e)

`arrangeTableNodes()` は `flowStore.syncFromLineage()` の最後で呼ばれる。
パース後の `table_dependency` エッジ（`A→B` 形式）を `dependencies` 引数として渡し、
ルートレベル（`parentId === undefined`）のテーブルノード群に対して x 座標を割り当てる。

> 注意: 過去にこの呼び出しが漏れており、全ルートテーブルが `{x:0,y:0}` で重なる
> 不具合があった（bd-sql_viz_202604_2-z0e で修正）。

### アルゴリズム

1. テーブル間の依存関係からトポロジカルソート
2. ソート結果をレイヤーに分割（依存深度が同じテーブルは同一レイヤー）
3. 各レイヤーを左→右に配置、同レイヤー内は上→下に配置

```
Layer 0        Layer 1        Layer 2
┌──────┐      ┌──────┐      ┌──────┐
│ src_a│─────▶│ mid_b│─────▶│ out_d│
└──────┘      └──────┘      └──────┘
┌──────┐      ┌──────┐
│ src_c│─────▶│ mid_e│
└──────┘      └──────┘
```

```typescript
/**
 * テーブルノード群を依存関係に基づいて左→右にレイアウトする。
 */
function arrangeTableNodes(
  tableNodes: Node[],
  dependencies: Array<{ source: string; target: string }>
): Node[] {
  // 1. トポロジカルソートでレイヤー分割
  const layers = topologicalLayers(tableNodes, dependencies);

  // 2. 各レイヤーの X 位置を算出
  let currentX = 0;

  for (const layer of layers) {
    let maxWidth = 0;
    let currentY = 0;

    for (const node of layer) {
      node.position = { x: currentX, y: currentY };

      const nodeWidth = node.width ?? LAYOUT.QUERY_BOX_MIN_WIDTH;
      const nodeHeight = node.height ?? LAYOUT.QUERY_BOX_MIN_HEIGHT;

      maxWidth = Math.max(maxWidth, nodeWidth);
      currentY += nodeHeight + LAYOUT.TABLE_GAP_VERTICAL;
    }

    currentX += maxWidth + LAYOUT.TABLE_GAP_HORIZONTAL;
  }

  return layers.flat();
}
```

---

## 7.4 ネスト子の依存順横並びレイアウト (bd-sql_viz_202604_2-47d)

CTE / FROMサブクエリ / WHEREサブクエリ などの**ネスト子**は、親 QueryBox の中で
依存順に左→右で並べる。アルゴリズムは §7 の `arrangeTableNodes` をそのまま流用。

### 依存エッジの構築

ネスト子間の参照は、内部 TableNode の `dependsOn`（FROM/JOIN 由来のテーブル名集合）
に現れる。これを sibling のIDに解決して `arrangeTableNodes` の dependencies 引数
に渡す。

```
sibling-name → child-id のマップ:
  cte.name           → ${tableId}__cte__${cte.name}
  fromSub.alias      → ${tableId}__fromsub__${alias}
  whereSub.alias     → ${tableId}__wheresub__${alias}
```

各ネスト子について、`childTable.dependsOn` を走査し、sibling-name にヒットする
ものがあれば `{source: siblingId, target: currentId}` を依存エッジとして追加する。

### タイミング

ネスト子の幅は内部の clauseBox 群を含めて確定するため、`recalculateLayout` 後の
post-pass で実行する必要がある。`syncFromLineage` の deferred 処理（§7.5）と
同じパスで:

1. `recalculateLayout` 1回目 → ネスト子のサイズ確定
2. 各 deferred 親について `arrangeTableNodes(childNodes, siblingDeps)` を呼ぶ
3. 結果に親パディング `(PADDING_HORIZONTAL, PADDING_TOP)` をオフセット
4. ネスト子の最下端を計算し、その下に main clauseBox を横並び配置
5. `recalculateLayout` 2回目 → 親サイズ再計算

---

## 7.5 メインクエリ clauseBox の遅延配置 (bd-sql_viz_202604_2-u8l, bd-sql_viz_202604_2-hk1)

**配置方針** (bd-sql_viz_202604_2-hk1):
- ネスト子（CTE/サブクエリ）の**右側**に main clauseBox 群を横並びで配置する
  （当初は下配置だったが、「先に行われる処理は左、次は右」原則を入れ子構造でも
  統一するため右配置に変更）
- main clauseBox の x 座標開始点: `max(childNode.x + childNode.width) + CHILD_GAP_HORIZONTAL`
- y 座標は PADDING_TOP 共通

**clauseBox 幅統一** (bd-sql_viz_202604_2-hk1):
- 全 clauseBox の width を `LAYOUT.QUERY_BOX_MIN_WIDTH` (220) に統一する。
  以前は `COLUMN_ITEM_MIN_WIDTH` (150) で生成していたが、SELECT 句は子カラムを
  持つため `recalculateLayout` で `QUERY_BOX_MIN_WIDTH` に拡張され、x 進行と
  ずれて ORDER BY が SELECT と重なる不具合があった。全句を同じ幅で生成すれば
  `buildMainClauseNodes` の x 進行と `recalculateLayout` 後の実寸が一致する。

CTE / FROMサブクエリ / WHEREサブクエリを持つ親クエリでも、メインクエリの
SELECT/FROM/WHERE clauseBox を表示する必要がある。これらはネスト子の最下端
の下に縦積みで配置するが、子サイズは `recalculateLayout` まで未確定のため、
**2フェーズレイアウト**を採用する。

### フロー

1. **Phase 1**: `buildQueryBoxNodes` がネスト子を再帰生成
   - リーフクエリ（ネストなし）は main clauseBox を即時生成
   - ネスト持ちクエリは `deferredMainClauses: Array<{tableId, table}>` に積んで遅延
2. **Phase 2**: `recalculateLayout` で子サイズを確定
3. **Phase 3**: `deferredMainClauses` を処理
   - 各 `tableId` の親 queryBox の子ノード（CTE/サブクエリ）の最下端 Y を計算
   - その下に `buildSelectClauseNodes` → `buildFromClauseNode` → `buildWhereClauseNode` を縦積みで配置
4. **Phase 4**: `recalculateLayout` 再実行 — main clauseBox を含めて親サイズを再計算
5. **Phase 5**: `arrangeTableNodes` でルートテーブルを左→右配置（§7）

### なぜ2フェーズ必要か

`buildQueryBoxNodes` 実行時点ではネスト子ノードの `width/height` が未設定（明示的に
指定していないため）。`recalculateLayout` がボトムアップでサイズを設定する前に
main clauseBox の Y 位置を決めようとすると、子ノードの実際の高さがわからず
重なりが発生する。

---

## 8. ネスト上限の処理 (F1-8)

要件: ネスト上限5段まで分析・表示。6段以上は省略表示。

```typescript
/**
 * ネスト深度が上限を超えた場合の処理。
 * 6段目以降のサブクエリ/CTE は展開せず、
 * 「...（省略）」テキストを表示するプレースホルダーノードに置換する。
 */
function handleNestDepthLimit(depth: number, node: Node): Node {
  if (depth >= LAYOUT.MAX_NEST_DEPTH) {
    return {
      ...node,
      data: {
        ...node.data,
        isOmitted: true,
        omitMessage: `...（${depth + 1}段目以降は省略）`,
      },
    };
  }
  return node;
}
```

---

## 9. ノード順序の保証

React Flow の仕様として、`nodes` 配列で親ノードは子ノードより前に配置する必要がある。`syncFromLineage` でノードを生成する際、以下の順序を保証する。

```typescript
/**
 * ノード配列を親→子の順序にソートする。
 * React Flow v12 の要件: parentId を持つノードは、
 * その親より後に配列内に位置する必要がある。
 */
function sortNodesParentFirst(nodes: Node[]): Node[] {
  const result: Node[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();

  function visit(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return;

    // 親が先
    if (node.parentId && !visited.has(node.parentId)) {
      visit(node.parentId);
    }

    result.push(node);
  }

  for (const node of nodes) {
    visit(node.id);
  }

  return result;
}
```
