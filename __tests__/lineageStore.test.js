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

const srcPath = path.join(ROOT, 'src', 'stores', 'lineageStore.ts');
const content = fs.readFileSync(srcPath, 'utf-8');

// --- Structure tests ---
test('lineageStore.ts exists', () => { assert(fs.existsSync(srcPath), 'not found'); });
test('exports useLineageStore', () => { assert(content.includes('export const useLineageStore'), 'not exported'); });
test('exports LineageState', () => { assert(content.includes('export interface LineageState'), 'not exported'); });
test('exports LineageActions', () => { assert(content.includes('export interface LineageActions'), 'not exported'); });
test('exports LineageStore type', () => { assert(content.includes('export type LineageStore'), 'not exported'); });
test('imports create from zustand', () => { assert(content.includes("from 'zustand'"), 'zustand import not found'); });
test('imports buildLineageGraph', () => { assert(content.includes('buildLineageGraph'), 'buildLineageGraph not imported'); });
test('imports inferUnregisteredColumns', () => { assert(content.includes('inferUnregisteredColumns'), 'inferUnregisteredColumns not imported'); });
test('imports propagateSelectStar', () => { assert(content.includes('propagateSelectStar'), 'propagateSelectStar not imported'); });

// --- Functional tests ---
const FUNCTIONAL_TEST = `
import { useLineageStore } from '../src/stores/lineageStore';
import type { ParsedQuery } from '../src/types/api';

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

// Reset store before each test
function resetStore() {
  useLineageStore.getState().resetAll();
}

// --- Initial state ---
test('initial state: empty tables and queries', () => {
  resetStore();
  const state = useLineageStore.getState();
  assert(state.tables instanceof Map, 'tables is Map');
  assert(state.tables.size === 0, 'tables empty');
  assert(state.queries instanceof Map, 'queries is Map');
  assert(state.queries.size === 0, 'queries empty');
});

test('initial state: dialect is BigQuery', () => {
  resetStore();
  assert(useLineageStore.getState().dialect === 'BigQuery', 'default BigQuery');
});

// --- addQuery ---
test('addQuery: adds query and builds table', () => {
  resetStore();
  const q = makePQ({
    queryId: 'q1', targetTable: 'output', queryType: 'ctas',
    select: { columns: [{ displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'id' }], starSourceTable: null }] },
    from: { tables: [{ name: 'source', alias: 'a' }], joins: [], subqueries: [] },
  });
  useLineageStore.getState().addQuery(q);
  const state = useLineageStore.getState();
  assert(state.queries.size === 1, 'queries has 1');
  assert(state.queries.has('q1'), 'has q1');
  assert(state.tables.has('output'), 'has output table');
  assert(state.tables.has('source'), 'has source table (unresolved)');
  assert(state.tables.get('output')!.isRegistered === true, 'output registered');
  assert(state.tables.get('source')!.isRegistered === false, 'source unresolved');
});

test('addQuery: columns are built with dependencies', () => {
  resetStore();
  const q = makePQ({
    queryId: 'q1', targetTable: 'output', queryType: 'ctas',
    select: { columns: [{ displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'id' }], starSourceTable: null }] },
    from: { tables: [{ name: 'source', alias: 'a' }], joins: [], subqueries: [] },
  });
  useLineageStore.getState().addQuery(q);
  const output = useLineageStore.getState().tables.get('output')!;
  assert(output.columns.size === 1, 'has 1 column');
  assert(output.columns.has('id'), 'has id column');
  assert(output.columns.get('id')!.dependencies[0].sourceTableId === 'source', 'dependency resolved');
});

test('addQuery: infers columns on unresolved tables', () => {
  resetStore();
  const q = makePQ({
    queryId: 'q1', targetTable: 'output', queryType: 'ctas',
    select: { columns: [{ displayName: 'name', sourceTable: 'a', sourceColumn: 'name', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'name' }], starSourceTable: null }] },
    from: { tables: [{ name: 'source', alias: 'a' }], joins: [], subqueries: [] },
  });
  useLineageStore.getState().addQuery(q);
  const source = useLineageStore.getState().tables.get('source')!;
  assert(source.columns.has('name'), 'inferred column name');
  assert(source.columns.get('name')!.certainty === 'inferred', 'certainty inferred');
});

test('addQuery: multiple queries build full graph', () => {
  resetStore();
  const q1 = makePQ({ queryId: 'q1', targetTable: 'mid', queryType: 'ctas',
    select: { columns: [{ displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'id' }], starSourceTable: null }] },
    from: { tables: [{ name: 'raw', alias: 'a' }], joins: [], subqueries: [] } });
  const q2 = makePQ({ queryId: 'q2', targetTable: 'final', queryType: 'ctas',
    select: { columns: [{ displayName: 'id', sourceTable: 'b', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'b', column: 'id' }], starSourceTable: null }] },
    from: { tables: [{ name: 'mid', alias: 'b' }], joins: [], subqueries: [] } });
  useLineageStore.getState().addQuery(q1);
  useLineageStore.getState().addQuery(q2);
  const state = useLineageStore.getState();
  assert(state.queries.size === 2, '2 queries');
  assert(state.tables.size === 3, '3 tables: raw, mid, final');
  assert(state.tables.get('raw')!.isRegistered === false, 'raw unresolved');
  assert(state.tables.get('mid')!.isRegistered === true, 'mid registered');
  assert(state.tables.get('final')!.isRegistered === true, 'final registered');
});

// --- removeQuery ---
test('removeQuery: removes query and rebuilds', () => {
  resetStore();
  const q1 = makePQ({ queryId: 'q1', targetTable: 'mid', queryType: 'ctas',
    from: { tables: [{ name: 'raw', alias: null }], joins: [], subqueries: [] } });
  const q2 = makePQ({ queryId: 'q2', targetTable: 'final', queryType: 'ctas',
    from: { tables: [{ name: 'mid', alias: null }], joins: [], subqueries: [] } });
  useLineageStore.getState().addQuery(q1);
  useLineageStore.getState().addQuery(q2);
  assert(useLineageStore.getState().queries.size === 2, 'before: 2');

  useLineageStore.getState().removeQuery('q1');
  const state = useLineageStore.getState();
  assert(state.queries.size === 1, 'after: 1');
  assert(!state.queries.has('q1'), 'q1 removed');
  assert(state.queries.has('q2'), 'q2 remains');
  // mid is now unresolved (its source query q1 was removed, but q2 references mid)
  assert(state.tables.has('mid'), 'mid still exists as unresolved');
  assert(state.tables.get('mid')!.isRegistered === false, 'mid is now unresolved');
});

test('removeQuery: removing last query empties state', () => {
  resetStore();
  const q = makePQ({ queryId: 'q1', targetTable: 'out' });
  useLineageStore.getState().addQuery(q);
  useLineageStore.getState().removeQuery('q1');
  const state = useLineageStore.getState();
  assert(state.queries.size === 0, 'queries empty');
  assert(state.tables.size === 0, 'tables empty');
});

test('removeQuery: non-existent queryId does nothing harmful', () => {
  resetStore();
  const q = makePQ({ queryId: 'q1', targetTable: 'out' });
  useLineageStore.getState().addQuery(q);
  useLineageStore.getState().removeQuery('non-existent');
  assert(useLineageStore.getState().queries.size === 1, 'unchanged');
});

// --- resetAll ---
test('resetAll: clears everything', () => {
  resetStore();
  const q = makePQ({ queryId: 'q1', targetTable: 'out' });
  useLineageStore.getState().addQuery(q);
  useLineageStore.getState().setDialect('MySQL');
  assert(useLineageStore.getState().queries.size === 1, 'before reset');
  assert(useLineageStore.getState().dialect === 'MySQL', 'dialect changed');

  useLineageStore.getState().resetAll();
  const state = useLineageStore.getState();
  assert(state.tables.size === 0, 'tables cleared');
  assert(state.queries.size === 0, 'queries cleared');
  assert(state.dialect === 'BigQuery', 'dialect reset to BigQuery');
});

// --- setDialect ---
test('setDialect: changes dialect', () => {
  resetStore();
  useLineageStore.getState().setDialect('PostgreSQL');
  assert(useLineageStore.getState().dialect === 'PostgreSQL', 'changed');
  useLineageStore.getState().setDialect('SQLite');
  assert(useLineageStore.getState().dialect === 'SQLite', 'changed again');
});

test('setDialect: does not affect tables or queries', () => {
  resetStore();
  const q = makePQ({ queryId: 'q1', targetTable: 'out' });
  useLineageStore.getState().addQuery(q);
  useLineageStore.getState().setDialect('MySQL');
  assert(useLineageStore.getState().queries.size === 1, 'queries preserved');
  assert(useLineageStore.getState().tables.has('out'), 'tables preserved');
});

// --- addQuery: targetTable null (plain SELECT) ---
test('addQuery: plain SELECT (targetTable null) uses queryId', () => {
  resetStore();
  const q = makePQ({ queryId: 'q-select-1', targetTable: null, queryType: 'select',
    select: { columns: [{ displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'id' }], starSourceTable: null }] },
    from: { tables: [{ name: 'users', alias: 'a' }], joins: [], subqueries: [] } });
  useLineageStore.getState().addQuery(q);
  const state = useLineageStore.getState();
  assert(state.tables.has('q-select-1'), 'queryId used as table key');
  assert(state.tables.get('q-select-1')!.isRegistered === true, 'registered');
  assert(state.tables.has('users'), 'users unresolved');
});

// --- addQuery: SELECT * propagation ---
test('addQuery: SELECT * propagates columns from source', () => {
  resetStore();
  // q1: CREATE TABLE source AS SELECT r.id, r.name FROM raw r
  const q1 = makePQ({ queryId: 'q1', targetTable: 'source', queryType: 'ctas',
    select: { columns: [
      { displayName: 'id', sourceTable: 'r', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'r', column: 'id' }], starSourceTable: null },
      { displayName: 'name', sourceTable: 'r', sourceColumn: 'name', exprType: 'column_ref', columnRefs: [{ table: 'r', column: 'name' }], starSourceTable: null },
    ] },
    from: { tables: [{ name: 'raw', alias: 'r' }], joins: [], subqueries: [] } });
  // q2: CREATE TABLE output AS SELECT * FROM source
  const q2 = makePQ({ queryId: 'q2', targetTable: 'output', queryType: 'ctas',
    select: { columns: [
      { displayName: '*', sourceTable: null, sourceColumn: null, exprType: 'star', columnRefs: [], starSourceTable: null },
    ] },
    from: { tables: [{ name: 'source', alias: null }], joins: [], subqueries: [] } });
  useLineageStore.getState().addQuery(q1);
  useLineageStore.getState().addQuery(q2);
  const output = useLineageStore.getState().tables.get('output')!;
  assert(output.columns.has('id'), 'propagated id');
  assert(output.columns.has('name'), 'propagated name');
  assert(output.columns.get('id')!.certainty === 'propagated', 'certainty propagated');
  assert(output.columns.get('id')!.dependencies.length > 0, 'has dependency');
  assert(output.columns.get('id')!.dependencies[0].type === 'star', 'dep type star');
});

// --- addQuery: with JOIN ---
test('addQuery: JOIN tables become unresolved', () => {
  resetStore();
  const q = makePQ({ queryId: 'q1', targetTable: 'output', queryType: 'ctas',
    select: { columns: [{ displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'id' }], starSourceTable: null }] },
    from: {
      tables: [{ name: 'users', alias: 'a' }],
      joins: [{ joinType: 'LEFT', table: 'orders', alias: 'b', onConditionRefs: [{ table: 'a', column: 'id' }, { table: 'b', column: 'user_id' }], onConditionText: 'a.id = b.user_id' }],
      subqueries: [],
    } });
  useLineageStore.getState().addQuery(q);
  const state = useLineageStore.getState();
  assert(state.tables.has('users'), 'users exists');
  assert(state.tables.has('orders'), 'orders exists (from JOIN)');
  assert(state.tables.get('orders')!.isRegistered === false, 'orders unresolved');
  // infer: orders should have user_id inferred from JOIN ON
  assert(state.tables.get('orders')!.columns.has('user_id'), 'orders.user_id inferred from JOIN ON');
});

// --- addQuery: same queryId overwrites ---
test('addQuery: same queryId overwrites previous', () => {
  resetStore();
  const q1 = makePQ({ queryId: 'q1', targetTable: 'out', queryType: 'ctas',
    from: { tables: [{ name: 'src_a', alias: null }], joins: [], subqueries: [] } });
  useLineageStore.getState().addQuery(q1);
  assert(useLineageStore.getState().tables.has('src_a'), 'src_a');

  const q1v2 = makePQ({ queryId: 'q1', targetTable: 'out', queryType: 'ctas',
    from: { tables: [{ name: 'src_b', alias: null }], joins: [], subqueries: [] } });
  useLineageStore.getState().addQuery(q1v2);
  const state = useLineageStore.getState();
  assert(state.queries.size === 1, 'still 1 query');
  assert(state.tables.has('src_b'), 'new source src_b');
  assert(!state.tables.has('src_a'), 'old source src_a removed');
});

// Output
console.log('\\n=== lineageStore Functional Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('functional tests pass (via tsx)', () => {
  const tmpFile = path.join(ROOT, 'tmp', 'lineageStore-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const output = execSync('npx tsx tmp/lineageStore-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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

try { fs.unlinkSync(path.join(ROOT, 'tmp', 'lineageStore-test.ts')); } catch {}

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
