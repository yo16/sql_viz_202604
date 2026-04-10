/**
 * setState-during-render を防ぐため、state setter コールバック内で
 * Zustand set() や親コールバックを直接呼ばず queueMicrotask で遅延
 * していることを検証する。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const flowCanvas = fs.readFileSync(path.join(ROOT, 'src/components/visualizer/FlowCanvas.tsx'), 'utf-8');
const fileDropZone = fs.readFileSync(path.join(ROOT, 'src/components/input/FileDropZone.tsx'), 'utf-8');

const results = [];
let failed = false;
function test(name, fn) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

test('FlowCanvas: syncNodePosition inside setLocalNodes uses queueMicrotask', () => {
  // setLocalNodes コールバック内の syncNodePosition は queueMicrotask 経由でなければならない
  const setLocalNodesBlock = flowCanvas.match(/setLocalNodes\(\(nds\)[\s\S]*?return updated;\s*\}\)/);
  assert(setLocalNodesBlock, 'setLocalNodes callback block not found');
  const block = setLocalNodesBlock[0];
  if (block.includes('syncNodePosition')) {
    assert(block.includes('queueMicrotask'),
      'syncNodePosition inside setLocalNodes must use queueMicrotask');
  }
});

test('FileDropZone: onFilesLoaded inside setFiles uses queueMicrotask', () => {
  const setFilesBlock = fileDropZone.match(/setFiles\(\(prev\)[\s\S]*?return updated;\s*\}\)/);
  assert(setFilesBlock, 'setFiles callback block not found');
  const block = setFilesBlock[0];
  if (block.includes('onFilesLoaded')) {
    assert(block.includes('queueMicrotask'),
      'onFilesLoaded inside setFiles must use queueMicrotask');
  }
});

console.log('\n=== No setState During Render Tests ===\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\n  ' + pc + '/' + results.length + ' tests passed\n');
process.exit(failed ? 1 : 0);
