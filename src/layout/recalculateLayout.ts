import type { Node } from '@xyflow/react';
import { calculateParentSize } from './calculateParentSize';

/**
 * 全ノードのレイアウトをボトムアップで再計算する。
 *
 * 対応機能要件: F1-3 (Box-in-Box構造), F1-8 (ネスト構造), F1-4 (compact/detail切替)
 *
 * アルゴリズム:
 * 1. 親子関係マップを構築
 * 2. 各ノードのネスト深さを算出
 * 3. 深さの降順（最も深いノードから）でサイズを再計算
 * 4. calculateParentSize で子ノード群から親サイズを算出
 *
 * @param nodes - 現在の全ノード
 * @returns サイズ更新済みのノード配列
 */
export function recalculateLayout(nodes: Node[]): Node[] {
  if (nodes.length === 0) return [];

  // 1. 親子関係マップの構築
  const childrenMap = buildChildrenMap(nodes);

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
 * メモ化によりO(n)で計算。
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
