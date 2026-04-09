import { v4 as uuidv4 } from 'uuid';
import { Parser, type AST } from 'node-sql-parser';

/**
 * node-sql-parser の Parser インスタンス (bd-sql_viz_202604_2-hgg)。
 * `exprToSQL` を使って複雑な式 (IN (subquery) など) を SQL 文字列に変換する。
 */
const sharedParser = new Parser();
import type {
  ParsedQuery,
  SelectClause,
  SelectColumn,
  ColumnRef,
  FromClause,
  FromTable,
  JoinInfo,
  SubqueryInfo,
  WhereClause,
  GroupByClause,
  HavingClause,
  OrderByClause,
  CteDefinition,
} from '@/types/api';

/**
 * node-sql-parser の AST から ParsedQuery を生成する。
 *
 * 対応機能要件: F1-2 (SQLパース), F1-5 (CTAS), F1-6 (単純SELECT)
 * 設計参照: doc/design/api-design.md
 */
export function extractQueryStructure(ast: AST | AST[], rawSql: string): ParsedQuery {
  const node = Array.isArray(ast) ? ast[0] : ast;
  if (!node) {
    throw new Error('Empty AST');
  }

  // CTAS (CREATE TABLE AS SELECT)
  if (node.type === 'create' && (node as any).query_expr) {
    const createNode = node as any;
    const targetTable = createNode.table?.[0]?.table ?? null;
    const selectAst = createNode.query_expr;
    return buildParsedQuery(selectAst, rawSql, targetTable, 'ctas');
  }

  // SELECT
  if (node.type === 'select') {
    return buildParsedQuery(node as any, rawSql, null, 'select');
  }

  throw new Error(`Unsupported AST type: ${node.type}`);
}

/**
 * SELECT AST ノードから ParsedQuery を構築する。
 */
function buildParsedQuery(
  selectAst: any,
  rawSql: string,
  targetTable: string | null,
  queryType: 'select' | 'ctas'
): ParsedQuery {
  const selectClause = extractSelectClause(selectAst.columns);
  const fromClause = extractFromClause(selectAst.from ?? [], rawSql);
  const whereClause = selectAst.where ? extractWhereClause(selectAst.where, rawSql) : null;
  const groupByClause = selectAst.groupby ? extractGroupByClause(selectAst.groupby) : null;
  const havingClause = selectAst.having ? extractHavingClause(selectAst.having) : null;
  const orderByClause = selectAst.orderby ? extractOrderByClause(selectAst.orderby) : null;
  const ctes = extractCtes(selectAst.with, rawSql);

  return {
    queryId: uuidv4(),
    rawSql,
    targetTable,
    queryType,
    select: selectClause,
    from: fromClause,
    where: whereClause,
    groupBy: groupByClause,
    having: havingClause,
    orderBy: orderByClause,
    ctes,
  };
}

// =========================================
// SELECT clause extraction
// =========================================

function extractSelectClause(columns: any[]): SelectClause {
  if (!columns || !Array.isArray(columns)) {
    return { columns: [] };
  }

  return {
    columns: columns.map((col) => extractSelectColumn(col)),
  };
}

function extractSelectColumn(col: any): SelectColumn {
  const expr = col.expr;
  const alias = col.as ?? null;

  // SELECT *
  if (expr.type === 'column_ref' && expr.column === '*' && !expr.table) {
    return {
      displayName: '*',
      sourceTable: null,
      sourceColumn: null,
      exprType: 'star',
      columnRefs: [],
      starSourceTable: null,
    };
  }

  // SELECT t.*
  if (expr.type === 'column_ref' && expr.column === '*' && expr.table) {
    return {
      displayName: `${expr.table}.*`,
      sourceTable: expr.table,
      sourceColumn: null,
      exprType: 'table_star',
      columnRefs: [],
      starSourceTable: expr.table,
    };
  }

  // Simple column_ref
  if (expr.type === 'column_ref') {
    const colName = extractColumnName(expr.column);
    const displayName = alias ?? colName;
    return {
      displayName,
      sourceTable: expr.table ?? null,
      sourceColumn: colName,
      exprType: 'column_ref',
      columnRefs: [{ table: expr.table ?? null, column: colName }],
      starSourceTable: null,
    };
  }

  // Aggregate function
  if (expr.type === 'aggr_func') {
    const refs = collectColumnRefsFromExpr(expr);
    const displayName = alias ?? formatAggrFunc(expr);
    return {
      displayName,
      sourceTable: null,
      sourceColumn: null,
      exprType: 'aggr_func',
      columnRefs: refs,
      starSourceTable: null,
    };
  }

  // Literal values
  if (expr.type === 'number' || expr.type === 'single_quote_string' || expr.type === 'bool') {
    return {
      displayName: alias ?? String(expr.value),
      sourceTable: null,
      sourceColumn: null,
      exprType: 'literal',
      columnRefs: [],
      starSourceTable: null,
    };
  }

  // General expression (binary_expr, function, case, etc.)
  const refs = collectColumnRefsFromExpr(expr);
  const displayName = alias ?? '(expr)';
  return {
    displayName,
    sourceTable: null,
    sourceColumn: null,
    exprType: 'expression',
    columnRefs: refs,
    starSourceTable: null,
  };
}

// =========================================
// FROM clause extraction
// =========================================

function extractFromClause(fromList: any[], rawSql: string): FromClause {
  const tables: FromTable[] = [];
  const joins: JoinInfo[] = [];
  const subqueries: SubqueryInfo[] = [];

  if (!fromList || !Array.isArray(fromList)) {
    return { tables, joins, subqueries };
  }

  for (const item of fromList) {
    const isSubquery = item.expr && item.expr.ast;
    const hasJoin = !!item.join;

    // Subquery in FROM — subqueries 配列に登録（JOIN と排他ではない）
    // bd-sql_viz_202604_2-ih7: 以前はここで continue して JOIN 情報を捨てていた
    if (isSubquery) {
      const subAlias = item.as ?? '[サブクエリ]';
      const subQuery = buildParsedQuery(item.expr.ast, rawSql, null, 'select');
      subqueries.push({ alias: subAlias, query: subQuery });
    }

    // JOIN — subquery の JOIN もここで記録する (bd-sql_viz_202604_2-ih7)
    // table はサブクエリの alias を使う。これにより dependsOn や FROM ラベルが
    // 正しく構築される。
    if (hasJoin) {
      const joinType = normalizeJoinType(item.join);
      const onRefs = item.on ? collectColumnRefsFromExpr(item.on) : [];
      const onText = item.on ? formatExpr(item.on) : '';
      const joinTable: string = isSubquery
        ? (item.as ?? '[サブクエリ]')
        : item.table;
      joins.push({
        joinType,
        table: joinTable,
        alias: isSubquery ? null : (item.as ?? null),
        onConditionRefs: onRefs,
        onConditionText: onText,
      });
      continue;
    }

    // Subquery without JOIN (e.g., the first FROM item) — continue after recording
    if (isSubquery) continue;

    // Regular table
    if (item.table) {
      tables.push({
        name: item.table,
        alias: item.as ?? null,
      });
    }
  }

  return { tables, joins, subqueries };
}

function normalizeJoinType(join: string): 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS' {
  const upper = join.toUpperCase();
  if (upper.includes('LEFT')) return 'LEFT';
  if (upper.includes('RIGHT')) return 'RIGHT';
  if (upper.includes('FULL')) return 'FULL';
  if (upper.includes('CROSS')) return 'CROSS';
  return 'INNER';
}

// =========================================
// WHERE clause extraction
// =========================================

function extractWhereClause(whereAst: any, rawSql: string = ''): WhereClause {
  const refs = collectColumnRefsFromExpr(whereAst);

  // bd-sql_viz_202604_2-7kq: WHERE 内のサブクエリ (IN, EXISTS, =, ALL, ANY 等) を
  // 再帰的に抽出する。無名なので [WHERE サブクエリ N] の連番 alias を付与する。
  const subqueries: SubqueryInfo[] = [];
  let counter = 0;
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    // select 型のノードはサブクエリ本体
    if (node.type === 'select') {
      counter += 1;
      const alias = `[WHERE サブクエリ ${counter}]`;
      const inner = buildParsedQuery(node, rawSql, null, 'select');
      subqueries.push({ alias, query: inner });
      return; // 内部の更にネストされたサブクエリは inner ParsedQuery 側で抽出される
    }
    // IN (SELECT ...) の場合: expr_list.value[] の各要素に { ast: {type:'select'} } が入る
    // また unary/existence (EXISTS) 等でも直接 ast フィールドにぶら下がる
    if (node.ast && typeof node.ast === 'object') {
      visit(node.ast);
    }
    // 再帰対象となるフィールド
    for (const key of ['left', 'right', 'expr', 'args', 'value']) {
      const child = node[key];
      if (!child) continue;
      if (Array.isArray(child)) {
        for (const c of child) visit(c);
      } else if (typeof child === 'object') {
        visit(child);
      }
    }
  };
  visit(whereAst);

  return {
    columnRefs: refs,
    conditionText: formatExpr(whereAst),
    subqueries,
  };
}

// =========================================
// GROUP BY clause extraction
// =========================================

function extractGroupByClause(groupByAst: any): GroupByClause {
  const columns = groupByAst.columns ?? groupByAst;
  const refs: ColumnRef[] = [];

  if (Array.isArray(columns)) {
    for (const col of columns) {
      refs.push(...collectColumnRefsFromExpr(col));
    }
  }

  return {
    columnRefs: refs,
    expressionText: formatGroupBy(columns),
  };
}

// =========================================
// HAVING clause extraction
// =========================================

function extractHavingClause(havingAst: any): HavingClause {
  return {
    columnRefs: collectColumnRefsFromExpr(havingAst),
    conditionText: formatExpr(havingAst),
  };
}

// =========================================
// ORDER BY clause extraction
// =========================================

function extractOrderByClause(orderByAst: any): OrderByClause {
  const refs: ColumnRef[] = [];

  if (Array.isArray(orderByAst)) {
    for (const item of orderByAst) {
      refs.push(...collectColumnRefsFromExpr(item.expr ?? item));
    }
  }

  return {
    columnRefs: refs,
    expressionText: formatOrderBy(orderByAst),
  };
}

// =========================================
// CTE extraction
// =========================================

function extractCtes(withClause: any[] | null, rawSql: string): CteDefinition[] {
  if (!withClause || !Array.isArray(withClause)) return [];

  return withClause.map((cte) => {
    const name = typeof cte.name === 'string' ? cte.name : cte.name?.value ?? 'unknown';
    const cteAst = cte.stmt?.ast;
    const query = cteAst
      ? buildParsedQuery(cteAst, rawSql, null, 'select')
      : buildParsedQuery({ type: 'select', columns: [], from: [] }, rawSql, null, 'select');
    return { name, query };
  });
}

// =========================================
// Column reference collection (recursive)
// =========================================

/**
 * AST式ノードからカラム参照を再帰的に収集する。
 */
export function collectColumnRefsFromExpr(expr: any): ColumnRef[] {
  if (!expr) return [];

  const refs: ColumnRef[] = [];

  if (expr.type === 'column_ref') {
    const colName = extractColumnName(expr.column);
    if (colName !== '*') {
      refs.push({ table: expr.table ?? null, column: colName });
    }
    return refs;
  }

  // Binary expression (a.x = b.y, a.x + a.y, etc.)
  if (expr.type === 'binary_expr') {
    refs.push(...collectColumnRefsFromExpr(expr.left));
    refs.push(...collectColumnRefsFromExpr(expr.right));
    return refs;
  }

  // Aggregate function
  if (expr.type === 'aggr_func' && expr.args) {
    if (expr.args.expr) {
      refs.push(...collectColumnRefsFromExpr(expr.args.expr));
    }
    return refs;
  }

  // Function call
  if (expr.type === 'function' && expr.args) {
    if (expr.args.value && Array.isArray(expr.args.value)) {
      for (const arg of expr.args.value) {
        refs.push(...collectColumnRefsFromExpr(arg));
      }
    }
    return refs;
  }

  // Unary expression
  if (expr.type === 'unary_expr') {
    refs.push(...collectColumnRefsFromExpr(expr.expr));
    return refs;
  }

  // CASE expression
  if (expr.type === 'case') {
    if (expr.args) {
      for (const arg of expr.args) {
        if (arg.cond) refs.push(...collectColumnRefsFromExpr(arg.cond));
        if (arg.result) refs.push(...collectColumnRefsFromExpr(arg.result));
      }
    }
    return refs;
  }

  // IN expression list
  if (expr.type === 'expr_list' && Array.isArray(expr.value)) {
    for (const item of expr.value) {
      refs.push(...collectColumnRefsFromExpr(item));
    }
    return refs;
  }

  return refs;
}

// =========================================
// Formatting helpers
// =========================================

function extractColumnName(column: any): string {
  if (typeof column === 'string') return column;
  if (column?.expr?.value) return String(column.expr.value);
  return String(column);
}

function formatAggrFunc(expr: any): string {
  const name = expr.name ?? 'FUNC';
  if (expr.args?.expr?.type === 'column_ref') {
    const col = expr.args.expr;
    const colName = extractColumnName(col.column);
    return col.table ? `${name}(${col.table}.${colName})` : `${name}(${colName})`;
  }
  return `${name}(...)`;
}

function formatExpr(expr: any): string {
  if (!expr) return '';

  // bd-sql_viz_202604_2-hgg: まず Parser.exprToSQL で整形を試す。
  // これにより IN (subquery), BETWEEN, 関数呼び出し、単項演算子など
  // 旧 formatExpr が対応していなかった式も正しく変換される。
  try {
    const maybe: unknown = (sharedParser as unknown as {
      exprToSQL?: (e: unknown, opt?: unknown) => string;
    }).exprToSQL?.(expr, { database: 'BigQuery' });
    if (typeof maybe === 'string' && maybe.length > 0) {
      // バッククォート (MySQL スタイル) を取り除いて見やすくする
      return maybe.replace(/`/g, '');
    }
  } catch {
    // fall through to legacy formatter
  }

  if (expr.type === 'column_ref') {
    const colName = extractColumnName(expr.column);
    return expr.table ? `${expr.table}.${colName}` : colName;
  }

  if (expr.type === 'binary_expr') {
    return `${formatExpr(expr.left)} ${expr.operator} ${formatExpr(expr.right)}`;
  }

  if (expr.type === 'number') return String(expr.value);
  if (expr.type === 'single_quote_string') return `'${expr.value}'`;
  if (expr.type === 'bool') return String(expr.value);

  return '...';
}

function formatGroupBy(columns: any): string {
  if (!Array.isArray(columns)) return '';
  return columns.map((col: any) => formatExpr(col)).join(', ');
}

function formatOrderBy(orderByAst: any): string {
  if (!Array.isArray(orderByAst)) return '';
  return orderByAst.map((item: any) => {
    const expr = formatExpr(item.expr ?? item);
    const dir = item.type === 'DESC' ? ' DESC' : '';
    return expr + dir;
  }).join(', ');
}
