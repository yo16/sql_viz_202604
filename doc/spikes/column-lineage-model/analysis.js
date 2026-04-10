/**
 * カラムリネージュ データモデル検証
 *
 * node-sql-parserのASTから、カラムレベルの依存関係グラフを構築する
 * アルゴリズムとデータモデルの検証。
 */
const { Parser } = require('node-sql-parser');

// node-sql-parserをこのディレクトリでも使うため、spike1から参照
// → 別途installする

// =============================================================
// 1. データモデル定義
// =============================================================

/**
 * カラムの依存種別
 */
const DependencyType = {
  DIRECT: 'direct',           // SELECT a.col → そのまま参照
  EXPRESSION: 'expression',   // SELECT a.x + a.y AS total → 式内参照
  CONDITION: 'condition',     // WHERE a.col > 10 → 条件参照
  AGGREGATE: 'aggregate',     // SUM(a.col) → 集約対象
  JOIN_KEY: 'join_key',       // ON a.id = b.id → 結合キー
  STAR: 'star',               // SELECT * → 全カラム伝播
};

/**
 * カラムの確度
 */
const Certainty = {
  CONFIRMED: 'confirmed',     // パース結果から確定
  INFERRED: 'inferred',       // 推定（未登録テーブルから）
  PROPAGATED: 'propagated',   // SELECT * で伝播
};

/**
 * テーブルノード
 */
class TableNode {
  constructor(name, { isRegistered = true } = {}) {
    this.name = name;
    this.isRegistered = isRegistered;
    this.columns = new Map(); // columnName → ColumnNode
  }
}

/**
 * カラムノード
 */
class ColumnNode {
  constructor(tableName, columnName, { certainty = Certainty.CONFIRMED } = {}) {
    this.tableName = tableName;
    this.columnName = columnName;
    this.certainty = certainty;
    this.dependencies = []; // ColumnDependency[]
  }
}

/**
 * カラム間の依存関係（エッジ）
 */
class ColumnDependency {
  constructor(sourceTable, sourceColumn, type) {
    this.sourceTable = sourceTable;
    this.sourceColumn = sourceColumn;
    this.type = type; // DependencyType
  }
}


// =============================================================
// 2. ASTからリネージュグラフを構築するアルゴリズム
// =============================================================

/**
 * column_ref ノードからテーブル名・カラム名を抽出
 */
function extractColumnRef(expr) {
  if (expr.type === 'column_ref') {
    const table = expr.table || null;
    const column = typeof expr.column === 'string'
      ? expr.column
      : expr.column?.expr?.value || null;
    return { table, column };
  }
  return null;
}

/**
 * 式ノードから参照されている全カラムを再帰的に収集
 */
function collectColumnRefs(expr) {
  if (!expr) return [];
  const refs = [];

  const ref = extractColumnRef(expr);
  if (ref && ref.column) {
    refs.push(ref);
    return refs;
  }

  // binary_expr, function, aggr_func 等を再帰探索
  if (expr.left) refs.push(...collectColumnRefs(expr.left));
  if (expr.right) refs.push(...collectColumnRefs(expr.right));
  if (expr.args) {
    if (expr.args.expr) refs.push(...collectColumnRefs(expr.args.expr));
    if (Array.isArray(expr.args.value)) {
      for (const v of expr.args.value) refs.push(...collectColumnRefs(v));
    }
  }
  if (expr.expr) refs.push(...collectColumnRefs(expr.expr));
  // CASE式
  if (expr.args && Array.isArray(expr.args)) {
    for (const a of expr.args) refs.push(...collectColumnRefs(a));
  }

  return refs;
}

/**
 * FROM句からエイリアス→テーブル名のマッピングを構築
 */
function buildAliasMap(from) {
  const map = {};
  if (!from) return map;
  for (const f of from) {
    if (f.table) {
      const tableName = f.table;
      if (f.as) map[f.as] = tableName;
      map[tableName] = tableName;
    }
    // サブクエリの場合
    if (f.expr && f.as) {
      map[f.as] = `__subquery_${f.as}`;
    }
  }
  return map;
}

/**
 * SELECT句のカラムから依存関係を抽出
 */
function extractSelectDependencies(ast) {
  const aliasMap = buildAliasMap(ast.from);
  const results = [];

  if (!ast.columns) {
    return results;
  }

  for (const col of ast.columns) {
    // SELECT * の検出: column が '*' の場合
    const ref = extractColumnRef(col.expr);
    if (ref && ref.column === '*') {
      // テーブル指定あり(t.*)の場合はそのテーブルのみ
      const sourceTable = ref.table ? (aliasMap[ref.table] || ref.table) : null;
      results.push({
        outputColumn: '*',
        sourceTable,
        dependencies: [],
        type: DependencyType.STAR,
      });
      continue;
    }

    const outputName = col.as || ref?.column || '(expr)';
    const refs = collectColumnRefs(col.expr);
    const isSimpleRef = col.expr.type === 'column_ref';
    const isAggr = col.expr.type === 'aggr_func';

    const deps = refs.map(ref => {
      const resolvedTable = ref.table ? (aliasMap[ref.table] || ref.table) : null;
      let depType;
      if (isAggr) depType = DependencyType.AGGREGATE;
      else if (isSimpleRef) depType = DependencyType.DIRECT;
      else depType = DependencyType.EXPRESSION;

      return new ColumnDependency(resolvedTable, ref.column, depType);
    });

    results.push({ outputColumn: outputName, dependencies: deps });
  }

  return results;
}


// =============================================================
// 3. SELECT * 伝播アルゴリズム
// =============================================================

/**
 * トポロジカル順でSELECT *を解決する
 *
 * @param {Map<string, TableNode>} tables - テーブル名 → TableNode
 * @param {Array<{target: string, sources: string[]}>} dependencies - テーブル依存関係
 */
function propagateSelectStar(tables, dependencies) {
  // トポロジカルソート
  const inDegree = {};
  const graph = {};

  for (const [name] of tables) {
    inDegree[name] = 0;
    graph[name] = [];
  }
  for (const dep of dependencies) {
    for (const src of dep.sources) {
      if (graph[src]) {
        graph[src].push(dep.target);
        inDegree[dep.target] = (inDegree[dep.target] || 0) + 1;
      }
    }
  }

  // BFS
  const queue = Object.keys(inDegree).filter(k => inDegree[k] === 0);
  const order = [];

  while (queue.length > 0) {
    const node = queue.shift();
    order.push(node);
    for (const next of (graph[node] || [])) {
      inDegree[next]--;
      if (inDegree[next] === 0) queue.push(next);
    }
  }

  // 循環依存チェック
  if (order.length !== tables.size) {
    console.warn('循環依存を検出。一部のテーブルのSELECT *は解決できません。');
  }

  // トポロジカル順でSELECT *を伝播
  for (const tableName of order) {
    const table = tables.get(tableName);
    if (!table) continue;

    // SELECT * のカラムを検出
    const starCol = table.columns.get('*');
    if (!starCol) continue;

    // * を削除して、ソーステーブルの全カラムに置換
    table.columns.delete('*');

    const dep = dependencies.find(d => d.target === tableName);
    if (!dep) continue;

    for (const srcName of dep.sources) {
      // starCol.sourceTable がある場合（t.*）はそのテーブルのみ
      if (starCol.sourceTable && starCol.sourceTable !== srcName) continue;

      const srcTable = tables.get(srcName);
      if (!srcTable) continue;
      for (const [srcColName] of srcTable.columns) {
        if (srcColName === '*') continue; // 未解決のSTARはスキップ
        if (!table.columns.has(srcColName)) {
          const propagated = new ColumnNode(tableName, srcColName, {
            certainty: Certainty.PROPAGATED,
          });
          propagated.dependencies.push(
            new ColumnDependency(srcName, srcColName, DependencyType.STAR)
          );
          table.columns.set(srcColName, propagated);
        }
      }
    }
  }
}


// =============================================================
// 4. 未登録テーブルのカラム推定
// =============================================================

/**
 * クエリ内のカラム参照から、未登録テーブルのカラムを推定
 */
function inferUnregisteredColumns(ast, aliasMap, tables) {
  const allRefs = [];

  // SELECT句
  if (ast.columns && ast.columns !== '*') {
    for (const col of ast.columns) {
      allRefs.push(...collectColumnRefs(col.expr));
    }
  }
  // WHERE句
  if (ast.where) allRefs.push(...collectColumnRefs(ast.where));
  // JOIN ON条件
  if (ast.from) {
    for (const f of ast.from) {
      if (f.on) allRefs.push(...collectColumnRefs(f.on));
    }
  }
  // GROUP BY
  if (ast.groupby?.columns) {
    for (const g of ast.groupby.columns) {
      allRefs.push(...collectColumnRefs(g));
    }
  }

  // テーブルプレフィックスでフィルタ
  const fromTables = ast.from ? ast.from.filter(f => f.table).map(f => f.table) : [];
  const singleTable = fromTables.length === 1 ? fromTables[0] : null;

  for (const ref of allRefs) {
    let resolvedTable = ref.table ? (aliasMap[ref.table] || ref.table) : null;

    // テーブルプレフィックスなし + FROM 1テーブルの場合
    if (!resolvedTable && singleTable) {
      resolvedTable = singleTable;
    }

    // テーブルプレフィックスなし + 複数テーブルの場合は収集しない
    if (!resolvedTable) continue;

    // 未登録テーブルにカラムを追加
    if (tables.has(resolvedTable)) {
      const table = tables.get(resolvedTable);
      if (!table.isRegistered && !table.columns.has(ref.column)) {
        table.columns.set(ref.column, new ColumnNode(resolvedTable, ref.column, {
          certainty: Certainty.INFERRED,
        }));
      }
    }
  }
}


// =============================================================
// 5. テスト実行
// =============================================================

const parser = new (require('node-sql-parser').Parser)();

// テストケース: A(未登録) → B(CTAS) → C(SELECT *)
const sqls = [
  {
    sql: `CREATE TABLE table_b AS
      SELECT a.id, a.name, a.amount * 1.1 AS adjusted_amount
      FROM table_a a
      WHERE a.status = 'active'`,
    description: 'table_a → table_b (式カラム含む)',
  },
  {
    sql: `CREATE TABLE table_c AS
      SELECT * FROM table_b`,
    description: 'table_b → table_c (SELECT *)',
  },
];

console.log('=== カラムリネージュ データモデル検証 ===\n');

// テーブルグラフ構築
const tables = new Map();
const deps = [];

// table_a は未登録
tables.set('table_a', new TableNode('table_a', { isRegistered: false }));

for (const { sql, description } of sqls) {
  console.log(`--- ${description} ---`);
  const ast = parser.astify(sql, { database: 'BigQuery' });

  // CTAS
  const targetTable = ast.table?.[0]?.table;
  const selectAst = ast.query_expr || ast;
  const aliasMap = buildAliasMap(selectAst.from);

  console.log(`  target: ${targetTable}`);
  console.log(`  alias map:`, aliasMap);

  // テーブル登録
  if (!tables.has(targetTable)) {
    tables.set(targetTable, new TableNode(targetTable));
  }
  const tableNode = tables.get(targetTable);

  // SELECT句の依存関係抽出
  const selectDeps = extractSelectDependencies(selectAst);
  console.log(`  SELECT deps:`);
  for (const d of selectDeps) {
    console.log(`    ${d.outputColumn}: ${d.dependencies.map(dep => `${dep.sourceTable}.${dep.sourceColumn}(${dep.type})`).join(', ') || '(STAR)'}`);
    const colNode = new ColumnNode(targetTable, d.outputColumn, {
      certainty: d.type === DependencyType.STAR ? Certainty.PROPAGATED : Certainty.CONFIRMED,
    });
    colNode.dependencies = d.dependencies;
    // SELECT * の場合、sourceTableを保持（t.* 対応用）
    if (d.type === DependencyType.STAR) {
      colNode.sourceTable = d.sourceTable || null;
    }
    tableNode.columns.set(d.outputColumn, colNode);
  }

  // FROM句のテーブル依存関係
  const sources = selectAst.from.map(f => aliasMap[f.as || f.table] || f.table);
  deps.push({ target: targetTable, sources });

  // 未登録テーブルのカラム推定
  inferUnregisteredColumns(selectAst, aliasMap, tables);

  console.log('');
}

// SELECT * 伝播
console.log('--- SELECT * 伝播 ---');
propagateSelectStar(tables, deps);

// 結果表示
console.log('\n=== 最終結果 ===\n');
for (const [name, table] of tables) {
  const status = table.isRegistered ? '登録済' : '未登録';
  console.log(`[${name}] (${status})`);
  for (const [colName, col] of table.columns) {
    const depsStr = col.dependencies.map(d => `${d.sourceTable}.${d.sourceColumn}(${d.type})`).join(', ');
    console.log(`  ${colName} [${col.certainty}] ← ${depsStr || '(origin)'}`);
  }
  console.log('');
}
