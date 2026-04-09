import type {
  ParsedQuery,
  SelectColumn,
  FromClause,
} from '@/types/api';
import type {
  TableNode,
  ColumnNode,
  ColumnDependency,
  DependencyType,
  ClauseInfo,
  CteNode,
  SubqueryNode,
} from '@/types/lineage';

/**
 * ParsedQuery 群からリネージュグラフ（TableNode マップ）を構築する。
 *
 * パイプライン:
 * 1. registerTables: ParsedQuery → TableNode 生成 + 未登録テーブル追加
 * 2. buildColumnDependencies: カラム依存関係の構築
 *
 * inferUnregisteredColumns と propagateSelectStar は別モジュールで実行する。
 */
export function buildLineageGraph(
  queries: ParsedQuery[],
  existingTables: Map<string, TableNode> = new Map()
): Map<string, TableNode> {
  let tables = registerTables(queries, existingTables);
  tables = buildColumnDependencies(tables, queries);
  return tables;
}

/**
 * ParsedQuery 群から TableNode を生成し、マップに登録する。
 * FROM/JOIN で参照されるテーブルがまだ存在しなければ未登録テーブルとして追加。
 */
export function registerTables(
  queries: ParsedQuery[],
  existingTables: Map<string, TableNode>
): Map<string, TableNode> {
  const tables = new Map(existingTables);

  for (const query of queries) {
    const tableId = query.targetTable ?? query.queryId;
    const tableNode = createTableNode(query);
    tables.set(tableId, tableNode);

    // FROM/JOIN で参照されるテーブルの未登録チェック
    for (const fromTable of query.from.tables) {
      if (!tables.has(fromTable.name)) {
        tables.set(fromTable.name, createUnresolvedTableNode(fromTable.name));
      }
    }
    for (const join of query.from.joins) {
      if (!tables.has(join.table)) {
        tables.set(join.table, createUnresolvedTableNode(join.table));
      }
    }

    // CTE はメインテーブルの TableNode 内にネスト構造として保持される。
    // createTableNode() 内で query.ctes を再帰的に TableNode 化しているため、
    // ここでのトップレベル tables マップへの登録は不要。
    // CTE は親テーブルのスコープ内でのみ参照されるため、
    // グローバルな tables マップに追加すると名前衝突のリスクがある。
  }

  return tables;
}

/**
 * ParsedQuery から TableNode を生成する。
 */
export function createTableNode(query: ParsedQuery): TableNode {
  const tableId = query.targetTable ?? query.queryId;
  const displayTitle = query.targetTable ?? '[問い合わせ]';

  // dependsOn: FROM/JOIN テーブル名の集合
  const dependsOn = new Set<string>();
  for (const fromTable of query.from.tables) {
    dependsOn.add(fromTable.name);
  }
  for (const join of query.from.joins) {
    dependsOn.add(join.table);
  }

  // 句情報（可視化用）
  const clauses: ClauseInfo = {
    select: {
      columns: query.select.columns.map((col) => ({
        displayName: col.displayName,
        sourceTable: col.sourceTable,
        sourceColumn: col.sourceColumn,
        exprType: col.exprType,
      })),
    },
    from: {
      tables: query.from.tables.map((t) => ({
        name: t.name,
        alias: t.alias,
      })),
      joins: query.from.joins.map((j) => ({
        joinType: j.joinType,
        table: j.table,
        alias: j.alias,
        onConditionText: j.onConditionText,
      })),
    },
    where: query.where ? { conditionText: query.where.conditionText } : null,
    groupBy: query.groupBy ? { expressionText: query.groupBy.expressionText } : null,
    having: query.having ? { conditionText: query.having.conditionText } : null,
    orderBy: query.orderBy ? { expressionText: query.orderBy.expressionText } : null,
  };

  // CTE ノード
  // bd-sql_viz_202604_2-9rp: 内部 TableNode の displayTitle を CTE 名で上書きする
  // （createTableNode 単体では targetTable=null のため "[問い合わせ]" になってしまう）
  const ctes: CteNode[] = query.ctes.map((cte) => {
    const inner = createTableNode(cte.query);
    inner.displayTitle = cte.name;
    return { name: cte.name, tableNode: inner };
  });

  // FROM サブクエリ — エイリアス名を displayTitle に
  const fromSubqueries: SubqueryNode[] = query.from.subqueries.map((sq) => {
    const inner = createTableNode(sq.query);
    inner.displayTitle = sq.alias;
    return { alias: sq.alias, tableNode: inner };
  });

  // WHERE サブクエリ — エイリアスがあれば名前、無ければ "[サブクエリ]" のまま
  const whereSubqueries: SubqueryNode[] = query.where
    ? query.where.subqueries.map((sq) => {
        const inner = createTableNode(sq.query);
        inner.displayTitle = sq.alias && sq.alias.length > 0 ? sq.alias : '[サブクエリ]';
        return { alias: sq.alias, tableNode: inner };
      })
    : [];

  // カラム情報を populate する（CTE / サブクエリ内部の TableNode も含めて全て）
  // bd-sql_viz_202604_2-2ml: 以前は空 Map で、buildColumnDependencies がトップレベル
  // のみ埋めていたため CTE 内部にカラムが設定されず QueryBox が空表示になっていた。
  const aliasMap = buildAliasMap(query.from);
  const columns = new Map<string, ColumnNode>();
  for (const col of query.select.columns) {
    const columnNode = createColumnNode(col, tableId, aliasMap);
    columns.set(columnNode.columnName, columnNode);
  }

  return {
    id: tableId,
    name: query.targetTable,
    displayTitle,
    isRegistered: true,
    queryType: query.queryType,
    queryId: query.queryId,
    columns,
    dependsOn,
    ctes,
    fromSubqueries,
    whereSubqueries,
    clauses,
  };
}

/**
 * 未登録テーブルの TableNode を生成する。
 */
export function createUnresolvedTableNode(name: string): TableNode {
  return {
    id: name,
    name: name,
    displayTitle: `[未登録] ${name}`,
    isRegistered: false,
    queryType: 'unresolved',
    queryId: null,
    columns: new Map(),
    dependsOn: new Set(),
    ctes: [],
    fromSubqueries: [],
    whereSubqueries: [],
    clauses: {
      select: { columns: [] },
      from: { tables: [], joins: [] },
      where: null,
      groupBy: null,
      having: null,
      orderBy: null,
    },
  };
}

/**
 * 各テーブルのカラム依存関係を構築する。
 */
export function buildColumnDependencies(
  tables: Map<string, TableNode>,
  queries: ParsedQuery[]
): Map<string, TableNode> {
  for (const query of queries) {
    const tableId = query.targetTable ?? query.queryId;
    const table = tables.get(tableId);
    if (!table) continue;

    const aliasMap = buildAliasMap(query.from);

    for (const col of query.select.columns) {
      const columnNode = createColumnNode(col, tableId, aliasMap);
      table.columns.set(columnNode.columnName, columnNode);
    }
  }

  return tables;
}

/**
 * FROM句からエイリアス → 実テーブル名のマップを構築する。
 */
export function buildAliasMap(from: FromClause): Map<string, string> {
  const map = new Map<string, string>();

  for (const table of from.tables) {
    if (table.alias) {
      map.set(table.alias, table.name);
    }
    map.set(table.name, table.name);
  }

  for (const join of from.joins) {
    if (join.alias) {
      map.set(join.alias, join.table);
    }
    map.set(join.table, join.table);
  }

  return map;
}

/**
 * SelectColumn から ColumnNode を生成する。
 */
export function createColumnNode(
  col: SelectColumn,
  tableId: string,
  aliasMap: Map<string, string>
): ColumnNode {
  const dependencies: ColumnDependency[] = [];

  for (const ref of col.columnRefs) {
    const resolvedTable = ref.table ? (aliasMap.get(ref.table) ?? ref.table) : null;
    if (resolvedTable) {
      dependencies.push({
        sourceTableId: resolvedTable,
        sourceColumn: ref.column,
        type: classifyDependencyType(col.exprType),
      });
    }
  }

  return {
    columnName: col.displayName,
    tableId,
    certainty: 'confirmed',
    dependencies,
    isFromStar: col.exprType === 'star' || col.exprType === 'table_star',
    exprType: col.exprType,
  };
}

/**
 * SelectColumn の exprType から DependencyType を分類する。
 */
export function classifyDependencyType(exprType: SelectColumn['exprType']): DependencyType {
  switch (exprType) {
    case 'column_ref':
      return 'direct';
    case 'star':
    case 'table_star':
      return 'star';
    case 'expression':
      return 'expression';
    case 'aggr_func':
      return 'aggregate';
    case 'literal':
      // literal はカラム参照を持たないため columnRefs が空になり、
      // 実際にはこの DependencyType は使用されない。フォールバック値として direct を返す。
      return 'direct';
    default:
      return 'direct';
  }
}
