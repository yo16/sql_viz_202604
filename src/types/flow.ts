import type { Node, Edge } from '@xyflow/react';
import type { TableNode, Certainty } from './lineage';
import type { SelectColumn } from './api';

/** 表示モード */
export type DisplayMode = 'compact' | 'detail';

/** QueryBoxNode のデータ型 */
export interface QueryBoxNodeData {
  /** テーブル名（CTAS の場合はターゲットテーブル名） */
  tableName: string;
  /** 表示タイトル（F1-6: targetTableがなければ "[問い合わせ]"） */
  title: string;
  /** クエリ種別 */
  queryType: 'select' | 'ctas';
  /** 現在の表示モード */
  displayMode: DisplayMode;
  /** compact時に表示するカラム名一覧 */
  compactColumns: string[];
  /** このノードが登録済みかどうか */
  isRegistered: boolean;
  /** ネスト上限超過により省略されているかどうか (F1-8) */
  isOmitted?: boolean;
  /** 省略表示メッセージ */
  omitMessage?: string;
  /** ネストの深さ（ルート = 0） */
  nestDepth?: number;
}

/** ClauseBoxNode のデータ型 */
export interface ClauseBoxNodeData {
  /** 句の種別 */
  clauseType: 'SELECT' | 'FROM' | 'WHERE' | 'GROUP BY' | 'HAVING' | 'ORDER BY';
  /** 句のラベル表示 */
  label: string;
}

/** ColumnItemNode のデータ型 */
export interface ColumnItemNodeData {
  /** 表示名 */
  displayName: string;
  /** ソーステーブル名（あれば） */
  sourceTable: string | null;
  /** 式の種別 */
  exprType: SelectColumn['exprType'];
  /** カラムの確度 */
  certainty: Certainty;
  /** リネージュハイライト中かどうか */
  isHighlighted: boolean;
  /** WHERE/HAVING等の条件テキスト（条件ノードの場合） */
  conditionText: string | null;
}

/** UnresolvedBoxNode のデータ型 */
export interface UnresolvedBoxNodeData {
  /** テーブル名 */
  tableName: string;
  /** 推定されたカラム一覧 */
  inferredColumns: string[];
  /** 表示モード */
  displayMode: DisplayMode;
}

/** カスタムノードのデータ型（ユニオン） */
export type FlowNodeData =
  | QueryBoxNodeData
  | ClauseBoxNodeData
  | ColumnItemNodeData
  | UnresolvedBoxNodeData;

/** カスタムノード型 */
export type FlowNode = Node<FlowNodeData & Record<string, unknown>>;

/** カスタムエッジ型 */
export type FlowEdge = Edge;

/** flowStore の状態型 */
export interface FlowState {
  /** React Flow ノード群 */
  nodes: FlowNode[];
  /** React Flow エッジ群 */
  edges: FlowEdge[];
  /** 各テーブルの表示モード */
  displayModes: Map<string, DisplayMode>;
  /** 現在ハイライト中のカラムパス */
  highlightPath: { tableId: string; columnName: string } | null;
}

/** flowStore のアクション型 */
export interface FlowActions {
  /** lineageStore の状態から React Flow ノード/エッジを生成 */
  syncFromLineage: (tables: Map<string, TableNode>) => void;
  /** 指定テーブルの compact/detail をトグル */
  toggleDisplayMode: (tableId: string) => void;
  /** カラムクリック時のリネージュハイライト */
  highlightLineage: (tableId: string, columnName: string) => void;
  /** ハイライトをクリア */
  clearHighlight: () => void;
}

/** flowStore の完全型 */
export type FlowStore = FlowState & FlowActions;
