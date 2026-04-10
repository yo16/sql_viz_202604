/**
 * AST構造の確認 - リネージュ抽出に使える情報があるか
 */
const { Parser } = require('node-sql-parser');
const parser = new Parser();

function showAst(name, sql) {
  console.log(`\n=== ${name} ===`);
  try {
    const ast = parser.astify(sql, { database: 'BigQuery' });
    console.log(JSON.stringify(ast, null, 2));
  } catch (e) {
    console.log(`Parse error: ${e.message.split('\n')[0]}`);
  }
}

// 1. 基本SELECT - columnsとfromの構造
showAst(
  'SELECT + JOIN',
  'SELECT u.id, u.name, o.total FROM users u INNER JOIN orders o ON u.id = o.user_id WHERE o.total > 100'
);

// 2. CTE - withの構造
showAst(
  'CTE',
  `WITH active AS (SELECT id, name FROM users WHERE status = 'active')
   SELECT a.id, a.name FROM active a`
);

// 3. CREATE TABLE AS SELECT - type, tableの構造
showAst(
  'CTAS',
  'CREATE TABLE `proj.ds.summary` AS SELECT dept, COUNT(*) as cnt FROM employees GROUP BY dept'
);
