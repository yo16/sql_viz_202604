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

const srcPath = path.join(ROOT, 'src', 'stores', 'flowStore.ts');
const content = fs.readFileSync(srcPath, 'utf-8');

// --- Structure tests ---
test('flowStore.ts exists', () => { assert(fs.existsSync(srcPath), 'not found'); });
test('exports useFlowStore', () => { assert(content.includes('export const useFlowStore'), 'not exported'); });
test('imports create from zustand', () => { assert(content.includes("from 'zustand'"), 'zustand import'); });
test('imports FlowStore type from flow.ts', () => { assert(content.includes('FlowStore'), 'FlowStore type'); });
test('imports TableNode from lineage', () => { assert(content.includes('TableNode'), 'TableNode import'); });
test('documents 6k0.6 subscribe task', () => { assert(content.includes('6k0.6'), 'subscribe task ref'); });

// --- Functional tests ---
const FUNCTIONAL_TEST = `
import { useFlowStore } from '../src/stores/flowStore';
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

function reset() {
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
}

// --- Initial state ---
test('initial state: empty', () => {
  reset();
  const s = useFlowStore.getState();
  assert(s.nodes.length === 0, 'nodes empty');
  assert(s.edges.length === 0, 'edges empty');
  assert(s.displayModes instanceof Map, 'displayModes Map');
  assert(s.highlightPath === null, 'highlight null');
});

// --- syncFromLineage ---
test('syncFromLineage: creates nodes for registered tables', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('output', makeTable('output', { displayTitle: 'output', queryType: 'ctas' }));
  useFlowStore.getState().syncFromLineage(tables);
  const s = useFlowStore.getState();
  assert(s.nodes.length === 1, '1 node');
  assert(s.nodes[0].id === 'output', 'node id');
  assert(s.nodes[0].type === 'queryBox', 'queryBox type');
  assert((s.nodes[0].data as any).title === 'output', 'title');
});

test('syncFromLineage: creates nodes for unresolved tables', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('unknown', makeTable('unknown', { isRegistered: false, queryType: 'unresolved', displayTitle: '[未登録] unknown' }));
  useFlowStore.getState().syncFromLineage(tables);
  const s = useFlowStore.getState();
  assert(s.nodes.length === 1, '1 node');
  assert(s.nodes[0].type === 'unresolvedBox', 'unresolvedBox type');
});

test('syncFromLineage: creates edges from dependsOn', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('source', makeTable('source'));
  tables.set('output', makeTable('output', { dependsOn: new Set(['source']) }));
  useFlowStore.getState().syncFromLineage(tables);
  const s = useFlowStore.getState();
  assert(s.edges.length === 1, '1 edge');
  assert(s.edges[0].source === 'source', 'edge source');
  assert(s.edges[0].target === 'output', 'edge target');
});

test('syncFromLineage: sets default displayMode to detail', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('t1', makeTable('t1'));
  useFlowStore.getState().syncFromLineage(tables);
  assert(useFlowStore.getState().displayModes.get('t1') === 'detail', 'default detail');
});

test('syncFromLineage: preserves existing displayMode', () => {
  reset();
  const dm = new Map<string, 'compact' | 'detail'>();
  dm.set('t1', 'compact');
  useFlowStore.setState({ displayModes: dm });
  const tables = new Map<string, TableNode>();
  tables.set('t1', makeTable('t1'));
  useFlowStore.getState().syncFromLineage(tables);
  assert(useFlowStore.getState().displayModes.get('t1') === 'compact', 'preserved compact');
});

test('syncFromLineage: empty tables clears nodes/edges', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('t1', makeTable('t1'));
  useFlowStore.getState().syncFromLineage(tables);
  assert(useFlowStore.getState().nodes.length === 1, 'before');
  useFlowStore.getState().syncFromLineage(new Map());
  assert(useFlowStore.getState().nodes.length === 0, 'after');
  assert(useFlowStore.getState().edges.length === 0, 'edges cleared');
});

test('syncFromLineage: does not create edge to missing table', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('output', makeTable('output', { dependsOn: new Set(['nonexistent']) }));
  useFlowStore.getState().syncFromLineage(tables);
  assert(useFlowStore.getState().edges.length === 0, 'no edge to missing');
});

test('syncFromLineage: columns included in compactColumns/inferredColumns', () => {
  reset();
  const regTable = makeTable('reg', { queryType: 'ctas' });
  regTable.columns.set('id', { columnName: 'id', tableId: 'reg', certainty: 'confirmed', dependencies: [], isFromStar: false, exprType: 'column_ref' });
  const unregTable = makeTable('unreg', { isRegistered: false, queryType: 'unresolved' });
  unregTable.columns.set('name', { columnName: 'name', tableId: 'unreg', certainty: 'inferred', dependencies: [], isFromStar: false, exprType: 'column_ref' });
  const tables = new Map<string, TableNode>();
  tables.set('reg', regTable);
  tables.set('unreg', unregTable);
  useFlowStore.getState().syncFromLineage(tables);
  const s = useFlowStore.getState();
  const regNode = s.nodes.find(n => n.id === 'reg')!;
  assert((regNode.data as any).compactColumns.includes('id'), 'reg compactColumns');
  const unregNode = s.nodes.find(n => n.id === 'unreg')!;
  assert((unregNode.data as any).inferredColumns.includes('name'), 'unreg inferredColumns');
});

// --- toggleDisplayMode ---
test('toggleDisplayMode: detail to compact', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('t1', makeTable('t1'));
  useFlowStore.getState().syncFromLineage(tables);
  assert(useFlowStore.getState().displayModes.get('t1') === 'detail', 'starts detail');
  useFlowStore.getState().toggleDisplayMode('t1');
  assert(useFlowStore.getState().displayModes.get('t1') === 'compact', 'now compact');
});

test('toggleDisplayMode: compact to detail', () => {
  reset();
  const dm = new Map<string, 'compact' | 'detail'>();
  dm.set('t1', 'compact');
  useFlowStore.setState({ displayModes: dm, nodes: [{ id: 't1', position: { x: 0, y: 0 }, data: { displayMode: 'compact' } } as any], edges: [] });
  useFlowStore.getState().toggleDisplayMode('t1');
  assert(useFlowStore.getState().displayModes.get('t1') === 'detail', 'toggled to detail');
});

test('toggleDisplayMode: updates node data displayMode', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('t1', makeTable('t1'));
  useFlowStore.getState().syncFromLineage(tables);
  useFlowStore.getState().toggleDisplayMode('t1');
  const node = useFlowStore.getState().nodes.find(n => n.id === 't1')!;
  assert((node.data as any).displayMode === 'compact', 'node data updated');
});

// --- highlightLineage ---
test('highlightLineage: sets highlightPath', () => {
  reset();
  useFlowStore.getState().highlightLineage('t1', 'id');
  const s = useFlowStore.getState();
  assert(s.highlightPath !== null, 'not null');
  assert(s.highlightPath!.tableId === 't1', 'tableId');
  assert(s.highlightPath!.columnName === 'id', 'columnName');
});

// --- clearHighlight ---
test('clearHighlight: clears highlightPath', () => {
  reset();
  useFlowStore.getState().highlightLineage('t1', 'id');
  assert(useFlowStore.getState().highlightPath !== null, 'set');
  useFlowStore.getState().clearHighlight();
  assert(useFlowStore.getState().highlightPath === null, 'cleared');
});

// --- Additional coverage ---

test('syncFromLineage: queryType select creates queryBox', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q-sel', makeTable('q-sel', { name: null, displayTitle: '[問い合わせ]', queryType: 'select' }));
  useFlowStore.getState().syncFromLineage(tables);
  const node = useFlowStore.getState().nodes.find(n => n.id === 'q-sel')!;
  assert(node.type === 'queryBox', 'select queryBox');
  assert((node.data as any).queryType === 'select', 'queryType select');
  assert((node.data as any).title === '[問い合わせ]', 'title');
});

test('toggleDisplayMode: non-existent ID defaults to detail then toggles', () => {
  reset();
  useFlowStore.getState().toggleDisplayMode('unknown-id');
  assert(useFlowStore.getState().displayModes.get('unknown-id') === 'compact', 'default detail toggled to compact');
});

test('clearHighlight: idempotent when already null', () => {
  reset();
  assert(useFlowStore.getState().highlightPath === null, 'starts null');
  useFlowStore.getState().clearHighlight();
  assert(useFlowStore.getState().highlightPath === null, 'still null');
});

test('highlightLineage: overwrite with new values', () => {
  reset();
  useFlowStore.getState().highlightLineage('t1', 'id');
  useFlowStore.getState().highlightLineage('t2', 'name');
  const hp = useFlowStore.getState().highlightPath!;
  assert(hp.tableId === 't2', 'overwritten tableId');
  assert(hp.columnName === 'name', 'overwritten columnName');
});

// Output
console.log('\\n=== flowStore Functional Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('functional tests pass (via tsx)', () => {
  const tmpFile = path.join(ROOT, 'tmp', 'flowStore-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const output = execSync('npx tsx tmp/flowStore-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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

try { fs.unlinkSync(path.join(ROOT, 'tmp', 'flowStore-test.ts')); } catch {}

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
