// @xyflow/react のモック
export type Node = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  parentId?: string;
  extent?: string;
  width?: number;
  height?: number;
  hidden?: boolean;
};

export type Edge = {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: Record<string, unknown>;
};

export const Handle = () => null;
export const Position = { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' };
