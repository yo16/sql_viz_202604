import type { Node } from '@xyflow/react';
import { LAYOUT } from './layoutConstants';

export interface NodeSize {
  width: number;
  height: number;
}

/**
 * 子ノード群から親ノードのサイズを計算する。
 *
 * 子ノードの position + サイズから、すべてを包含する最小の親サイズを算出し、
 * パディングと最小サイズの制約を適用する。
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

  // パディングを加算し、最小サイズと比較
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
