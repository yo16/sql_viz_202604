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
test('imports recalculateLayout', () => { assert(content.includes("from '@/layout/recalculateLayout'"), 'no import'); });
test('toggleDisplayMode calls recalculateLayout', () => { assert(content.includes('recalculateLayout('), 'no recalc call'); });
// bd-sql_viz_202604_2-8dp: 以前は collectDescendantIds で子孫を一律に hidden 設定
// していたが、ネスト compact 状態が壊れる問題があったため、displayModes チェーンから
// hidden を計算する computeHiddenStatesFromDisplayModes に変更
test('toggleDisplayMode uses computeHiddenStatesFromDisplayModes (bd-8dp)', () => {
  assert(content.includes('computeHiddenStatesFromDisplayModes'),
    'computeHiddenStatesFromDisplayModes should be used');
});

// --- Functional tests ---
const FUNCTIONAL_TEST = `
import { useFlowStore } from '../src/stores/flowStore';
import type { Node } from '@xyflow/react';

const results: Array<{name: string; status: string; error?: string}> = [];
let failed = false;
function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e: any) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

function reset() {
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
}

function makeNode(id: string, overrides: Partial<Node> = {}): Node {
  return { id, position: { x: 0, y: 0 }, data: {}, ...overrides } as Node;
}

// =====================
// Basic toggle
// =====================

test('toggleDisplayMode: detail to compact updates displayMode', () => {
  reset();
  const dm = new Map<string, 'compact' | 'detail'>();
  dm.set('q1', 'detail');
  useFlowStore.setState({
    displayModes: dm,
    nodes: [makeNode('q1', { type: 'queryBox', data: { displayMode: 'detail' } as any })],
  });
  useFlowStore.getState().toggleDisplayMode('q1');
  assert(useFlowStore.getState().displayModes.get('q1') === 'compact', 'displayMode toggled');
  const node = useFlowStore.getState().nodes.find(n => n.id === 'q1')!;
  assert((node.data as any).displayMode === 'compact', 'node data updated');
});

test('toggleDisplayMode: compact to detail', () => {
  reset();
  const dm = new Map<string, 'compact' | 'detail'>();
  dm.set('q1', 'compact');
  useFlowStore.setState({
    displayModes: dm,
    nodes: [makeNode('q1', { type: 'queryBox', data: { displayMode: 'compact' } as any })],
  });
  useFlowStore.getState().toggleDisplayMode('q1');
  assert(useFlowStore.getState().displayModes.get('q1') === 'detail', 'toggled to detail');
});

// =====================
// Children hidden control
// =====================

test('toggleDisplayMode: hides children when going compact', () => {
  reset();
  const dm = new Map<string, 'compact' | 'detail'>();
  dm.set('q1', 'detail');
  useFlowStore.setState({
    displayModes: dm,
    nodes: [
      makeNode('q1', { type: 'queryBox', data: { displayMode: 'detail' } as any }),
      makeNode('clause1', { type: 'clauseBox', parentId: 'q1', hidden: false }),
      makeNode('col1', { type: 'columnItem', parentId: 'clause1', hidden: false }),
    ],
  });
  useFlowStore.getState().toggleDisplayMode('q1');
  const state = useFlowStore.getState();
  assert(state.nodes.find(n => n.id === 'clause1')?.hidden === true, 'clause hidden');
  assert(state.nodes.find(n => n.id === 'col1')?.hidden === true, 'col hidden (recursive)');
});

test('toggleDisplayMode: shows children when going detail', () => {
  reset();
  const dm = new Map<string, 'compact' | 'detail'>();
  dm.set('q1', 'compact');
  useFlowStore.setState({
    displayModes: dm,
    nodes: [
      makeNode('q1', { type: 'queryBox', data: { displayMode: 'compact' } as any }),
      makeNode('clause1', { type: 'clauseBox', parentId: 'q1', hidden: true }),
      makeNode('col1', { type: 'columnItem', parentId: 'clause1', hidden: true }),
    ],
  });
  useFlowStore.getState().toggleDisplayMode('q1');
  const state = useFlowStore.getState();
  assert(state.nodes.find(n => n.id === 'clause1')?.hidden === false, 'clause shown');
  assert(state.nodes.find(n => n.id === 'col1')?.hidden === false, 'col shown (recursive)');
});

test('toggleDisplayMode: only affects descendants of the target', () => {
  reset();
  const dm = new Map<string, 'compact' | 'detail'>();
  dm.set('q1', 'detail');
  useFlowStore.setState({
    displayModes: dm,
    nodes: [
      makeNode('q1', { type: 'queryBox', data: { displayMode: 'detail' } as any }),
      makeNode('q2', { type: 'queryBox', data: { displayMode: 'detail' } as any }),
      makeNode('q1-clause', { parentId: 'q1', hidden: false }),
      makeNode('q2-clause', { parentId: 'q2', hidden: false }),
    ],
  });
  useFlowStore.getState().toggleDisplayMode('q1');
  const state = useFlowStore.getState();
  assert(state.nodes.find(n => n.id === 'q1-clause')?.hidden === true, 'q1-clause hidden');
  assert(state.nodes.find(n => n.id === 'q2-clause')?.hidden === false, 'q2-clause unchanged');
});

// =====================
// recalculateLayout integration
// =====================

test('toggleDisplayMode: triggers recalculateLayout (sizes updated)', () => {
  reset();
  const dm = new Map<string, 'compact' | 'detail'>();
  dm.set('q1', 'detail');
  useFlowStore.setState({
    displayModes: dm,
    nodes: [
      makeNode('q1', { type: 'queryBox', data: { displayMode: 'detail' } as any }),
      makeNode('child', { parentId: 'q1', position: { x: 12, y: 44 }, width: 200, height: 100, hidden: false }),
    ],
  });
  useFlowStore.getState().toggleDisplayMode('q1');
  const parent = useFlowStore.getState().nodes.find(n => n.id === 'q1')!;
  // After compact toggle, all children are hidden, so parent should be at min size (220x80)
  assert((parent as any).width !== undefined, 'parent has width');
  assert((parent as any).height !== undefined, 'parent has height');
});

test('toggleDisplayMode: non-existent ID defaults to compact toggle', () => {
  reset();
  useFlowStore.getState().toggleDisplayMode('unknown');
  assert(useFlowStore.getState().displayModes.get('unknown') === 'compact', 'default detail toggled');
});

// Output
console.log('\\n=== toggleDisplayMode Functional Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('functional tests pass (via tsx)', () => {
  const tmpFile = path.join(ROOT, 'tmp', 'toggleDisplayMode-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const output = execSync('npx tsx tmp/toggleDisplayMode-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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

try { fs.unlinkSync(path.join(ROOT, 'tmp', 'toggleDisplayMode-test.ts')); } catch {}

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
