/**
 * node-sql-parser 基本構文テスト
 * 対象: SELECT, FROM, JOIN, WHERE, GROUP BY, HAVING, ORDER BY, CTE, サブクエリ, CTAS
 */
const { Parser } = require('node-sql-parser');
const parser = new Parser();

const tests = [
  {
    name: '基本SELECT',
    sql: 'SELECT id, name, age FROM users WHERE age > 20',
  },
  {
    name: 'JOIN',
    sql: 'SELECT u.id, u.name, o.total FROM users u INNER JOIN orders o ON u.id = o.user_id',
  },
  {
    name: 'LEFT JOIN + WHERE',
    sql: 'SELECT u.id, o.total FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE o.total > 100',
  },
  {
    name: 'GROUP BY + HAVING',
    sql: 'SELECT department, COUNT(*) as cnt, SUM(salary) as total_salary FROM employees GROUP BY department HAVING COUNT(*) > 5',
  },
  {
    name: 'ORDER BY + LIMIT',
    sql: 'SELECT id, name FROM users ORDER BY name ASC LIMIT 10',
  },
  {
    name: 'CTE (WITH句)',
    sql: `WITH active_users AS (
      SELECT id, name FROM users WHERE status = 'active'
    )
    SELECT au.id, au.name FROM active_users au`,
  },
  {
    name: '複数CTE',
    sql: `WITH
      cte1 AS (SELECT id, name FROM users WHERE status = 'active'),
      cte2 AS (SELECT user_id, SUM(amount) as total FROM orders GROUP BY user_id)
    SELECT c1.name, c2.total FROM cte1 c1 JOIN cte2 c2 ON c1.id = c2.user_id`,
  },
  {
    name: 'サブクエリ (FROM句)',
    sql: 'SELECT sub.name, sub.cnt FROM (SELECT name, COUNT(*) as cnt FROM users GROUP BY name) sub',
  },
  {
    name: 'サブクエリ (WHERE IN)',
    sql: "SELECT id, name FROM users WHERE id IN (SELECT user_id FROM orders WHERE total > 1000)",
  },
  {
    name: 'サブクエリ (WHERE EXISTS)',
    sql: "SELECT id, name FROM users u WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id)",
  },
  {
    name: 'CREATE TABLE AS SELECT',
    sql: 'CREATE TABLE summary AS SELECT department, COUNT(*) as cnt FROM employees GROUP BY department',
  },
  {
    name: 'ネストしたサブクエリ (3段)',
    sql: `SELECT * FROM (
      SELECT * FROM (
        SELECT id, name FROM users WHERE age > 20
      ) inner_sub
      WHERE inner_sub.id > 10
    ) outer_sub`,
  },
  {
    name: '複数JOIN',
    sql: `SELECT u.name, o.total, p.product_name
     FROM users u
     INNER JOIN orders o ON u.id = o.user_id
     LEFT JOIN products p ON o.product_id = p.id
     RIGHT JOIN categories c ON p.category_id = c.id`,
  },
  {
    name: 'CASE式',
    sql: `SELECT id,
      CASE WHEN age < 20 THEN 'young' WHEN age < 40 THEN 'mid' ELSE 'senior' END as age_group
    FROM users`,
  },
  {
    name: '集約関数 + ウィンドウ関数',
    sql: `SELECT id, name, salary,
      ROW_NUMBER() OVER(PARTITION BY department ORDER BY salary DESC) as rank
    FROM employees`,
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
