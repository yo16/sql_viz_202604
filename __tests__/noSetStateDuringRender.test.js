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

test('FlowCanvas: setLocalNodes does NOT call syncNodePosition directly (no store writes during render)', () => {
  // setLocalNodes コールバック内で Zustand set() を呼ばないこと。
  // リサイズの同期は NodeResizeControl の onResizeEnd で行う。
  const setLocalNodesBlock = flowCanvas.match(/setLocalNodes\(\(nds\)[\s\S]*?\}\)/);
  if (setLocalNodesBlock) {
    const block = setLocalNodesBlock[0];
    assert(!block.includes('syncNodePosition') && !block.includes('syncNodeDimensions'),
      'setLocalNodes should NOT call sync* directly (causes setState-during-render)');
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
