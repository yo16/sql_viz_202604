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

const srcPath = path.join(ROOT, 'src', 'stores', 'storeSubscriptions.ts');
const content = fs.readFileSync(srcPath, 'utf-8');

// --- Structure tests ---
test('storeSubscriptions.ts exists', () => { assert(fs.existsSync(srcPath), 'not found'); });
test('exports initStoreSubscriptions', () => { assert(content.includes('export function initStoreSubscriptions'), 'not exported'); });
test('imports useLineageStore', () => { assert(content.includes('useLineageStore'), 'missing'); });
test('imports useFlowStore', () => { assert(content.includes('useFlowStore'), 'missing'); });
test('calls subscribe', () => { assert(content.includes('.subscribe'), 'subscribe not called'); });
test('calls syncFromLineage', () => { assert(content.includes('syncFromLineage'), 'syncFromLineage not called'); });

// --- Functional tests ---
const FUNCTIONAL_TEST = `
import { initStoreSubscriptions } from '../src/stores/storeSubscriptions';
import { useLineageStore } from '../src/stores/lineageStore';
import { useFlowStore } from '../src/stores/flowStore';
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

function reset() {
  useLineageStore.getState().resetAll();
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
}

// --- initStoreSubscriptions returns unsubscribe ---
test('initStoreSubscriptions returns a function', () => {
  const unsub = initStoreSubscriptions();
  assert(typeof unsub === 'function', 'should return function');
  unsub();
});

// --- lineageStore changes auto-sync to flowStore ---
test('addQuery triggers flowStore sync via subscription', () => {
  reset();
  const unsub = initStoreSubscriptions();
  try {
    // flowStore should be empty initially
    assert(useFlowStore.getState().nodes.length === 0, 'initially empty');

    // Add a query to lineageStore
    const q = makePQ({
      queryId: 'q1', targetTable: 'output', queryType: 'ctas',
      select: { columns: [{ displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref', columnRefs: [{ table: 'a', column: 'id' }], starSourceTable: null }] },
      from: { tables: [{ name: 'source', alias: 'a' }], joins: [], subqueries: [] },
    });
    useLineageStore.getState().addQuery(q);

    // flowStore should now have nodes (auto-synced)
    const flowState = useFlowStore.getState();
    assert(flowState.nodes.length > 0, 'flowStore nodes synced: ' + flowState.nodes.length);
    assert(flowState.nodes.some(n => n.id === 'output'), 'output node exists');
    assert(flowState.nodes.some(n => n.id === 'source'), 'source node exists');
  } finally {
    unsub();
  }
});

// --- resetAll clears flowStore ---
test('resetAll clears flowStore via subscription', () => {
  reset();
  const unsub = initStoreSubscriptions();
  try {
    const q = makePQ({ queryId: 'q1', targetTable: 'out' });
    useLineageStore.getState().addQuery(q);
    assert(useFlowStore.getState().nodes.length > 0, 'has nodes');

    useLineageStore.getState().resetAll();
    assert(useFlowStore.getState().nodes.length === 0, 'nodes cleared');
    assert(useFlowStore.getState().edges.length === 0, 'edges cleared');
  } finally {
    unsub();
  }
});

// --- unsubscribe stops sync ---
test('unsubscribe stops auto-sync', () => {
  reset();
  const unsub = initStoreSubscriptions();
  unsub(); // unsubscribe immediately

  const q = makePQ({ queryId: 'q1', targetTable: 'out' });
  useLineageStore.getState().addQuery(q);

  // flowStore should NOT have been updated (unsubscribed)
  assert(useFlowStore.getState().nodes.length === 0, 'not synced after unsubscribe');
});

// --- edges are synced ---
test('edges are synced from lineageStore dependencies', () => {
  reset();
  const unsub = initStoreSubscriptions();
  try {
    const q = makePQ({
      queryId: 'q1', targetTable: 'output', queryType: 'ctas',
      from: { tables: [{ name: 'source', alias: null }], joins: [], subqueries: [] },
    });
    useLineageStore.getState().addQuery(q);
    const flowState = useFlowStore.getState();
    assert(flowState.edges.length >= 1, 'has edges');
    assert(flowState.edges.some(e => e.source === 'source' && e.target === 'output'), 'correct edge');
  } finally {
    unsub();
  }
});

// --- multiple addQuery calls sync incrementally ---
test('multiple addQuery calls update flowStore', () => {
  reset();
  const unsub = initStoreSubscriptions();
  try {
    const q1 = makePQ({ queryId: 'q1', targetTable: 'mid', queryType: 'ctas',
      from: { tables: [{ name: 'raw', alias: null }], joins: [], subqueries: [] } });
    useLineageStore.getState().addQuery(q1);
    assert(useFlowStore.getState().nodes.length === 2, '2 nodes after q1');

    const q2 = makePQ({ queryId: 'q2', targetTable: 'final', queryType: 'ctas',
      from: { tables: [{ name: 'mid', alias: null }], joins: [], subqueries: [] } });
    useLineageStore.getState().addQuery(q2);
    assert(useFlowStore.getState().nodes.length === 3, '3 nodes after q2');
  } finally {
    unsub();
  }
});

// --- removeQuery updates flowStore ---
test('removeQuery updates flowStore via subscription', () => {
  reset();
  const unsub = initStoreSubscriptions();
  try {
    const q1 = makePQ({ queryId: 'q1', targetTable: 'a', from: { tables: [{ name: 'src', alias: null }], joins: [], subqueries: [] } });
    useLineageStore.getState().addQuery(q1);
    const countBefore = useFlowStore.getState().nodes.length;
    assert(countBefore > 0, 'has nodes');

    useLineageStore.getState().removeQuery('q1');
    assert(useFlowStore.getState().nodes.length === 0, 'cleared after remove');
  } finally {
    unsub();
  }
});

// Output
console.log('\\n=== storeSubscriptions Functional Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('functional tests pass (via tsx)', () => {
  const tmpFile = path.join(ROOT, 'tmp', 'storeSub-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const output = execSync('npx tsx tmp/storeSub-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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

try { fs.unlinkSync(path.join(ROOT, 'tmp', 'storeSub-test.ts')); } catch {}

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
