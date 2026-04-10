/**
 * React Flow ネスト＋動的リサイズの設計検証
 *
 * ブラウザ実行が必要なためコードとしては実行しない。
 * ドキュメント調査に基づく設計検証と擬似コードで検証する。
 */

// =============================================================
// 検証1: 親子ノードの基本構造
// =============================================================
//
// React Flow v12 では parentId で親子関係を定義。
// 子ノードの position は親の左上を原点とした相対座標。
// 親は nodes 配列で子より前に配置する必要がある。
//
// 結論: ✅ 基本的な親子配置は問題なし

const parentChildExample = [
  {
    id: 'query-1',
    type: 'queryBox',     // カスタムノードタイプ
    data: { label: 'CREATE TABLE summary' },
    position: { x: 0, y: 0 },
    style: { width: 400, height: 300 }, // 初期サイズ（後で動的に更新）
  },
  {
    id: 'query-1-select',
    type: 'clauseBox',
    data: { label: 'SELECT', columns: ['dept', 'COUNT(*) as cnt'] },
    position: { x: 20, y: 40 },  // 親の左上からの相対座標
    parentId: 'query-1',
    extent: 'parent',  // 親の外にドラッグできない
  },
  {
    id: 'query-1-from',
    type: 'clauseBox',
    data: { label: 'FROM', tables: ['employees'] },
    position: { x: 20, y: 120 },
    parentId: 'query-1',
    extent: 'parent',
  },
];


// =============================================================
// 検証2: 動的リサイズの方法
// =============================================================
//
// React Flow v12 では:
// - node.width / node.height を設定すると「固定サイズ」になる（inline style）
// - 設定しなければ「コンテンツベースの動的サイズ」になり、measured.width/height で取得
//
// 問題: 親ノードはコンテンツ（子ノード）のサイズを自動認識しない。
//        子ノードはReact Flow上の「別のノード」であり、HTMLの子要素ではない。
//        → 親のサイズは自前で計算して更新する必要がある。
//
// 方法: onNodesChange コールバックで子ノードの位置・サイズ変化を検知し、
//       親ノードの width/height を再計算して setNodes で更新。

function calculateParentSize(parentId, allNodes, padding) {
  const children = allNodes.filter(n => n.parentId === parentId);
  if (children.length === 0) return { width: 200, height: 100 }; // 最小サイズ

  let maxRight = 0;
  let maxBottom = 0;

  for (const child of children) {
    const childWidth = child.measured?.width || child.width || 150;
    const childHeight = child.measured?.height || child.height || 40;
    const right = child.position.x + childWidth;
    const bottom = child.position.y + childHeight;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  return {
    width: maxRight + padding.right,
    height: maxBottom + padding.bottom,
  };
}

// 結論: ⚠️ 実現可能だが自前のレイアウト計算ロジックが必要


// =============================================================
// 検証3: compact/detail トグル
// =============================================================
//
// compact: 子ノード（句box）を非表示にし、親ノードのサイズを縮小
// detail:  子ノードを表示し、親ノードのサイズを再計算
//
// 方法: ノードの hidden プロパティで子ノードの表示/非表示を切り替え、
//       親ノードのサイズを切り替え後の状態に合わせて更新。

function toggleDetailMode(queryNodeId, nodes, setNodes, isDetail) {
  setNodes(prev => prev.map(node => {
    // 対象クエリの子ノード
    if (node.parentId === queryNodeId) {
      return { ...node, hidden: !isDetail };
    }
    // 親ノードのサイズ変更
    if (node.id === queryNodeId) {
      if (isDetail) {
        // detail: 子ノードに基づくサイズ（再計算必要）
        const size = calculateParentSize(queryNodeId, prev, { right: 20, bottom: 20 });
        return { ...node, style: { ...node.style, ...size } };
      } else {
        // compact: カラム一覧表示用のコンパクトサイズ
        return { ...node, style: { ...node.style, width: 200, height: 80 } };
      }
    }
    return node;
  }));
}

// 結論: ✅ hidden + サイズ再計算で実現可能


// =============================================================
// 検証4: 多段ネスト（CTE・サブクエリ）
// =============================================================
//
// 構造例: クエリbox > CTE box > 句box > カラム
//
// React Flow の parentId は多段ネストをサポート:
//   孫ノードの parentId = 子ノードのid
//   子ノードの parentId = 親ノードのid
//
// 問題: サイズ再計算が再帰的に必要。
//   孫が展開 → 子のサイズ再計算 → 親のサイズ再計算
//
// 5段ネストでの計算量:
//   各レベルでそのレベルの子ノードを走査するだけなので O(n) （n = 総ノード数）
//   パフォーマンス的には問題なし（数十クエリ = 数百ノード程度）

function recalculateAllParentSizes(nodes, padding) {
  // ボトムアップで再計算: 最深の親から順に
  const parentIds = [...new Set(nodes.filter(n => n.parentId).map(n => n.parentId))];

  // 深さ順にソート（深いものから先に計算）
  const depthMap = {};
  function getDepth(nodeId) {
    if (depthMap[nodeId] !== undefined) return depthMap[nodeId];
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !node.parentId) return (depthMap[nodeId] = 0);
    return (depthMap[nodeId] = 1 + getDepth(node.parentId));
  }
  parentIds.forEach(id => getDepth(id));
  parentIds.sort((a, b) => (depthMap[b] || 0) - (depthMap[a] || 0));

  const sizeUpdates = {};
  for (const pid of parentIds) {
    const size = calculateParentSize(pid, nodes, padding);
    sizeUpdates[pid] = size;
    // 次の親のサイズ計算に使えるよう、ノードのサイズを仮更新
    const parentNode = nodes.find(n => n.id === pid);
    if (parentNode) {
      parentNode.width = size.width;
      parentNode.height = size.height;
    }
  }
  return sizeUpdates;
}

// 結論: ✅ ボトムアップ再計算で実現可能。パフォーマンスも問題なし。


// =============================================================
// 検証5: 親box境界を貫通するエッジ
// =============================================================
//
// React Flow では子ノードにもハンドル（source/target）を設定できる。
// 子ノード同士のエッジ、外部ノードから子ノードへのエッジも描画可能。
// エッジは親boxの境界を自動的に貫通して描画される。
//
// ただし、エッジのパスが親boxの枠線と重なるため、
// zIndex の調整やエッジの色・太さの工夫が必要。

// 結論: ✅ React Flow の標準機能で対応可能。zIndex調整は必要。


// =============================================================
// 総合結論
// =============================================================
console.log(`
=== React Flow ネスト＋動的リサイズ 検証結論 ===

1. 親子ノード配置: ✅ parentId で問題なし
2. 動的リサイズ:   ⚠️ 自前のレイアウト計算ロジックが必要
3. compact/detail:  ✅ hidden + サイズ再計算で実現可能
4. 多段ネスト:     ✅ ボトムアップ再帰計算で対応
5. エッジ貫通:     ✅ 標準機能で対応、zIndex調整が必要

主要リスク:
- レイアウト計算ロジックの複雑さ（独立モジュールとして設計すべき）
- compact/detail切替時のレイアウト再計算コスト（数百ノードなら問題なし）
- カスタムノードタイプの実装量（queryBox, clauseBox, columnBox 等）
`);
