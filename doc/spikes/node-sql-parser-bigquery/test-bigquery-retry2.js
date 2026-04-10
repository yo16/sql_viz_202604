/**
 * 失敗ケースの追加検証
 */
const { Parser } = require('node-sql-parser');
const parser = new Parser();

const tests = [
  // QUALIFY: WHERE句やHAVING句の後に配置してみる
  {
    name: 'QUALIFY (WHERE後)',
    sql: `SELECT id, name, salary,
      ROW_NUMBER() OVER(PARTITION BY department ORDER BY salary DESC) AS rn
    FROM employees
    WHERE salary > 0
    QUALIFY ROW_NUMBER() OVER(PARTITION BY department ORDER BY salary DESC) = 1`,
  },
  {
    name: 'QUALIFY (WINDOW後)',
    sql: `SELECT id, name, salary,
      ROW_NUMBER() OVER w AS rn
    FROM employees
    WINDOW w AS (PARTITION BY department ORDER BY salary DESC)
    QUALIFY ROW_NUMBER() OVER w = 1`,
  },

  // TABLESAMPLE BERNOULLI: PERCENT付き
  {
    name: 'TABLESAMPLE BERNOULLI (PERCENT付き)',
    sql: 'SELECT * FROM my_table TABLESAMPLE BERNOULLI (10 PERCENT)',
  },
  {
    name: 'TABLESAMPLE SYSTEM (PERCENT付き)',
    sql: 'SELECT * FROM my_table TABLESAMPLE SYSTEM (10 PERCENT)',
  },

  // AST構造確認: パースできたCTEのAST
  {
    name: 'UNNEST + WITH OFFSET',
    sql: 'SELECT id, val, off FROM my_table t, UNNEST(t.arr) val WITH OFFSET off',
  },
];

for (const t of tests) {
  try {
    const ast = parser.astify(t.sql, { database: 'BigQuery' });
    console.log(`✅ ${t.name}`);
  } catch (e) {
    console.log(`❌ ${t.name}`);
    console.log(`   Error: ${e.message.split('\n')[0]}`);
  }
}
