/**
 * 失敗ケースの再検証 - 構文バリエーションを試す
 */
const { Parser } = require('node-sql-parser');
const parser = new Parser();

const tests = [
  // UNNEST: AS u(val) の代わりに AS val を試す
  {
    name: 'UNNEST + CROSS JOIN (AS alias のみ)',
    sql: 'SELECT t.id, val FROM my_table t CROSS JOIN UNNEST(t.arr_col) AS val',
  },
  {
    name: 'UNNEST (カンマJOIN)',
    sql: 'SELECT t.id, val FROM my_table t, UNNEST(t.arr_col) AS val',
  },
  {
    name: 'UNNEST (カンマJOIN, ASなし)',
    sql: 'SELECT t.id, val FROM my_table t, UNNEST(t.arr_col) val',
  },

  // QUALIFY: カラムエイリアスではなく式を直接書く
  {
    name: 'QUALIFY (式を直接)',
    sql: `SELECT id, name, salary
    FROM employees
    QUALIFY ROW_NUMBER() OVER(PARTITION BY department ORDER BY salary DESC) = 1`,
  },

  // TABLESAMPLE: BERNOULLI を試す
  {
    name: 'TABLESAMPLE BERNOULLI',
    sql: 'SELECT * FROM my_table TABLESAMPLE BERNOULLI (10)',
  },
  {
    name: 'TABLESAMPLE RESERVOIR',
    sql: 'SELECT * FROM my_table TABLESAMPLE RESERVOIR (100 ROWS)',
  },

  // MERGE: 構文調整
  {
    name: 'MERGE (BigQuery構文)',
    sql: `MERGE target t
    USING source s ON t.id = s.id
    WHEN MATCHED THEN UPDATE SET t.name = s.name
    WHEN NOT MATCHED THEN INSERT (id, name) VALUES (s.id, s.name)`,
  },
  {
    name: 'MERGE (INTO あり, database指定なし)',
    sql: `MERGE INTO target t
    USING source s ON t.id = s.id
    WHEN MATCHED THEN UPDATE SET name = s.name
    WHEN NOT MATCHED THEN INSERT (id, name) VALUES (s.id, s.name)`,
  },

  // WITH RECURSIVE: BigQueryでは RECURSIVE キーワードを使わない書き方がある
  {
    name: 'CTE (RECURSIVEなし)',
    sql: `WITH cte AS (
      SELECT 1 AS n
      UNION ALL
      SELECT n + 1 FROM cte WHERE n < 10
    )
    SELECT * FROM cte`,
  },

  // UNPIVOT: 別の構文を試す
  {
    name: 'UNPIVOT (括弧付き)',
    sql: `SELECT * FROM (SELECT id, q1, q2, q3 FROM sales)
      UNPIVOT(revenue FOR quarter IN (q1, q2, q3))`,
  },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  try {
    const ast = parser.astify(t.sql, { database: 'BigQuery' });
    console.log(`✅ ${t.name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${t.name}`);
    console.log(`   Error: ${e.message.split('\n')[0]}`);
    failed++;
  }
}

console.log(`\n結果: ${passed} passed, ${failed} failed / ${tests.length} total`);
