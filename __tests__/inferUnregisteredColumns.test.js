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

const srcPath = path.join(ROOT, 'src', 'lib', 'lineage', 'inferUnregisteredColumns.ts');
const content = fs.readFileSync(srcPath, 'utf-8');

// --- Structure tests ---
test('inferUnregisteredColumns.ts exists', () => { assert(fs.existsSync(srcPath), 'not found'); });
test('exports inferUnregisteredColumns', () => { assert(content.includes('export function inferUnregisteredColumns'), 'not exported'); });
test('exports collectAllColumnRefs', () => { assert(content.includes('export function collectAllColumnRefs'), 'not exported'); });
test('exports resolveTableForRef', () => { assert(content.includes('export function resolveTableForRef'), 'not exported'); });
test('imports buildAliasMap from buildLineageGraph', () => { assert(content.includes("from './buildLineageGraph'"), 'import not found'); });

// --- Functional tests ---
const FUNCTIONAL_TEST = `
import { inferUnregisteredColumns, collectAllColumnRefs, resolveTableForRef } from '../src/lib/lineage/inferUnregisteredColumns';
import { createUnresolvedTableNode, createTableNode } from '../src/lib/lineage/buildLineageGraph';
import type { ParsedQuery, ColumnRef, FromClause } from '../src/types/api';
import type { TableNode } from '../src/types/lineage';

const results: Array<{name: string; status: string; error?: string}> = [];
let failed = false;
function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e: any) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

function makePQ(overrides: Partial<ParsedQuery> = {}): ParsedQuery {
  return { queryId: 'q1', rawSql: 'SELECT 1', targetTable: null, queryType: 'select',
    select: { columns: [] }, from: { tables: [], joins: [], subqueries: [] },
    where: null, groupBy: null, having: null, orderBy: null, ctes: [], ...overrides };
}

// =====================
// resolveTableForRef
// =====================

test('resolveTableForRef: with table prefix resolves via aliasMap', () => {
  const am = new Map([['a', 'users'], ['users', 'users']]);
  const from: FromClause = { tables: [{ name: 'users', alias: 'a' }], joins: [], subqueries: [] };
  assert(resolveTableForRef({ table: 'a', column: 'id' }, am, 1, from) === 'users', 'should resolve');
});

test('resolveTableForRef: unknown prefix returns prefix as-is', () => {
  const am = new Map<string, string>();
  const from: FromClause = { tables: [], joins: [], subqueries: [] };
  assert(resolveTableForRef({ table: 'unknown', column: 'id' }, am, 0, from) === 'unknown', 'passthrough');
});

test('resolveTableForRef: single table, no prefix -> table name', () => {
  const am = new Map([['t', 't']]);
  const from: FromClause = { tables: [{ name: 't', alias: null }], joins: [], subqueries: [] };
  assert(resolveTableForRef({ table: null, column: 'id' }, am, 1, from) === 't', 'single table');
});

test('resolveTableForRef: multiple tables, no prefix -> null', () => {
  const am = new Map([['a', 'a'], ['b', 'b']]);
  const from: FromClause = { tables: [{ name: 'a', alias: null }, { name: 'b', alias: null }], joins: [], subqueries: [] };
  assert(resolveTableForRef({ table: null, column: 'id' }, am, 2, from) === null, 'ambiguous');
});

test('resolveTableForRef: join counts toward fromTableCount', () => {
  const am = new Map([['a', 'a']]);
  const from: FromClause = { tables: [{ name: 'a', alias: null }], joins: [{ joinType: 'INNER', table: 'b', alias: null, onConditionRefs: [], onConditionText: '' }], subqueries: [] };
  // fromTableCount = 2 (1 table + 1 join), so no prefix -> null
  assert(resolveTableForRef({ table: null, column: 'id' }, am, 2, from) === null, 'with join');
});

// =====================
// collectAllColumnRefs
// =====================

test('collectAllColumnRefs: collects from SELECT', () => {
  const q = makePQ({ select: { columns: [{ displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'id' }], starSourceTable: null }] } });
  const refs = collectAllColumnRefs(q);
  assert(refs.length === 1, 'count'); assert(refs[0].column === 'id', 'col');
});

test('collectAllColumnRefs: collects from JOIN ON', () => {
  const q = makePQ({ from: { tables: [], joins: [{ joinType: 'INNER', table: 'b', alias: null, onConditionRefs: [{ table: 'a', column: 'id' }, { table: 'b', column: 'id' }], onConditionText: '' }], subqueries: [] } });
  const refs = collectAllColumnRefs(q);
  assert(refs.length === 2, 'count');
});

test('collectAllColumnRefs: collects from WHERE', () => {
  const q = makePQ({ where: { columnRefs: [{ table: 'a', column: 'status' }], conditionText: '', subqueries: [] } });
  assert(collectAllColumnRefs(q).length === 1, 'count');
});

test('collectAllColumnRefs: collects from GROUP BY', () => {
  const q = makePQ({ groupBy: { columnRefs: [{ table: 'a', column: 'cat' }], expressionText: '' } });
  assert(collectAllColumnRefs(q).length === 1, 'count');
});

test('collectAllColumnRefs: collects from HAVING', () => {
  const q = makePQ({ having: { columnRefs: [{ table: 'a', column: 'cnt' }], conditionText: '' } });
  assert(collectAllColumnRefs(q).length === 1, 'count');
});

test('collectAllColumnRefs: collects from ORDER BY', () => {
  const q = makePQ({ orderBy: { columnRefs: [{ table: 'a', column: 'id' }], expressionText: '' } });
  assert(collectAllColumnRefs(q).length === 1, 'count');
});

test('collectAllColumnRefs: collects from all clauses combined', () => {
  const q = makePQ({
    select: { columns: [{ displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'id' }], starSourceTable: null }] },
    from: { tables: [], joins: [{ joinType: 'INNER', table: 'b', alias: null, onConditionRefs: [{ table: 'a', column: 'fk' }], onConditionText: '' }], subqueries: [] },
    where: { columnRefs: [{ table: 'a', column: 'status' }], conditionText: '', subqueries: [] },
    groupBy: { columnRefs: [{ table: 'a', column: 'cat' }], expressionText: '' },
    having: { columnRefs: [{ table: 'a', column: 'cnt' }], conditionText: '' },
    orderBy: { columnRefs: [{ table: 'a', column: 'id' }], expressionText: '' },
  });
  assert(collectAllColumnRefs(q).length === 6, 'all clauses');
});

test('collectAllColumnRefs: empty query returns empty', () => {
  assert(collectAllColumnRefs(makePQ()).length === 0, 'empty');
});

// =====================
// inferUnregisteredColumns
// =====================

test('inferUnregisteredColumns: adds inferred columns to unresolved table', () => {
  const tables = new Map<string, TableNode>();
  tables.set('src', createUnresolvedTableNode('src'));
  const q = makePQ({
    select: { columns: [{ displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'id' }], starSourceTable: null }] },
    from: { tables: [{ name: 'src', alias: 'a' }], joins: [], subqueries: [] },
  });
  inferUnregisteredColumns(tables, [q]);
  const src = tables.get('src')!;
  assert(src.columns.size === 1, 'should have 1 column');
  assert(src.columns.has('id'), 'should have id');
  assert(src.columns.get('id')!.certainty === 'inferred', 'certainty');
  assert(src.columns.get('id')!.exprType === 'column_ref', 'exprType');
});

test('inferUnregisteredColumns: does not add to registered table', () => {
  const tables = new Map<string, TableNode>();
  const regQuery = makePQ({ queryId: 'q1', targetTable: 'src', queryType: 'ctas' });
  tables.set('src', createTableNode(regQuery));
  const q = makePQ({
    select: { columns: [{ displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'id' }], starSourceTable: null }] },
    from: { tables: [{ name: 'src', alias: 'a' }], joins: [], subqueries: [] },
  });
  inferUnregisteredColumns(tables, [q]);
  // Registered table's columns are only from buildColumnDependencies, not inferred
  assert(tables.get('src')!.columns.size === 0, 'should not add to registered');
});

test('inferUnregisteredColumns: does not duplicate columns', () => {
  const tables = new Map<string, TableNode>();
  tables.set('src', createUnresolvedTableNode('src'));
  const q = makePQ({
    select: { columns: [
      { displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'id' }], starSourceTable: null },
      { displayName: 'name', sourceTable: 'a', sourceColumn: 'name', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'id' }, { table: 'a', column: 'name' }], starSourceTable: null },
    ] },
    from: { tables: [{ name: 'src', alias: 'a' }], joins: [], subqueries: [] },
  });
  inferUnregisteredColumns(tables, [q]);
  assert(tables.get('src')!.columns.size === 2, 'id and name only');
});

test('inferUnregisteredColumns: collects from WHERE and JOIN ON too', () => {
  const tables = new Map<string, TableNode>();
  tables.set('src', createUnresolvedTableNode('src'));
  tables.set('other', createUnresolvedTableNode('other'));
  const q = makePQ({
    select: { columns: [{ displayName: 'name', sourceTable: 'a', sourceColumn: 'name', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'name' }], starSourceTable: null }] },
    from: { tables: [{ name: 'src', alias: 'a' }], joins: [{ joinType: 'INNER', table: 'other', alias: 'b', onConditionRefs: [{ table: 'a', column: 'id' }, { table: 'b', column: 'id' }], onConditionText: '' }], subqueries: [] },
    where: { columnRefs: [{ table: 'a', column: 'status' }], conditionText: '', subqueries: [] },
  });
  inferUnregisteredColumns(tables, [q]);
  const src = tables.get('src')!;
  assert(src.columns.has('name'), 'name from SELECT');
  assert(src.columns.has('id'), 'id from JOIN ON');
  assert(src.columns.has('status'), 'status from WHERE');
  assert(src.columns.size === 3, '3 columns total');
  const other = tables.get('other')!;
  assert(other.columns.has('id'), 'other.id from JOIN ON');
});

test('inferUnregisteredColumns: single table no prefix resolves', () => {
  const tables = new Map<string, TableNode>();
  tables.set('src', createUnresolvedTableNode('src'));
  const q = makePQ({
    select: { columns: [{ displayName: 'name', sourceTable: null, sourceColumn: null, exprType: 'column_ref', columnRefs: [{ table: null, column: 'name' }], starSourceTable: null }] },
    from: { tables: [{ name: 'src', alias: null }], joins: [], subqueries: [] },
  });
  inferUnregisteredColumns(tables, [q]);
  assert(tables.get('src')!.columns.has('name'), 'resolved via single table rule');
});

test('inferUnregisteredColumns: multiple tables no prefix skips', () => {
  const tables = new Map<string, TableNode>();
  tables.set('a', createUnresolvedTableNode('a'));
  tables.set('b', createUnresolvedTableNode('b'));
  const q = makePQ({
    select: { columns: [{ displayName: 'x', sourceTable: null, sourceColumn: null, exprType: 'column_ref', columnRefs: [{ table: null, column: 'x' }], starSourceTable: null }] },
    from: { tables: [{ name: 'a', alias: null }, { name: 'b', alias: null }], joins: [], subqueries: [] },
  });
  inferUnregisteredColumns(tables, [q]);
  assert(tables.get('a')!.columns.size === 0, 'a no columns');
  assert(tables.get('b')!.columns.size === 0, 'b no columns');
});

test('inferUnregisteredColumns: empty queries does nothing', () => {
  const tables = new Map<string, TableNode>();
  tables.set('src', createUnresolvedTableNode('src'));
  inferUnregisteredColumns(tables, []);
  assert(tables.get('src')!.columns.size === 0, 'unchanged');
});

test('inferUnregisteredColumns: ignores non-existent table in map', () => {
  const tables = new Map<string, TableNode>();
  // 'src' is not in the map
  const q = makePQ({
    select: { columns: [{ displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'id' }], starSourceTable: null }] },
    from: { tables: [{ name: 'src', alias: 'a' }], joins: [], subqueries: [] },
  });
  inferUnregisteredColumns(tables, [q]);
  assert(tables.size === 0, 'no tables added');
});

// Output
console.log('\\n=== inferUnregisteredColumns Functional Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('functional tests pass (via tsx)', () => {
  const tmpFile = path.join(ROOT, 'tmp', 'inferUnreg-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const output = execSync('npx tsx tmp/inferUnreg-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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

try { fs.unlinkSync(path.join(ROOT, 'tmp', 'inferUnreg-test.ts')); } catch {}

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
