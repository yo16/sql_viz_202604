const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const results = [];
let failed = false;

function test(name, fn) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(condition, message) { if (!condition) throw new Error(message); }

const srcPath = path.join(ROOT, 'src', 'lib', 'parser', 'astExtractor.ts');
const content = fs.readFileSync(srcPath, 'utf-8');

// --- Structure tests ---
test('astExtractor.ts exists', () => { assert(fs.existsSync(srcPath), 'not found'); });
test('exports extractQueryStructure', () => { assert(content.includes('export function extractQueryStructure'), 'not exported'); });
test('exports collectColumnRefsFromExpr', () => { assert(content.includes('export function collectColumnRefsFromExpr'), 'not exported'); });
test('imports uuid', () => { assert(content.includes('uuid'), 'uuid import'); });
test('imports from @/types/api', () => { assert(content.includes("from '@/types/api'"), 'api import'); });

// --- Functional tests (integration with parseSql) ---
const FUNCTIONAL_TEST = `
import { parseSql } from '../src/lib/parser/sqlParser';
import { extractQueryStructure, collectColumnRefsFromExpr } from '../src/lib/parser/astExtractor';

const results: Array<{name: string; status: string; error?: string}> = [];
let failed = false;
function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e: any) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

// =====================
// Simple SELECT
// =====================

test('simple SELECT: queryType is select', () => {
  const ast = parseSql('SELECT a.id FROM users a', 'BigQuery');
  const q = extractQueryStructure(ast, 'SELECT a.id FROM users a');
  assert(q.queryType === 'select', 'queryType');
  assert(q.targetTable === null, 'targetTable null');
  assert(q.queryId.length > 0, 'has queryId');
});

test('simple SELECT: columns extracted', () => {
  const ast = parseSql('SELECT a.id, a.name FROM users a', 'BigQuery');
  const q = extractQueryStructure(ast, '...');
  assert(q.select.columns.length === 2, '2 columns');
  assert(q.select.columns[0].displayName === 'id', 'id');
  assert(q.select.columns[0].exprType === 'column_ref', 'column_ref');
  assert(q.select.columns[0].sourceTable === 'a', 'sourceTable a');
  assert(q.select.columns[0].columnRefs.length === 1, '1 ref');
});

test('simple SELECT: FROM table extracted', () => {
  const ast = parseSql('SELECT 1 FROM users a', 'BigQuery');
  const q = extractQueryStructure(ast, '...');
  assert(q.from.tables.length === 1, '1 table');
  assert(q.from.tables[0].name === 'users', 'name');
  assert(q.from.tables[0].alias === 'a', 'alias');
});

test('simple SELECT: WHERE extracted', () => {
  const ast = parseSql('SELECT 1 FROM t WHERE t.status = 1', 'BigQuery');
  const q = extractQueryStructure(ast, '...');
  assert(q.where !== null, 'where exists');
  assert(q.where!.columnRefs.length >= 1, 'has refs');
  assert(q.where!.conditionText.length > 0, 'has text');
});

test('simple SELECT: no WHERE returns null', () => {
  const ast = parseSql('SELECT 1 FROM t', 'BigQuery');
  const q = extractQueryStructure(ast, '...');
  assert(q.where === null, 'where null');
});

// =====================
// CTAS
// =====================

test('CTAS: queryType is ctas', () => {
  const ast = parseSql('CREATE TABLE output AS SELECT a.id FROM users a', 'BigQuery');
  const q = extractQueryStructure(ast, '...');
  assert(q.queryType === 'ctas', 'queryType');
  assert(q.targetTable === 'output', 'targetTable');
});

test('CTAS: columns and FROM extracted', () => {
  const ast = parseSql('CREATE TABLE out AS SELECT a.id, b.name FROM t1 a JOIN t2 b ON a.id = b.id', 'BigQuery');
  const q = extractQueryStructure(ast, '...');
  assert(q.select.columns.length === 2, '2 columns');
  assert(q.from.tables.length === 1, '1 table');
  assert(q.from.joins.length === 1, '1 join');
  assert(q.from.joins[0].joinType === 'INNER', 'INNER JOIN');
  assert(q.from.joins[0].table === 't2', 'join table');
  assert(q.from.joins[0].alias === 'b', 'join alias');
  assert(q.from.joins[0].onConditionRefs.length >= 2, 'ON refs');
});

// =====================
// SELECT *
// =====================

test('SELECT *: exprType is star', () => {
  const ast = parseSql('SELECT * FROM users', 'BigQuery');
  const q = extractQueryStructure(ast, '...');
  assert(q.select.columns.length === 1, '1 column');
  assert(q.select.columns[0].exprType === 'star', 'star');
  assert(q.select.columns[0].displayName === '*', 'displayName *');
  assert(q.select.columns[0].columnRefs.length === 0, 'no refs');
});

test('SELECT t.*: exprType is table_star', () => {
  const ast = parseSql('SELECT a.* FROM users a', 'BigQuery');
  const q = extractQueryStructure(ast, '...');
  assert(q.select.columns[0].exprType === 'table_star', 'table_star');
  assert(q.select.columns[0].starSourceTable === 'a', 'starSourceTable');
});

// =====================
// Expressions & Aggregates
// =====================

test('expression: binary expr detected', () => {
  const ast = parseSql('SELECT a.x + a.y AS total FROM t a', 'BigQuery');
  const q = extractQueryStructure(ast, '...');
  assert(q.select.columns[0].exprType === 'expression', 'expression');
  assert(q.select.columns[0].displayName === 'total', 'alias used');
  assert(q.select.columns[0].columnRefs.length === 2, '2 refs');
});

test('aggregate: COUNT detected', () => {
  const ast = parseSql('SELECT COUNT(a.id) AS cnt FROM t a', 'BigQuery');
  const q = extractQueryStructure(ast, '...');
  assert(q.select.columns[0].exprType === 'aggr_func', 'aggr_func');
  assert(q.select.columns[0].displayName === 'cnt', 'alias');
  assert(q.select.columns[0].columnRefs.length === 1, '1 ref');
  assert(q.select.columns[0].columnRefs[0].column === 'id', 'ref column');
});

test('literal: number detected', () => {
  const ast = parseSql('SELECT 42 AS num FROM t', 'BigQuery');
  const q = extractQueryStructure(ast, '...');
  assert(q.select.columns[0].exprType === 'literal', 'literal');
  assert(q.select.columns[0].columnRefs.length === 0, 'no refs');
});

// =====================
// GROUP BY / HAVING / ORDER BY
// =====================

test('GROUP BY extracted', () => {
  const ast = parseSql('SELECT a.cat, COUNT(*) FROM t a GROUP BY a.cat', 'BigQuery');
  const q = extractQueryStructure(ast, '...');
  assert(q.groupBy !== null, 'groupBy exists');
  assert(q.groupBy!.columnRefs.length >= 1, 'has refs');
  assert(q.groupBy!.expressionText.length > 0, 'has text');
});

test('ORDER BY extracted', () => {
  const ast = parseSql('SELECT a.id FROM t a ORDER BY a.id DESC', 'BigQuery');
  const q = extractQueryStructure(ast, '...');
  assert(q.orderBy !== null, 'orderBy exists');
  assert(q.orderBy!.columnRefs.length >= 1, 'has refs');
});

test('no GROUP BY/HAVING/ORDER BY returns null', () => {
  const ast = parseSql('SELECT 1 FROM t', 'BigQuery');
  const q = extractQueryStructure(ast, '...');
  assert(q.groupBy === null, 'groupBy null');
  assert(q.having === null, 'having null');
  assert(q.orderBy === null, 'orderBy null');
});

// =====================
// CTE
// =====================

test('CTE: extracted from WITH clause', () => {
  const ast = parseSql('WITH cte AS (SELECT id FROM raw) SELECT cte.id FROM cte', 'MySQL');
  const q = extractQueryStructure(ast, '...');
  assert(q.ctes.length === 1, '1 CTE');
  assert(q.ctes[0].name === 'cte', 'CTE name');
  assert(q.ctes[0].query.queryType === 'select', 'CTE is select');
});

test('no CTE: ctes is empty', () => {
  const ast = parseSql('SELECT 1 FROM t', 'BigQuery');
  const q = extractQueryStructure(ast, '...');
  assert(q.ctes.length === 0, 'no CTEs');
});

// =====================
// JOIN types
// =====================

test('LEFT JOIN detected', () => {
  const ast = parseSql('SELECT 1 FROM a LEFT JOIN b ON a.id = b.id', 'BigQuery');
  const q = extractQueryStructure(ast, '...');
  assert(q.from.joins[0].joinType === 'LEFT', 'LEFT');
});

// =====================
// collectColumnRefsFromExpr
// =====================

test('collectColumnRefsFromExpr: null returns empty', () => {
  assert(collectColumnRefsFromExpr(null).length === 0, 'null');
});

test('collectColumnRefsFromExpr: column_ref', () => {
  const refs = collectColumnRefsFromExpr({ type: 'column_ref', table: 'a', column: 'id' });
  assert(refs.length === 1, '1 ref');
  assert(refs[0].table === 'a', 'table');
  assert(refs[0].column === 'id', 'column');
});

test('collectColumnRefsFromExpr: binary_expr recurses', () => {
  const refs = collectColumnRefsFromExpr({
    type: 'binary_expr', operator: '=',
    left: { type: 'column_ref', table: 'a', column: 'id' },
    right: { type: 'column_ref', table: 'b', column: 'id' },
  });
  assert(refs.length === 2, '2 refs');
});

test('collectColumnRefsFromExpr: aggr_func', () => {
  const refs = collectColumnRefsFromExpr({
    type: 'aggr_func', name: 'COUNT',
    args: { expr: { type: 'column_ref', table: 'a', column: 'id' } },
  });
  assert(refs.length === 1, '1 ref from aggr');
});

// =====================
// Error handling
// =====================

test('empty AST throws', () => {
  let threw = false;
  try { extractQueryStructure([], '...'); } catch { threw = true; }
  assert(threw, 'should throw on empty AST');
});

// =====================
// rawSql preserved
// =====================

test('rawSql is preserved in output', () => {
  const sql = 'SELECT 1 FROM t';
  const ast = parseSql(sql, 'BigQuery');
  const q = extractQueryStructure(ast, sql);
  assert(q.rawSql === sql, 'rawSql preserved');
});

// Output
console.log('\\n=== astExtractor Functional Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('functional tests pass (via tsx)', () => {
  const tmpFile = path.join(ROOT, 'tmp', 'astExtractor-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const output = execSync('npx tsx tmp/astExtractor-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    const stdout = output.toString();
    console.log(stdout);
    assert(!stdout.includes('FAIL:'), 'Some functional tests failed');
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : '';
    const stdout = e.stdout ? e.stdout.toString() : '';
    if (stdout) console.log(stdout);
    throw new Error('Failed: ' + stderr.slice(0, 500));
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
});

try { fs.unlinkSync(path.join(ROOT, 'tmp', 'astExtractor-test.ts')); } catch {}

test('project compiles (tsc --noEmit)', () => {
  try { execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe', timeout: 60000 }); }
  catch (e) { throw new Error('tsc failed: ' + (e.stderr ? e.stderr.toString().slice(0, 500) : e.message)); }
});

// Output
console.log('\n=== Structure Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
