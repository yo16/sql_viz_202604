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

const srcPath = path.join(ROOT, 'src', 'layout', 'calculateParentSize.ts');
const content = fs.readFileSync(srcPath, 'utf-8');

// --- Structure tests ---
test('calculateParentSize.ts exists', () => { assert(fs.existsSync(srcPath), 'not found'); });
test('exports calculateParentSize', () => { assert(content.includes('export function calculateParentSize'), 'not exported'); });
test('exports NodeSize interface', () => { assert(content.includes('export interface NodeSize'), 'not exported'); });
test('imports LAYOUT from layoutConstants', () => { assert(content.includes("from './layoutConstants'"), 'import not found'); });

// --- Functional tests ---
const FUNCTIONAL_TEST = `
import { calculateParentSize } from '../src/layout/calculateParentSize';
import { LAYOUT } from '../src/layout/layoutConstants';
import type { Node } from '@xyflow/react';

const results: Array<{name: string; status: string; error?: string}> = [];
let failed = false;
function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e: any) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

function makeNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'n1',
    position: { x: 0, y: 0 },
    data: {},
    ...overrides,
  } as Node;
}

// Empty children
test('empty children returns min size', () => {
  const size = calculateParentSize([]);
  assert(size.width === LAYOUT.QUERY_BOX_MIN_WIDTH, 'width: ' + size.width);
  assert(size.height === LAYOUT.QUERY_BOX_MIN_HEIGHT, 'height: ' + size.height);
});

// All hidden children
test('all hidden children returns min size', () => {
  const nodes = [
    makeNode({ id: 'n1', hidden: true, position: { x: 10, y: 10 }, width: 100, height: 50 }),
    makeNode({ id: 'n2', hidden: true, position: { x: 20, y: 20 }, width: 200, height: 100 }),
  ];
  const size = calculateParentSize(nodes);
  assert(size.width === LAYOUT.QUERY_BOX_MIN_WIDTH, 'width: ' + size.width);
  assert(size.height === LAYOUT.QUERY_BOX_MIN_HEIGHT, 'height: ' + size.height);
});

// Single child with explicit width/height
test('single child with explicit size', () => {
  const nodes = [
    makeNode({ id: 'n1', position: { x: 12, y: 44 }, width: 200, height: 100 }),
  ];
  const size = calculateParentSize(nodes);
  // right = 12 + 200 = 212, width = max(212 + 12, 220) = max(224, 220) = 224
  assert(size.width === 224, 'width: ' + size.width);
  // bottom = 44 + 100 = 144, height = max(144 + 12, 80) = max(156, 80) = 156
  assert(size.height === 156, 'height: ' + size.height);
});

// Multiple children - takes max right/bottom
test('multiple children takes max', () => {
  const nodes = [
    makeNode({ id: 'n1', position: { x: 12, y: 44 }, width: 100, height: 50 }),
    makeNode({ id: 'n2', position: { x: 12, y: 102 }, width: 150, height: 60 }),
  ];
  const size = calculateParentSize(nodes);
  // maxRight = max(12+100, 12+150) = 162, width = max(162+12, 220) = max(174, 220) = 220
  assert(size.width === LAYOUT.QUERY_BOX_MIN_WIDTH, 'width clamped to min: ' + size.width);
  // maxBottom = max(44+50, 102+60) = 162, height = max(162+12, 80) = 174
  assert(size.height === 174, 'height: ' + size.height);
});

// Mixed hidden and visible
test('mixed hidden and visible children', () => {
  const nodes = [
    makeNode({ id: 'n1', hidden: true, position: { x: 0, y: 0 }, width: 500, height: 500 }),
    makeNode({ id: 'n2', hidden: false, position: { x: 12, y: 44 }, width: 100, height: 50 }),
  ];
  const size = calculateParentSize(nodes);
  // Only n2 is visible: right = 12+100 = 112, width = max(112+12, 220) = 220
  assert(size.width === LAYOUT.QUERY_BOX_MIN_WIDTH, 'hidden node ignored: ' + size.width);
  // bottom = 44+50 = 94, height = max(94+12, 80) = 106
  assert(size.height === 106, 'height: ' + size.height);
});

// Child uses measured.width when width is undefined
test('child uses measured.width fallback', () => {
  const nodes = [
    makeNode({ id: 'n1', position: { x: 12, y: 44 }, measured: { width: 180, height: 70 } }),
  ];
  // Ensure width/height are undefined (not set)
  delete (nodes[0] as any).width;
  delete (nodes[0] as any).height;
  const size = calculateParentSize(nodes);
  // right = 12 + 180 = 192, width = max(192+12, 220) = 220
  assert(size.width === LAYOUT.QUERY_BOX_MIN_WIDTH, 'measured width used: ' + size.width);
  // bottom = 44 + 70 = 114, height = max(114+12, 80) = 126
  assert(size.height === 126, 'measured height used: ' + size.height);
});

// Child with no width and no measured → 0
test('child with no width and no measured uses 0', () => {
  const nodes = [
    makeNode({ id: 'n1', position: { x: 50, y: 60 } }),
  ];
  delete (nodes[0] as any).width;
  delete (nodes[0] as any).height;
  const size = calculateParentSize(nodes);
  // right = 50 + 0 = 50, width = max(50+12, 220) = 220
  assert(size.width === LAYOUT.QUERY_BOX_MIN_WIDTH, 'no size fallback: ' + size.width);
  // bottom = 60 + 0 = 60, height = max(60+12, 80) = 80
  assert(size.height === LAYOUT.QUERY_BOX_MIN_HEIGHT, 'height at min: ' + size.height);
});

// Large children exceed min size
test('large children exceed min size', () => {
  const nodes = [
    makeNode({ id: 'n1', position: { x: 12, y: 44 }, width: 400, height: 300 }),
  ];
  const size = calculateParentSize(nodes);
  // right = 12 + 400 = 412, width = max(412+12, 220) = 424
  assert(size.width === 424, 'width exceeds min: ' + size.width);
  // bottom = 44 + 300 = 344, height = max(344+12, 80) = 356
  assert(size.height === 356, 'height exceeds min: ' + size.height);
});

// Return type has width and height
test('return type has width and height', () => {
  const size = calculateParentSize([]);
  assert(typeof size.width === 'number', 'width is number');
  assert(typeof size.height === 'number', 'height is number');
});

// Output
console.log('\\n=== calculateParentSize Functional Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('functional tests pass (via tsx)', () => {
  const tmpFile = path.join(ROOT, 'tmp', 'calcParent-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const output = execSync('npx tsx tmp/calcParent-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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

try { fs.unlinkSync(path.join(ROOT, 'tmp', 'calcParent-test.ts')); } catch {}

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
