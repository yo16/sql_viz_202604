import type {
  ParsedQuery,
  ColumnRef,
  FromClause,
} from '@/types/api';
import type {
  TableNode,
} from '@/types/lineage';
import { buildAliasMap } from './buildLineageGraph';

/**
 * 未登録テーブルのカラムを、参照元クエリの情報から推定する。
 *
 * 対応機能要件: F2-4
 *
 * 収集対象（lineage-model.md セクション4.1 参照）:
 * - SELECT句のカラム参照（集約関数内・CASE式内・関数引数のカラム参照も columnRefs に含まれる）
 * - JOIN ON条件のカラム参照
 * - WHERE句のカラム参照
 * - GROUP BY のカラム参照
 * - HAVING句のカラム参照
 * - ORDER BY のカラム参照
 *
 * 設計ドキュメントの収集対象テーブルに記載された「集約関数内」「CASE式内」「関数引数」は、
 * API型定義上、各句の columnRefs 配列に既に展開された状態で含まれているため、
 * 個別の収集ロジックは不要。
 */
export function inferUnregisteredColumns(
  tables: Map<string, TableNode>,
  queries: ParsedQuery[]
): Map<string, TableNode> {
  for (const query of queries) {
    const aliasMap = buildAliasMap(query.from);
    const fromTableCount = query.from.tables.length + query.from.joins.length;

    const allRefs = collectAllColumnRefs(query);

    for (const ref of allRefs) {
      const resolvedTable = resolveTableForRef(ref, aliasMap, fromTableCount, query.from);
      if (!resolvedTable) continue;

      const table = tables.get(resolvedTable);
      if (!table || table.isRegistered) continue;

      // 未登録テーブルにカラムを追加
      if (!table.columns.has(ref.column)) {
        table.columns.set(ref.column, {
          columnName: ref.column,
          tableId: resolvedTable,
          certainty: 'inferred',
          dependencies: [],
          isFromStar: false,
          exprType: 'column_ref',
        });
      }
    }
  }

  return tables;
}

/**
 * ParsedQuery からすべてのカラム参照を収集する。
 *
 * 収集対象（lineage-model.md セクション4.1 準拠）:
 * - SELECT句の columnRefs（集約関数・CASE式・関数引数内の参照も含む）
 * - JOIN ON条件の onConditionRefs
 * - WHERE句の columnRefs
 * - GROUP BY の columnRefs
 * - HAVING句の columnRefs（集約関数内の参照も含む）
 * - ORDER BY の columnRefs
 *
 * ORDER BY は設計テーブルに明示されていないが、
 * 未登録テーブルのカラム推定に有用なため収集する。
 */
export function collectAllColumnRefs(query: ParsedQuery): ColumnRef[] {
  const refs: ColumnRef[] = [];

  // SELECT句
  for (const col of query.select.columns) {
    refs.push(...col.columnRefs);
  }

  // JOIN ON条件
  for (const join of query.from.joins) {
    refs.push(...join.onConditionRefs);
  }

  // WHERE句
  if (query.where) {
    refs.push(...query.where.columnRefs);
  }

  // GROUP BY
  if (query.groupBy) {
    refs.push(...query.groupBy.columnRefs);
  }

  // HAVING句
  if (query.having) {
    refs.push(...query.having.columnRefs);
  }

  // ORDER BY
  if (query.orderBy) {
    refs.push(...query.orderBy.columnRefs);
  }

  return refs;
}

/**
 * カラム参照がどのテーブルに帰属するかを解決する。
 *
 * ルール:
 * 1. テーブルプレフィックスあり → エイリアスマップで解決
 * 2. FROM が1テーブルのみ → そのテーブルに帰属
 * 3. 複数テーブルでプレフィックスなし → 不明（null）
 */
export function resolveTableForRef(
  ref: ColumnRef,
  aliasMap: Map<string, string>,
  fromTableCount: number,
  from: FromClause
): string | null {
  if (ref.table) {
    return aliasMap.get(ref.table) ?? ref.table;
  }

  if (fromTableCount === 1) {
    return from.tables[0]?.name ?? null;
  }

  return null;
}
