/**
 * node-sql-parser BigQuery固有構文テスト
 */
const { Parser } = require('node-sql-parser');
const parser = new Parser();

const tests = [
  {
    name: 'バッククォート識別子 (project.dataset.table)',
    sql: 'SELECT id, name FROM `my-project.my_dataset.my_table`',
  },
  {
    name: 'バッククォート + JOIN',
    sql: 'SELECT a.id, b.name FROM `proj.ds.table_a` a JOIN `proj.ds.table_b` b ON a.id = b.id',
  },
  {
    name: 'STRUCT リテラル',
    sql: 'SELECT STRUCT(1 AS a, 2 AS b) AS my_struct',
  },
  {
    name: 'STRUCT アクセス',
    sql: 'SELECT t.my_struct.field1 FROM my_table t',
  },
  {
    name: 'ARRAY リテラル',
    sql: 'SELECT [1, 2, 3] AS my_array',
  },
  {
    name: 'ARRAY_AGG 関数',
    sql: 'SELECT department, ARRAY_AGG(name) AS names FROM employees GROUP BY department',
  },
  {
    name: 'UNNEST',
    sql: 'SELECT id, item FROM my_table, UNNEST(items) AS item',
  },
  {
    name: 'UNNEST + JOIN',
    sql: 'SELECT t.id, u.val FROM my_table t CROSS JOIN UNNEST(t.arr_col) AS u(val)',
  },
  {
    name: 'QUALIFY句',
    sql: `SELECT id, name, salary,
      ROW_NUMBER() OVER(PARTITION BY department ORDER BY salary DESC) AS rn
    FROM employees
    QUALIFY rn = 1`,
  },
  {
    name: 'SAFE_CAST',
    sql: "SELECT SAFE_CAST('123' AS INT64) AS val",
  },
  {
    name: 'DATE関数',
    sql: "SELECT DATE('2024-01-01') AS d, CURRENT_DATE() AS today",
  },
  {
    name: 'TIMESTAMP関数',
    sql: "SELECT TIMESTAMP('2024-01-01 00:00:00') AS ts, CURRENT_TIMESTAMP() AS now",
  },
  {
    name: 'IF関数',
    sql: "SELECT IF(condition, 'yes', 'no') AS result FROM my_table",
  },
  {
    name: 'COUNTIF / SUMIF',
    sql: "SELECT COUNTIF(status = 'active') AS active_count FROM users",
  },
  {
    name: 'EXCEPT / REPLACE',
    sql: 'SELECT * EXCEPT(internal_id), name AS display_name FROM users',
  },
  {
    name: 'TABLESAMPLE',
    sql: 'SELECT * FROM my_table TABLESAMPLE SYSTEM (10 PERCENT)',
  },
  {
    name: 'MERGE文',
    sql: `MERGE INTO target t
    USING source s ON t.id = s.id
    WHEN MATCHED THEN UPDATE SET t.name = s.name
    WHEN NOT MATCHED THEN INSERT (id, name) VALUES (s.id, s.name)`,
  },
  {
    name: 'CREATE TABLE AS SELECT (BigQuery構文)',
    sql: 'CREATE TABLE `proj.ds.new_table` AS SELECT id, name FROM `proj.ds.source`',
  },
  {
    name: 'PARTITION BY (テーブル作成)',
    sql: `CREATE TABLE my_table (id INT64, created DATE)
    PARTITION BY created`,
  },
  {
    name: 'STRING_AGG',
    sql: "SELECT department, STRING_AGG(name, ', ') AS names FROM employees GROUP BY department",
  },
  {
    name: 'GENERATE_ARRAY',
    sql: 'SELECT GENERATE_ARRAY(1, 10, 2) AS arr',
  },
  {
    name: 'WITH RECURSIVE',
    sql: `WITH RECURSIVE cte AS (
      SELECT 1 AS n
      UNION ALL
      SELECT n + 1 FROM cte WHERE n < 10
    )
    SELECT * FROM cte`,
  },
  {
    name: 'PIVOT',
    sql: `SELECT * FROM
      (SELECT department, quarter, revenue FROM sales)
      PIVOT(SUM(revenue) FOR quarter IN ('Q1', 'Q2', 'Q3', 'Q4'))`,
  },
  {
    name: 'UNPIVOT',
    sql: `SELECT * FROM sales
      UNPIVOT(revenue FOR quarter IN (q1, q2, q3, q4))`,
  },
];

let passed = 0;
let failed = 0;
const failures = [];

for (const t of tests) {
  try {
    const ast = parser.astify(t.sql, { database: 'BigQuery' });
    console.log(`✅ ${t.name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${t.name}`);
    console.log(`   Error: ${e.message.split('\n')[0]}`);
    failed++;
    failures.push({ name: t.name, error: e.message.split('\n')[0] });
  }
}

console.log(`\n結果: ${passed} passed, ${failed} failed / ${tests.length} total`);

if (failures.length > 0) {
  console.log('\n--- 失敗一覧 ---');
  for (const f of failures) {
    console.log(`  ${f.name}: ${f.error}`);
  }
}
