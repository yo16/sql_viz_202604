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

const srcPath = path.join(ROOT, 'src', 'layout', 'recalculateLayout.ts');
const content = fs.readFileSync(srcPath, 'utf-8');

// --- Structure tests ---
test('recalculateLayout.ts exists', () => { assert(fs.existsSync(srcPath), 'not found'); });
test('exports recalculateLayout', () => { assert(content.includes('export function recalculateLayout'), 'not exported'); });
test('does not export buildChildrenMap', () => { assert(!content.includes('export function buildChildrenMap'), 'should not be exported'); });
test('does not export calculateDepths', () => { assert(!content.includes('export function calculateDepths'), 'should not be exported'); });
test('imports calculateParentSize', () => { assert(content.includes("from './calculateParentSize'"), 'import not found'); });

// --- Functional tests ---
const FUNCTIONAL_TEST = `
import { recalculateLayout } from '../src/layout/recalculateLayout';
import { LAYOUT } from '../src/layout/layoutConstants';
import type { Node } from '@xyflow/react';

const results: Array<{name: string; status: string; error?: string}> = [];
let failed = false;
function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e: any) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

function makeNode(id: string, overrides: Partial<Node> = {}): Node {
  return { id, position: { x: 0, y: 0 }, data: {}, ...overrides } as Node;
}

// --- Empty nodes ---
test('empty nodes returns empty array', () => {
  const result = recalculateLayout([]);
  assert(result.length === 0, 'should be empty');
});

// --- No parent-child relationships (flat) ---
test('flat nodes are returned unchanged', () => {
  const nodes = [
    makeNode('a', { width: 100, height: 50 }),
    makeNode('b', { width: 200, height: 80 }),
  ];
  const result = recalculateLayout(nodes);
  assert(result.length === 2, '2 nodes');
  const a = result.find(n => n.id === 'a')!;
  assert(a.width === 100, 'a width unchanged');
  assert(a.height === 50, 'a height unchanged');
});

// --- Single parent with children ---
test('parent size calculated from children', () => {
  const nodes = [
    makeNode('parent', { width: 100, height: 50 }),
    makeNode('child1', { parentId: 'parent', position: { x: 12, y: 44 }, width: 150, height: 28 }),
    makeNode('child2', { parentId: 'parent', position: { x: 12, y: 80 }, width: 150, height: 28 }),
  ];
  const result = recalculateLayout(nodes);
  const parent = result.find(n => n.id === 'parent')!;
  // child2 bottom = 80 + 28 = 108
  // maxRight = 12 + 150 = 162
  // width = max(162 + PADDING_HORIZONTAL(12), QUERY_BOX_MIN_WIDTH(220)) = max(174, 220) = 220
  // height = max(108 + PADDING_BOTTOM(12), QUERY_BOX_MIN_HEIGHT(80)) = max(120, 80) = 120
  assert(parent.width === LAYOUT.QUERY_BOX_MIN_WIDTH, 'parent width: ' + parent.width);
  assert(parent.height === 120, 'parent height: ' + parent.height);
  // style should also be updated
  assert((parent.style as any)?.width === parent.width, 'style.width matches');
  assert((parent.style as any)?.height === parent.height, 'style.height matches');
});

// --- Nested: grandparent -> parent -> child (bottom-up) ---
test('nested nodes calculated bottom-up', () => {
  const nodes = [
    makeNode('grandparent', { width: 50, height: 50 }),
    makeNode('parent', { parentId: 'grandparent', position: { x: 12, y: 44 }, width: 50, height: 50 }),
    makeNode('child', { parentId: 'parent', position: { x: 12, y: 44 }, width: 100, height: 30 }),
  ];
  const result = recalculateLayout(nodes);

  // child is leaf, parent calculates from child:
  // child bottom = 44 + 30 = 74, maxRight = 12 + 100 = 112
  // parent width = max(112 + 12, 220) = 220
  // parent height = max(74 + 12, 80) = 86
  const parent = result.find(n => n.id === 'parent')!;
  assert(parent.width === 220, 'parent width: ' + parent.width);
  assert(parent.height === 86, 'parent height: ' + parent.height);

  // grandparent calculates from updated parent:
  // parent pos = (12, 44), parent size = (220, 86)
  // maxRight = 12 + 220 = 232, maxBottom = 44 + 86 = 130
  // gp width = max(232 + 12, 220) = 244
  // gp height = max(130 + 12, 80) = 142
  const gp = result.find(n => n.id === 'grandparent')!;
  assert(gp.width === 244, 'grandparent width: ' + gp.width);
  assert(gp.height === 142, 'grandparent height: ' + gp.height);
});

// --- Hidden children are excluded ---
test('hidden children do not affect parent size', () => {
  const nodes = [
    makeNode('parent', { width: 100, height: 50 }),
    makeNode('child1', { parentId: 'parent', hidden: true, position: { x: 12, y: 44 }, width: 500, height: 500 }),
  ];
  const result = recalculateLayout(nodes);
  const parent = result.find(n => n.id === 'parent')!;
  // All children hidden → min size
  assert(parent.width === LAYOUT.QUERY_BOX_MIN_WIDTH, 'min width');
  assert(parent.height === LAYOUT.QUERY_BOX_MIN_HEIGHT, 'min height');
});

// --- Parent with no children stays unchanged ---
test('parent not in childrenMap stays unchanged', () => {
  const nodes = [
    makeNode('standalone', { width: 300, height: 200 }),
  ];
  const result = recalculateLayout(nodes);
  assert(result[0].width === 300, 'unchanged width');
  assert(result[0].height === 200, 'unchanged height');
});

// --- Multiple siblings under same parent ---
test('multiple siblings: largest determines size', () => {
  const nodes = [
    makeNode('parent', {}),
    makeNode('c1', { parentId: 'parent', position: { x: 12, y: 44 }, width: 100, height: 28 }),
    makeNode('c2', { parentId: 'parent', position: { x: 12, y: 80 }, width: 300, height: 28 }),
    makeNode('c3', { parentId: 'parent', position: { x: 12, y: 116 }, width: 200, height: 28 }),
  ];
  const result = recalculateLayout(nodes);
  const parent = result.find(n => n.id === 'parent')!;
  // maxRight = max(112, 312, 212) = 312
  // maxBottom = max(72, 108, 144) = 144
  // width = max(312 + 12, 220) = 324
  // height = max(144 + 12, 80) = 156
  assert(parent.width === 324, 'width from widest child: ' + parent.width);
  assert(parent.height === 156, 'height from lowest child: ' + parent.height);
});

// --- Preserves other node properties ---
test('preserves node properties (id, position, data, type)', () => {
  const nodes = [
    makeNode('parent', { type: 'queryBox', data: { label: 'test' } }),
    makeNode('child', { parentId: 'parent', position: { x: 12, y: 44 }, width: 100, height: 30 }),
  ];
  const result = recalculateLayout(nodes);
  const parent = result.find(n => n.id === 'parent')!;
  assert(parent.id === 'parent', 'id preserved');
  assert(parent.type === 'queryBox', 'type preserved');
  assert((parent.data as any).label === 'test', 'data preserved');
});

// --- Child with measured only (no width/height) ---
test('child with measured size used for parent calculation', () => {
  const nodes = [
    makeNode('parent', {}),
    makeNode('child', { parentId: 'parent', position: { x: 12, y: 44 }, measured: { width: 180, height: 60 } }),
  ];
  // Remove width/height so measured is used
  delete (nodes[1] as any).width;
  delete (nodes[1] as any).height;
  const result = recalculateLayout(nodes);
  const parent = result.find(n => n.id === 'parent')!;
  // right = 12 + 180 = 192, width = max(192+12, 220) = 220
  // bottom = 44 + 60 = 104, height = max(104+12, 80) = 116
  assert(parent.width === 220, 'width from measured: ' + parent.width);
  assert(parent.height === 116, 'height from measured: ' + parent.height);
});

// --- Orphan node (parentId points to non-existent node) ---
test('orphan node with non-existent parentId does not crash', () => {
  const nodes = [
    makeNode('orphan', { parentId: 'nonexistent', position: { x: 10, y: 10 }, width: 100, height: 50 }),
    makeNode('normal', { width: 200, height: 100 }),
  ];
  const result = recalculateLayout(nodes);
  assert(result.length === 2, '2 nodes returned');
  // normal should be unchanged (no children)
  const normal = result.find(n => n.id === 'normal')!;
  assert(normal.width === 200, 'normal unchanged');
});

// --- Mixed hidden and visible children ---
test('mixed hidden and visible: only visible affects parent size', () => {
  const nodes = [
    makeNode('parent', {}),
    makeNode('c1', { parentId: 'parent', hidden: true, position: { x: 12, y: 44 }, width: 500, height: 500 }),
    makeNode('c2', { parentId: 'parent', hidden: false, position: { x: 12, y: 44 }, width: 100, height: 30 }),
  ];
  const result = recalculateLayout(nodes);
  const parent = result.find(n => n.id === 'parent')!;
  // Only c2 visible: right = 12+100=112, bottom = 44+30=74
  // width = max(112+12, 220) = 220
  // height = max(74+12, 80) = 86
  assert(parent.width === 220, 'width ignores hidden: ' + parent.width);
  assert(parent.height === 86, 'height from visible only: ' + parent.height);
});

// Output
console.log('\\n=== recalculateLayout Functional Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('functional tests pass (via tsx)', () => {
  const tmpFile = path.join(ROOT, 'tmp', 'recalcLayout-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const output = execSync('npx tsx tmp/recalcLayout-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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

try { fs.unlinkSync(path.join(ROOT, 'tmp', 'recalcLayout-test.ts')); } catch {}

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
