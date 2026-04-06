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

const srcPath = path.join(ROOT, 'src', 'layout', 'tableFlowLayout.ts');
const content = fs.readFileSync(srcPath, 'utf-8');

// --- Structure tests ---
test('tableFlowLayout.ts exists', () => { assert(fs.existsSync(srcPath), 'not found'); });
test('exports arrangeTableNodes', () => { assert(content.includes('export function arrangeTableNodes'), 'not exported'); });
test('exports topologicalLayers', () => { assert(content.includes('export function topologicalLayers'), 'not exported'); });
test('imports LAYOUT', () => { assert(content.includes("from './layoutConstants'"), 'import not found'); });

// --- Functional tests ---
const FUNCTIONAL_TEST = `
import { arrangeTableNodes, topologicalLayers } from '../src/layout/tableFlowLayout';
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

// =====================
// topologicalLayers
// =====================

test('topologicalLayers: linear A->B->C', () => {
  const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
  const deps = [{ source: 'A', target: 'B' }, { source: 'B', target: 'C' }];
  const layers = topologicalLayers(nodes, deps);
  assert(layers.length === 3, '3 layers: ' + layers.length);
  assert(layers[0][0].id === 'A', 'layer 0: A');
  assert(layers[1][0].id === 'B', 'layer 1: B');
  assert(layers[2][0].id === 'C', 'layer 2: C');
});

test('topologicalLayers: parallel sources', () => {
  const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
  const deps = [{ source: 'A', target: 'C' }, { source: 'B', target: 'C' }];
  const layers = topologicalLayers(nodes, deps);
  assert(layers.length === 2, '2 layers');
  assert(layers[0].length === 2, 'layer 0 has 2 nodes');
  assert(layers[1].length === 1, 'layer 1 has 1 node');
  assert(layers[1][0].id === 'C', 'C in layer 1');
});

test('topologicalLayers: no dependencies', () => {
  const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
  const layers = topologicalLayers(nodes, []);
  assert(layers.length === 1, '1 layer (all independent)');
  assert(layers[0].length === 3, 'all 3 in layer 0');
});

test('topologicalLayers: single node', () => {
  const layers = topologicalLayers([makeNode('A')], []);
  assert(layers.length === 1, '1 layer');
  assert(layers[0][0].id === 'A', 'A');
});

test('topologicalLayers: empty nodes', () => {
  const layers = topologicalLayers([], []);
  assert(layers.length === 0, 'empty');
});

test('topologicalLayers: circular dependency goes to last layer', () => {
  const nodes = [makeNode('A'), makeNode('B')];
  const deps = [{ source: 'A', target: 'B' }, { source: 'B', target: 'A' }];
  const layers = topologicalLayers(nodes, deps);
  // Both have inDegree > 0, so both go to remaining layer
  assert(layers.length >= 1, 'at least 1 layer');
  const allIds = layers.flat().map(n => n.id);
  assert(allIds.includes('A') && allIds.includes('B'), 'both present');
});

test('topologicalLayers: deps referencing non-existent nodes ignored', () => {
  const nodes = [makeNode('A'), makeNode('B')];
  const deps = [{ source: 'A', target: 'B' }, { source: 'X', target: 'A' }];
  const layers = topologicalLayers(nodes, deps);
  // X is not in nodes, so A has inDegree 0, B has inDegree 1
  assert(layers[0].some(n => n.id === 'A'), 'A in layer 0');
  assert(layers[1].some(n => n.id === 'B'), 'B in layer 1');
});

// =====================
// arrangeTableNodes
// =====================

test('arrangeTableNodes: empty returns empty', () => {
  const result = arrangeTableNodes([], []);
  assert(result.length === 0, 'empty');
});

test('arrangeTableNodes: single node at origin', () => {
  const nodes = [makeNode('A', { width: 220, height: 80 })];
  const result = arrangeTableNodes(nodes, []);
  assert(result[0].position.x === 0, 'x=0');
  assert(result[0].position.y === 0, 'y=0');
});

test('arrangeTableNodes: linear chain positions left to right', () => {
  const nodes = [makeNode('A', { width: 200, height: 80 }), makeNode('B', { width: 200, height: 80 }), makeNode('C', { width: 200, height: 80 })];
  const deps = [{ source: 'A', target: 'B' }, { source: 'B', target: 'C' }];
  const result = arrangeTableNodes(nodes, deps);
  const a = result.find(n => n.id === 'A')!;
  const b = result.find(n => n.id === 'B')!;
  const c = result.find(n => n.id === 'C')!;
  assert(a.position.x === 0, 'A x=0');
  assert(b.position.x === 200 + LAYOUT.TABLE_GAP_HORIZONTAL, 'B x');
  assert(c.position.x === 2 * (200 + LAYOUT.TABLE_GAP_HORIZONTAL), 'C x');
  assert(a.position.y === 0, 'all y=0 in single-node layers');
  assert(b.position.y === 0, 'B y=0');
  assert(c.position.y === 0, 'C y=0');
});

test('arrangeTableNodes: parallel nodes stacked vertically', () => {
  const nodes = [makeNode('A', { width: 220, height: 80 }), makeNode('B', { width: 220, height: 100 }), makeNode('C', { width: 220, height: 80 })];
  const deps = [{ source: 'A', target: 'C' }, { source: 'B', target: 'C' }];
  const result = arrangeTableNodes(nodes, deps);
  const a = result.find(n => n.id === 'A')!;
  const b = result.find(n => n.id === 'B')!;
  const c = result.find(n => n.id === 'C')!;
  // A and B in layer 0, stacked vertically
  assert(a.position.x === 0 || b.position.x === 0, 'layer 0 at x=0');
  assert(a.position.x === b.position.x, 'same layer same x');
  // One should be at y=0, next at y = height + gap
  const firstHeight = a.position.y === 0 ? (a as any).height ?? LAYOUT.QUERY_BOX_MIN_HEIGHT : (b as any).height ?? LAYOUT.QUERY_BOX_MIN_HEIGHT;
  const secondY = a.position.y === 0 ? b.position.y : a.position.y;
  assert(secondY === firstHeight + LAYOUT.TABLE_GAP_VERTICAL, 'vertical stacking: ' + secondY);
  // C in layer 1
  assert(c.position.x > 0, 'C in layer 1 (x > 0)');
});

test('arrangeTableNodes: uses LAYOUT defaults for missing width/height', () => {
  const nodes = [makeNode('A'), makeNode('B')];
  delete (nodes[0] as any).width;
  delete (nodes[0] as any).height;
  const deps = [{ source: 'A', target: 'B' }];
  const result = arrangeTableNodes(nodes, deps);
  const b = result.find(n => n.id === 'B')!;
  // A uses default width/height, so B.x = QUERY_BOX_MIN_WIDTH + TABLE_GAP_HORIZONTAL
  assert(b.position.x === LAYOUT.QUERY_BOX_MIN_WIDTH + LAYOUT.TABLE_GAP_HORIZONTAL, 'default width used');
});

test('arrangeTableNodes: preserves node properties', () => {
  const nodes = [makeNode('A', { type: 'queryBox', data: { label: 'test' }, width: 200, height: 80 })];
  const result = arrangeTableNodes(nodes, []);
  assert(result[0].type === 'queryBox', 'type preserved');
  assert((result[0].data as any).label === 'test', 'data preserved');
});

// Output
console.log('\\n=== tableFlowLayout Functional Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('functional tests pass (via tsx)', () => {
  const tmpFile = path.join(ROOT, 'tmp', 'tableFlow-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const output = execSync('npx tsx tmp/tableFlow-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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

try { fs.unlinkSync(path.join(ROOT, 'tmp', 'tableFlow-test.ts')); } catch {}

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
