/**
 * レイアウトエンジンで使用する定数群。
 * doc/design/layout-engine.md セクション3 に準拠。
 */
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
  /** compact表示時��最大カラム表示数 */
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

  /** テーブルbox間��水平ギャップ（左→右フロー） */
  TABLE_GAP_HORIZONTAL: 80,
  /** テーブルbox間の垂直ギャップ（同レイヤー内） */
  TABLE_GAP_VERTICAL: 40,

  /** CTE box間の水平ギャップ（親box内の左→右フロー） */
  CTE_GAP_HORIZONTAL: 40,

  /** ネスト上限 */
  MAX_NEST_DEPTH: 5,
} as const;
