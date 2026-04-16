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

// FlowCanvas / Node 系コンポーネントの最小モック
export const ReactFlow = ({ children }: { children?: React.ReactNode }) => {
  // children をそのまま描画して内部の Background/Controls/MiniMap を呼ばせる
  const React = require('react');
  return React.createElement('div', { 'data-testid': 'react-flow' }, children);
};
export const Controls = () => null;
export const MiniMap = () => null;
export const Background = () => null;
export const BackgroundVariant = { Dots: 'dots', Lines: 'lines', Cross: 'cross' };
export const NodeResizeControl = ({ children }: { children?: React.ReactNode }) => {
  const React = require('react');
  return React.createElement('div', null, children);
};
export const useReactFlow = () => ({
  getNodes: () => [],
  getEdges: () => [],
  setNodes: () => {},
  setEdges: () => {},
});

// applyNodeChanges / applyEdgeChanges の最小モック（変更を無視）
export function applyNodeChanges<T>(_changes: unknown, nodes: T): T {
  return nodes;
}
export function applyEdgeChanges<T>(_changes: unknown, edges: T): T {
  return edges;
}

// 型の re-export
export type OnNodesChange = (changes: unknown) => void;
export type OnEdgesChange = (changes: unknown) => void;
