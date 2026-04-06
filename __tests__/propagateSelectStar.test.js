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

const srcPath = path.join(ROOT, 'src', 'lib', 'lineage', 'propagateSelectStar.ts');
const content = fs.readFileSync(srcPath, 'utf-8');

// --- Structure tests ---
test('propagateSelectStar.ts exists', () => { assert(fs.existsSync(srcPath), 'not found'); });
test('exports propagateSelectStar', () => { assert(content.includes('export function propagateSelectStar'), 'not exported'); });
test('exports expandStar', () => { assert(content.includes('export function expandStar'), 'not exported'); });
test('exports expandTableStar', () => { assert(content.includes('export function expandTableStar'), 'not exported'); });
test('exports topologicalSort', () => { assert(content.includes('export function topologicalSort'), 'not exported'); });

// --- Functional tests ---
const FUNCTIONAL_TEST = `
import { propagateSelectStar, expandStar, expandTableStar, topologicalSort } from '../src/lib/lineage/propagateSelectStar';
import type { TableNode, ColumnNode } from '../src/types/lineage';

const results: Array<{name: string; status: string; error?: string}> = [];
let failed = false;
function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e: any) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

function makeTable(id: string, overrides: Partial<TableNode> = {}): TableNode {
  return {
    id, name: id, displayTitle: id, isRegistered: true, queryType: 'ctas',
    queryId: id, columns: new Map(), dependsOn: new Set(),
    ctes: [], fromSubqueries: [], whereSubqueries: [],
    clauses: { select: { columns: [] }, from: { tables: [], joins: [] }, where: null, groupBy: null, having: null, orderBy: null },
    ...overrides,
  };
}

function makeCol(name: string, overrides: Partial<ColumnNode> = {}): ColumnNode {
  return {
    columnName: name, tableId: 'unknown', certainty: 'confirmed',
    dependencies: [], isFromStar: false, exprType: 'column_ref', ...overrides,
  };
}

// =====================
// topologicalSort
// =====================

test('topologicalSort: linear chain A -> B -> C', () => {
  const tables = new Map<string, TableNode>();
  tables.set('A', makeTable('A'));
  tables.set('B', makeTable('B', { dependsOn: new Set(['A']) }));
  tables.set('C', makeTable('C', { dependsOn: new Set(['B']) }));
  const sorted = topologicalSort(tables);
  const idxA = sorted.indexOf('A');
  const idxB = sorted.indexOf('B');
  const idxC = sorted.indexOf('C');
  assert(idxA < idxB, 'A before B');
  assert(idxB < idxC, 'B before C');
});

test('topologicalSort: independent tables', () => {
  const tables = new Map<string, TableNode>();
  tables.set('X', makeTable('X'));
  tables.set('Y', makeTable('Y'));
  const sorted = topologicalSort(tables);
  assert(sorted.length === 2, 'both present');
  assert(sorted.includes('X') && sorted.includes('Y'), 'contains both');
});

test('topologicalSort: handles circular dependency gracefully', () => {
  const tables = new Map<string, TableNode>();
  tables.set('A', makeTable('A', { dependsOn: new Set(['B']) }));
  tables.set('B', makeTable('B', { dependsOn: new Set(['A']) }));
  // Should not throw, should return all tables despite cycle
  const sorted = topologicalSort(tables);
  assert(sorted.length === 2, 'should return both tables');
  assert(sorted.includes('A'), 'contains A');
  assert(sorted.includes('B'), 'contains B');
});

test('topologicalSort: empty tables', () => {
  const sorted = topologicalSort(new Map());
  assert(sorted.length === 0, 'empty');
});

test('topologicalSort: dependency on non-existent table', () => {
  const tables = new Map<string, TableNode>();
  tables.set('A', makeTable('A', { dependsOn: new Set(['missing']) }));
  const sorted = topologicalSort(tables);
  assert(sorted.includes('A'), 'A should be in result');
});

// =====================
// expandStar
// =====================

test('expandStar: propagates all columns from dependsOn tables', () => {
  const tables = new Map<string, TableNode>();
  const src = makeTable('src');
  src.columns.set('id', makeCol('id', { tableId: 'src' }));
  src.columns.set('name', makeCol('name', { tableId: 'src' }));
  tables.set('src', src);

  const target = makeTable('target', { dependsOn: new Set(['src']) });
  target.columns.set('*', makeCol('*', { tableId: 'target', isFromStar: true, exprType: 'star' }));
  tables.set('target', target);

  expandStar(target, tables);

  assert(!target.columns.has('*'), '* should be removed');
  assert(target.columns.has('id'), 'id propagated');
  assert(target.columns.has('name'), 'name propagated');
  assert(target.columns.get('id')!.certainty === 'propagated', 'certainty');
  assert(target.columns.get('id')!.dependencies[0].type === 'star', 'dep type');
  assert(target.columns.get('id')!.dependencies[0].sourceTableId === 'src', 'source');
  assert(target.columns.get('id')!.tableId === 'target', 'tableId is target');
});

test('expandStar: does not overwrite existing columns', () => {
  const tables = new Map<string, TableNode>();
  const src = makeTable('src');
  src.columns.set('id', makeCol('id', { tableId: 'src' }));
  tables.set('src', src);

  const target = makeTable('target', { dependsOn: new Set(['src']) });
  target.columns.set('*', makeCol('*', { tableId: 'target', isFromStar: true, exprType: 'star' }));
  target.columns.set('id', makeCol('id', { tableId: 'target', certainty: 'confirmed' }));
  tables.set('target', target);

  expandStar(target, tables);

  assert(target.columns.get('id')!.certainty === 'confirmed', 'existing preserved');
});

test('expandStar: multiple source tables', () => {
  const tables = new Map<string, TableNode>();
  const src1 = makeTable('src1');
  src1.columns.set('a', makeCol('a', { tableId: 'src1' }));
  const src2 = makeTable('src2');
  src2.columns.set('b', makeCol('b', { tableId: 'src2' }));
  tables.set('src1', src1);
  tables.set('src2', src2);

  const target = makeTable('target', { dependsOn: new Set(['src1', 'src2']) });
  target.columns.set('*', makeCol('*', { tableId: 'target', isFromStar: true, exprType: 'star' }));
  tables.set('target', target);

  expandStar(target, tables);
  assert(target.columns.has('a'), 'a from src1');
  assert(target.columns.has('b'), 'b from src2');
  assert(!target.columns.has('*'), '* removed');
});

// =====================
// expandTableStar
// =====================

test('expandTableStar: propagates only from specified table', () => {
  const tables = new Map<string, TableNode>();
  const src1 = makeTable('src1');
  src1.columns.set('a', makeCol('a', { tableId: 'src1' }));
  const src2 = makeTable('src2');
  src2.columns.set('b', makeCol('b', { tableId: 'src2' }));
  tables.set('src1', src1);
  tables.set('src2', src2);

  const target = makeTable('target', { dependsOn: new Set(['src1', 'src2']) });
  target.columns.set('src1.*', makeCol('src1.*', {
    tableId: 'target', isFromStar: true, exprType: 'table_star',
    dependencies: [{ sourceTableId: 'src1', sourceColumn: '*', type: 'star' }],
  }));
  tables.set('target', target);

  expandTableStar(target, 'src1', tables);
  assert(target.columns.has('a'), 'a from src1');
  assert(!target.columns.has('b'), 'b not from src2');
  assert(!target.columns.has('src1.*'), 'src1.* removed');
  assert(target.columns.get('a')!.certainty === 'propagated', 'certainty propagated');
  assert(target.columns.get('a')!.isFromStar === true, 'isFromStar true');
  assert(target.columns.get('a')!.exprType === 'column_ref', 'exprType column_ref');
  assert(target.columns.get('a')!.dependencies[0].type === 'star', 'dep type star');
  assert(target.columns.get('a')!.dependencies[0].sourceTableId === 'src1', 'dep source');
  assert(target.columns.get('a')!.tableId === 'target', 'tableId is target');
});

test('expandTableStar: source table not found does nothing', () => {
  const tables = new Map<string, TableNode>();
  const target = makeTable('target');
  tables.set('target', target);

  expandTableStar(target, 'missing', tables);
  assert(target.columns.size === 0, 'unchanged');
});

// =====================
// propagateSelectStar (integration)
// =====================

test('propagateSelectStar: chain propagation A -> B -> C', () => {
  const tables = new Map<string, TableNode>();
  const A = makeTable('A');
  A.columns.set('id', makeCol('id', { tableId: 'A' }));
  A.columns.set('name', makeCol('name', { tableId: 'A' }));
  tables.set('A', A);

  const B = makeTable('B', { dependsOn: new Set(['A']) });
  B.columns.set('*', makeCol('*', { tableId: 'B', isFromStar: true, exprType: 'star' }));
  tables.set('B', B);

  const C = makeTable('C', { dependsOn: new Set(['B']) });
  C.columns.set('*', makeCol('*', { tableId: 'C', isFromStar: true, exprType: 'star' }));
  tables.set('C', C);

  propagateSelectStar(tables);

  // B should have id, name from A
  assert(B.columns.has('id'), 'B has id');
  assert(B.columns.has('name'), 'B has name');
  // C should have id, name from B (chain propagation)
  assert(C.columns.has('id'), 'C has id');
  assert(C.columns.has('name'), 'C has name');
  assert(C.columns.get('id')!.certainty === 'propagated', 'C.id propagated');
});

test('propagateSelectStar: no star columns does nothing', () => {
  const tables = new Map<string, TableNode>();
  const A = makeTable('A');
  A.columns.set('id', makeCol('id', { tableId: 'A' }));
  tables.set('A', A);

  propagateSelectStar(tables);
  assert(A.columns.size === 1, 'unchanged');
  assert(A.columns.get('id')!.certainty === 'confirmed', 'still confirmed');
});

test('propagateSelectStar: empty tables', () => {
  const tables = new Map<string, TableNode>();
  propagateSelectStar(tables);
  assert(tables.size === 0, 'empty');
});

test('propagateSelectStar: table_star with specific source', () => {
  const tables = new Map<string, TableNode>();
  const src1 = makeTable('src1');
  src1.columns.set('a', makeCol('a', { tableId: 'src1' }));
  const src2 = makeTable('src2');
  src2.columns.set('b', makeCol('b', { tableId: 'src2' }));
  tables.set('src1', src1);
  tables.set('src2', src2);

  const target = makeTable('target', { dependsOn: new Set(['src1', 'src2']) });
  target.columns.set('src1.*', makeCol('src1.*', {
    tableId: 'target', isFromStar: true, exprType: 'table_star',
    dependencies: [{ sourceTableId: 'src1', sourceColumn: '*', type: 'star' }],
  }));
  tables.set('target', target);

  propagateSelectStar(tables);
  assert(target.columns.has('a'), 'a from src1');
  assert(!target.columns.has('b'), 'no b from src2');
});

// Output
console.log('\\n=== propagateSelectStar Functional Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('functional tests pass (via tsx)', () => {
  const tmpFile = path.join(ROOT, 'tmp', 'propagateStar-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const output = execSync('npx tsx tmp/propagateStar-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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

try { fs.unlinkSync(path.join(ROOT, 'tmp', 'propagateStar-test.ts')); } catch {}

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
