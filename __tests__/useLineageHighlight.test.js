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

const hookPath = path.join(ROOT, 'src', 'hooks', 'useLineageHighlight.ts');
const content = fs.readFileSync(hookPath, 'utf-8');

// --- Structure tests ---
test('useLineageHighlight.ts exists', () => { assert(fs.existsSync(hookPath), 'not found'); });
test('has "use client" directive', () => { assert(content.includes('"use client"'), 'missing'); });
test('imports useCallback', () => { assert(content.includes('useCallback'), 'no useCallback'); });
test('imports useFlowStore', () => { assert(content.includes("from '@/stores/flowStore'"), 'no store import'); });
test('exports useLineageHighlight function', () => { assert(content.includes('export function useLineageHighlight'), 'not exported'); });
test('selects highlightLineage from store', () => { assert(content.includes('s.highlightLineage'), 'no highlightLineage select'); });
test('selects clearHighlight from store', () => { assert(content.includes('s.clearHighlight'), 'no clearHighlight select'); });
test('selects highlightPath from store', () => { assert(content.includes('s.highlightPath'), 'no highlightPath select'); });
test('defines handleColumnClick', () => { assert(content.includes('handleColumnClick'), 'no handleColumnClick'); });
test('defines handleCanvasClick', () => { assert(content.includes('handleCanvasClick'), 'no handleCanvasClick'); });
test('handleColumnClick calls highlightLineage', () => { assert(/highlightLineage\(tableId,\s*columnName\)/.test(content), 'highlightLineage not called'); });
test('handleColumnClick toggles via clearHighlight on same column', () => {
  assert(content.includes('highlightPath?.tableId === tableId'), 'no tableId compare');
  assert(content.includes('highlightPath?.columnName === columnName'), 'no columnName compare');
  assert(content.includes('clearHighlight()'), 'no clearHighlight call');
});
test('handleCanvasClick calls clearHighlight', () => {
  const m = content.match(/handleCanvasClick\s*=\s*useCallback\(\(\)\s*=>\s*\{[\s\S]*?clearHighlight\(\)/);
  assert(m !== null, 'handleCanvasClick does not call clearHighlight');
});
test('returns handleColumnClick and handleCanvasClick', () => {
  assert(/return\s*\{[\s\S]*handleColumnClick[\s\S]*handleCanvasClick/.test(content), 'return missing');
});
test('uses useCallback for handleColumnClick', () => {
  assert(/handleColumnClick\s*=\s*useCallback/.test(content), 'handleColumnClick not memoized');
});
test('uses useCallback for handleCanvasClick', () => {
  assert(/handleCanvasClick\s*=\s*useCallback/.test(content), 'handleCanvasClick not memoized');
});

// --- Functional test via tsx ---
const FUNCTIONAL_TEST = `
import { useFlowStore } from '../src/stores/flowStore';

const results: Array<{name: string; status: string; error?: string}> = [];
let failed = false;
function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e: any) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }

function reset() {
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
}

test('highlightLineage sets highlightPath', () => {
  reset();
  useFlowStore.getState().highlightLineage('t1', 'col_a');
  const hp = useFlowStore.getState().highlightPath;
  assert(hp !== null, 'highlightPath is null');
  assert(hp!.tableId === 't1', 'wrong tableId');
  assert(hp!.columnName === 'col_a', 'wrong columnName');
});

test('clearHighlight sets highlightPath to null', () => {
  reset();
  useFlowStore.getState().highlightLineage('t1', 'col_a');
  useFlowStore.getState().clearHighlight();
  assert(useFlowStore.getState().highlightPath === null, 'not cleared');
});

test('highlightLineage switches to different column', () => {
  reset();
  useFlowStore.getState().highlightLineage('t1', 'col_a');
  useFlowStore.getState().highlightLineage('t1', 'col_b');
  assert(useFlowStore.getState().highlightPath?.columnName === 'col_b', 'did not switch');
});

console.log('\\n=== useLineageHighlight Store Integration ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('functional store integration via tsx', () => {
  const tmpDir = path.join(ROOT, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
  const tmpFile = path.join(tmpDir, 'useLineageHighlight-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const output = execSync('npx tsx tmp/useLineageHighlight-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    const stdout = output.toString();
    console.log(stdout);
    assert(!stdout.includes('FAIL:'), 'functional tests failed');
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : '';
    const stdout = e.stdout ? e.stdout.toString() : '';
    if (stdout) console.log(stdout);
    throw new Error('Failed: ' + stderr.slice(0, 500));
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
});

test('project compiles (tsc --noEmit)', () => {
  try { execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe', timeout: 60000 }); }
  catch (e) { throw new Error('tsc failed: ' + (e.stderr ? e.stderr.toString().slice(0, 500) : e.message)); }
});

// Output
console.log('\n=== useLineageHighlight Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
