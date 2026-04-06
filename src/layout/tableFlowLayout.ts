import type { Node } from '@xyflow/react';
import { LAYOUT } from './layoutConstants';

/**
 * テーブルノード群を依存関係に基づいて左→右にレイアウトする。
 *
 * 対応機能要件: F2-1 (テーブル依存関係の自動検出・配置)
 * 設計参照: doc/design/layout-engine.md セクション7
 *
 * アルゴリズム:
 * 1. トポロジカルソートでレイヤー分割（依存深度が同じテーブルは同一レイヤー）
 * 2. 各レイヤーを左→右に配置、同レイヤー内は上→下に配置
 *
 * @param tableNodes - テーブルノード群（ルートレベルのノードのみ）
 * @param dependencies - テーブル間の依存関係（source→target）
 * @returns 位置が設定されたノード配列
 */
export function arrangeTableNodes(
  tableNodes: Node[],
  dependencies: Array<{ source: string; target: string }>
): Node[] {
  if (tableNodes.length === 0) return [];

  const layers = topologicalLayers(tableNodes, dependencies);

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

/**
 * テーブルノード群と依存関係からトポロジカルレイヤーを生成する。
 *
 * 各レイヤーには依存深度が同じテーブルが含まれる。
 * Layer 0: 依存元がないノード（上流）
 * Layer 1: Layer 0 のみに依存するノード
 * ...
 *
 * @param nodes - テーブルノード群
 * @param dependencies - テーブル間の依存関係
 * @returns レイヤー配列（各レイヤーはノードの配列）
 */
export function topologicalLayers(
  nodes: Node[],
  dependencies: Array<{ source: string; target: string }>
): Node[][] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const nodeIds = new Set(nodes.map((n) => n.id));

  // 入次数（依存元の数）を計算
  const inDegree = new Map<string, number>();
  const outEdges = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    outEdges.set(id, []);
  }

  for (const dep of dependencies) {
    if (nodeIds.has(dep.source) && nodeIds.has(dep.target)) {
      inDegree.set(dep.target, (inDegree.get(dep.target) ?? 0) + 1);
      outEdges.get(dep.source)!.push(dep.target);
    }
  }

  // BFS でレイヤーを構築
  const layers: Node[][] = [];
  const processed = new Set<string>();

  // 初期キュー: 入次数0のノード
  let currentQueue = Array.from(nodeIds).filter((id) => inDegree.get(id) === 0);

  while (currentQueue.length > 0) {
    const layer: Node[] = [];

    for (const id of currentQueue) {
      const node = nodeMap.get(id);
      if (node) {
        layer.push(node);
      }
      processed.add(id);
    }

    if (layer.length > 0) {
      layers.push(layer);
    }

    // 次のレイヤーのキューを構築
    const nextQueue: string[] = [];
    for (const id of currentQueue) {
      for (const targetId of (outEdges.get(id) ?? [])) {
        const newDegree = (inDegree.get(targetId) ?? 1) - 1;
        inDegree.set(targetId, newDegree);
        if (newDegree === 0 && !processed.has(targetId)) {
          nextQueue.push(targetId);
        }
      }
    }

    currentQueue = nextQueue;
  }

  // 循環依存で処理されなかったノードを最後のレイヤーに追加
  const remaining = Array.from(nodeIds)
    .filter((id) => !processed.has(id))
    .map((id) => nodeMap.get(id))
    .filter((n): n is Node => n !== undefined);

  if (remaining.length > 0) {
    layers.push(remaining);
  }

  return layers;
}
