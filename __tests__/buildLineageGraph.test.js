const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const results = [];
let failed = false;

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'PASS' });
  } catch (e) {
    results.push({ name, status: 'FAIL', error: e.message });
    failed = true;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const srcPath = path.join(ROOT, 'src', 'lib', 'lineage', 'buildLineageGraph.ts');
const content = fs.readFileSync(srcPath, 'utf-8');

// --- Source structure tests ---

test('buildLineageGraph.ts exists', () => {
  assert(fs.existsSync(srcPath), 'File not found');
});

const requiredExports = [
  'buildLineageGraph',
  'registerTables',
  'createTableNode',
  'createUnresolvedTableNode',
  'buildColumnDependencies',
  'buildAliasMap',
  'createColumnNode',
  'classifyDependencyType',
];

for (const name of requiredExports) {
  test(`exports ${name}`, () => {
    assert(content.includes(`export function ${name}`), `${name} not exported`);
  });
}

test('imports from @/types/api', () => {
  assert(content.includes("from '@/types/api'"), 'api import not found');
});

test('imports from @/types/lineage', () => {
  assert(content.includes("from '@/types/lineage'"), 'lineage import not found');
});

// --- Functional tests: write to tmp, run via tsx, then cleanup ---

const FUNCTIONAL_TEST_CONTENT = `
import {
  buildLineageGraph,
  registerTables,
  createTableNode,
  createUnresolvedTableNode,
  buildColumnDependencies,
  buildAliasMap,
  createColumnNode,
  classifyDependencyType,
} from '../src/lib/lineage/buildLineageGraph';
import type { ParsedQuery, FromClause, SelectColumn } from '../src/types/api';

const results: Array<{name: string; status: string; error?: string}> = [];
let failed = false;

function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e: any) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function makeParsedQuery(overrides: Partial<ParsedQuery> = {}): ParsedQuery {
  return {
    queryId: 'q1', rawSql: 'SELECT 1', targetTable: null, queryType: 'select',
    select: { columns: [] }, from: { tables: [], joins: [], subqueries: [] },
    where: null, groupBy: null, having: null, orderBy: null, ctes: [],
    ...overrides,
  };
}

// createUnresolvedTableNode
test('createUnresolvedTableNode: basic properties', () => {
  const node = createUnresolvedTableNode('users');
  assert(node.id === 'users', 'id'); assert(node.name === 'users', 'name');
  assert(node.displayTitle === '[未登録] users', 'displayTitle');
  assert(node.isRegistered === false, 'isRegistered'); assert(node.queryType === 'unresolved', 'queryType');
  assert(node.queryId === null, 'queryId'); assert(node.columns instanceof Map, 'columns Map');
  assert(node.columns.size === 0, 'columns empty'); assert(node.dependsOn instanceof Set, 'dependsOn Set');
});

// createTableNode
test('createTableNode: CTAS', () => {
  const q = makeParsedQuery({ queryId: 'q1', targetTable: 'output', queryType: 'ctas' });
  const n = createTableNode(q);
  assert(n.id === 'output', 'id'); assert(n.name === 'output', 'name');
  assert(n.displayTitle === 'output', 'displayTitle'); assert(n.isRegistered === true, 'isRegistered');
});

test('createTableNode: SELECT uses queryId', () => {
  const q = makeParsedQuery({ queryId: 'q1', targetTable: null, queryType: 'select' });
  const n = createTableNode(q);
  assert(n.id === 'q1', 'id'); assert(n.displayTitle === '[問い合わせ]', 'displayTitle');
});

test('createTableNode: dependsOn', () => {
  const q = makeParsedQuery({
    from: { tables: [{ name: 'ta', alias: 'a' }], joins: [{ joinType: 'INNER', table: 'tb', alias: 'b', onConditionRefs: [], onConditionText: '' }], subqueries: [] },
  });
  const n = createTableNode(q);
  assert(n.dependsOn.has('ta'), 'ta'); assert(n.dependsOn.has('tb'), 'tb'); assert(n.dependsOn.size === 2, 'size');
});

test('createTableNode: clauses', () => {
  const q = makeParsedQuery({
    select: { columns: [{ displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [], starSourceTable: null }] },
    where: { columnRefs: [], conditionText: 'x=1', subqueries: [] },
    groupBy: { columnRefs: [], expressionText: 'cat' }, having: null,
    orderBy: { columnRefs: [], expressionText: 'id DESC' },
  });
  const n = createTableNode(q);
  assert(n.clauses.select.columns.length === 1, 'select'); assert(n.clauses.where !== null, 'where');
  assert(n.clauses.groupBy !== null, 'groupBy'); assert(n.clauses.having === null, 'having');
  assert(n.clauses.orderBy !== null, 'orderBy');
});

test('createTableNode: FROM subqueries', () => {
  const sq = makeParsedQuery({ queryId: 'sq1', targetTable: null });
  const q = makeParsedQuery({ from: { tables: [], joins: [], subqueries: [{ alias: 'sub', query: sq }] } });
  const n = createTableNode(q);
  assert(n.fromSubqueries.length === 1, 'count'); assert(n.fromSubqueries[0].alias === 'sub', 'alias');
});

test('createTableNode: WHERE subqueries', () => {
  const sq = makeParsedQuery({ queryId: 'wsq1', targetTable: null });
  const q = makeParsedQuery({ where: { columnRefs: [], conditionText: 'IN', subqueries: [{ alias: '[sq]', query: sq }] } });
  const n = createTableNode(q);
  assert(n.whereSubqueries.length === 1, 'count'); assert(n.whereSubqueries[0].alias === '[sq]', 'alias');
});

test('createTableNode: CTE nested', () => {
  const cq = makeParsedQuery({ queryId: 'c1', targetTable: 'my_cte' });
  const q = makeParsedQuery({ ctes: [{ name: 'my_cte', query: cq }] });
  const n = createTableNode(q);
  assert(n.ctes.length === 1, 'count'); assert(n.ctes[0].name === 'my_cte', 'name');
});

// buildAliasMap
test('buildAliasMap: aliases', () => {
  const from: FromClause = { tables: [{ name: 'users', alias: 'u' }], joins: [{ joinType: 'INNER', table: 'orders', alias: 'o', onConditionRefs: [], onConditionText: '' }], subqueries: [] };
  const m = buildAliasMap(from);
  assert(m.get('u') === 'users', 'u->users'); assert(m.get('o') === 'orders', 'o->orders');
});

test('buildAliasMap: no alias self-map', () => {
  const from: FromClause = { tables: [{ name: 'users', alias: null }], joins: [], subqueries: [] };
  const m = buildAliasMap(from);
  assert(m.get('users') === 'users', 'self'); assert(m.size === 1, 'size');
});

// classifyDependencyType
test('classifyDependencyType: all types', () => {
  assert(classifyDependencyType('column_ref') === 'direct', 'column_ref');
  assert(classifyDependencyType('star') === 'star', 'star');
  assert(classifyDependencyType('table_star') === 'star', 'table_star');
  assert(classifyDependencyType('expression') === 'expression', 'expression');
  assert(classifyDependencyType('aggr_func') === 'aggregate', 'aggr_func');
  assert(classifyDependencyType('literal') === 'direct', 'literal');
});

// createColumnNode
test('createColumnNode: column_ref with alias', () => {
  const col: SelectColumn = { displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'id' }], starSourceTable: null };
  const am = new Map([['a', 'users'], ['users', 'users']]);
  const n = createColumnNode(col, 'out', am);
  assert(n.columnName === 'id', 'name'); assert(n.dependencies.length === 1, 'deps');
  assert(n.dependencies[0].sourceTableId === 'users', 'resolved'); assert(n.isFromStar === false, 'notStar');
});

test('createColumnNode: star', () => {
  const col: SelectColumn = { displayName: '*', sourceTable: null, sourceColumn: null, exprType: 'star', columnRefs: [], starSourceTable: null };
  const n = createColumnNode(col, 'out', new Map());
  assert(n.isFromStar === true, 'isStar'); assert(n.dependencies.length === 0, 'noDeps');
});

test('createColumnNode: table_star isFromStar', () => {
  const col: SelectColumn = { displayName: 'a.*', sourceTable: 'a', sourceColumn: null, exprType: 'table_star', columnRefs: [], starSourceTable: 'a' };
  const n = createColumnNode(col, 'out', new Map());
  assert(n.isFromStar === true, 'table_star isStar');
});

test('createColumnNode: expression multi refs', () => {
  const col: SelectColumn = { displayName: 'total', sourceTable: null, sourceColumn: null, exprType: 'expression', columnRefs: [{ table: 'a', column: 'x' }, { table: 'a', column: 'y' }], starSourceTable: null };
  const am = new Map([['a', 'prices'], ['prices', 'prices']]);
  const n = createColumnNode(col, 'out', am);
  assert(n.dependencies.length === 2, 'deps'); assert(n.dependencies[0].type === 'expression', 'type');
});

test('createColumnNode: no table prefix skipped', () => {
  const col: SelectColumn = { displayName: 'name', sourceTable: null, sourceColumn: null, exprType: 'column_ref', columnRefs: [{ table: null, column: 'name' }], starSourceTable: null };
  const n = createColumnNode(col, 'out', new Map());
  assert(n.dependencies.length === 0, 'noDeps');
});

// registerTables
test('registerTables: CTAS + unresolved', () => {
  const q = makeParsedQuery({ queryId: 'q1', targetTable: 'output', queryType: 'ctas', from: { tables: [{ name: 'src', alias: null }], joins: [], subqueries: [] } });
  const t = registerTables([q], new Map());
  assert(t.has('output'), 'output'); assert(t.get('output')!.isRegistered === true, 'reg');
  assert(t.has('src'), 'src'); assert(t.get('src')!.isRegistered === false, 'unreg');
});

test('registerTables: SELECT uses queryId', () => {
  const q = makeParsedQuery({ queryId: 'q-abc', targetTable: null, from: { tables: [{ name: 's', alias: null }], joins: [], subqueries: [] } });
  const t = registerTables([q], new Map());
  assert(t.has('q-abc'), 'queryId key'); assert(t.get('q-abc')!.isRegistered === true, 'reg');
});

test('registerTables: no overwrite existing', () => {
  const existing = new Map();
  existing.set('src', createUnresolvedTableNode('src'));
  const q = makeParsedQuery({ queryId: 'q1', targetTable: 'out', from: { tables: [{ name: 'src', alias: null }], joins: [], subqueries: [] } });
  const t = registerTables([q], existing);
  assert(t.get('src')!.isRegistered === false, 'kept unresolved');
});

// buildColumnDependencies
test('buildColumnDependencies: adds columns', () => {
  const q = makeParsedQuery({
    queryId: 'q1', targetTable: 'out',
    select: { columns: [{ displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'id' }], starSourceTable: null }] },
    from: { tables: [{ name: 'users', alias: 'a' }], joins: [], subqueries: [] },
  });
  const tables = new Map(); tables.set('out', createTableNode(q));
  const r = buildColumnDependencies(tables, [q]);
  assert(r.get('out')!.columns.size === 1, 'cols'); assert(r.get('out')!.columns.get('id')!.dependencies[0].sourceTableId === 'users', 'resolved');
});

// buildLineageGraph integration
test('buildLineageGraph: CTAS pipeline', () => {
  const q = makeParsedQuery({
    queryId: 'q1', targetTable: 'output', queryType: 'ctas',
    select: { columns: [{ displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'id' }], starSourceTable: null }] },
    from: { tables: [{ name: 'source', alias: 'a' }], joins: [], subqueries: [] },
  });
  const t = buildLineageGraph([q]);
  assert(t.has('output'), 'output'); assert(t.has('source'), 'source');
  assert(t.get('output')!.columns.size === 1, 'cols');
});

test('buildLineageGraph: multiple queries', () => {
  const q1 = makeParsedQuery({ queryId: 'q1', targetTable: 'mid', queryType: 'ctas', select: { columns: [{ displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'id' }], starSourceTable: null }] }, from: { tables: [{ name: 'raw', alias: 'a' }], joins: [], subqueries: [] } });
  const q2 = makeParsedQuery({ queryId: 'q2', targetTable: 'final', queryType: 'ctas', select: { columns: [{ displayName: 'id', sourceTable: 'b', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'b', column: 'id' }], starSourceTable: null }] }, from: { tables: [{ name: 'mid', alias: 'b' }], joins: [], subqueries: [] } });
  const t = buildLineageGraph([q1, q2]);
  assert(t.size === 3, '3 tables'); assert(t.get('raw')!.isRegistered === false, 'raw unreg');
  assert(t.get('mid')!.isRegistered === true, 'mid reg'); assert(t.get('final')!.isRegistered === true, 'final reg');
});

test('buildLineageGraph: empty', () => {
  assert(buildLineageGraph([]).size === 0, 'empty');
});

test('buildLineageGraph: existing tables', () => {
  const existing = new Map(); existing.set('source', createUnresolvedTableNode('source'));
  const q = makeParsedQuery({ queryId: 'q1', targetTable: 'out', from: { tables: [{ name: 'source', alias: null }], joins: [], subqueries: [] } });
  const t = buildLineageGraph([q], existing);
  assert(t.get('source')!.isRegistered === false, 'kept'); assert(t.get('out')!.isRegistered === true, 'new');
});

// Output
console.log('\\n=== buildLineageGraph Functional Test Results ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + passCount + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('functional tests pass (via tsx)', () => {
  // Write functional test to tmp, execute, then cleanup
  const tmpFile = path.join(ROOT, 'tmp', 'buildLineageGraph-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST_CONTENT);
  try {
    const output = execSync('npx tsx tmp/buildLineageGraph-test.ts', {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 60000,
    });
    const stdout = output.toString();
    console.log(stdout);
    assert(!stdout.includes('FAIL:'), 'Some functional tests failed');
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : '';
    const stdout = e.stdout ? e.stdout.toString() : '';
    if (stdout) console.log(stdout);
    throw new Error('Functional test execution failed: ' + stderr.slice(0, 500));
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
});

// Ensure no tmp ts files before tsc
try { fs.unlinkSync(path.join(ROOT, 'tmp', 'buildLineageGraph-test.ts')); } catch {}

// --- tsc project compilation check ---

test('project compiles without errors (tsc --noEmit)', () => {
  try {
    execSync('npx tsc --noEmit', {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 60000,
    });
  } catch (e) {
    throw new Error('TypeScript compilation failed: ' + (e.stderr ? e.stderr.toString().slice(0, 500) : e.message));
  }
});

// --- Output results ---
console.log('\n=== Source Structure Test Results ===\n');
for (const r of results) {
  if (r.status === 'PASS') {
    console.log(`  PASS: ${r.name}`);
  } else {
    console.log(`  FAIL: ${r.name} - ${r.error}`);
  }
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);

process.exit(failed ? 1 : 0);
