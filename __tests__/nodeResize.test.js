/**
 * QueryBoxNode / UnresolvedBoxNode にリサイズハンドルが追加されていること、
 * ClauseBoxNode / ColumnItemNode には追加されていないことを構造的に検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-eqv
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const qbTsx = fs.readFileSync(path.join(ROOT, 'src/components/visualizer/nodes/QueryBoxNode.tsx'), 'utf-8');
const ubTsx = fs.readFileSync(path.join(ROOT, 'src/components/visualizer/nodes/UnresolvedBoxNode.tsx'), 'utf-8');
const cbTsx = fs.readFileSync(path.join(ROOT, 'src/components/visualizer/nodes/ClauseBoxNode.tsx'), 'utf-8');
const ciTsx = fs.readFileSync(path.join(ROOT, 'src/components/visualizer/nodes/ColumnItemNode.tsx'), 'utf-8');
const qbCss = fs.readFileSync(path.join(ROOT, 'src/components/visualizer/nodes/QueryBoxNode.module.css'), 'utf-8');
const ubCss = fs.readFileSync(path.join(ROOT, 'src/components/visualizer/nodes/UnresolvedBoxNode.module.css'), 'utf-8');

const results = [];
let failed = false;
function test(name, fn) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// --- QueryBoxNode ---
test('QueryBoxNode imports NodeResizeControl', () => {
  assert(qbTsx.includes('NodeResizeControl'), 'should import NodeResizeControl');
});
test('QueryBoxNode renders NodeResizeControl', () => {
  assert(qbTsx.includes('<NodeResizeControl'), 'should render <NodeResizeControl');
});
test('QueryBoxNode CSS has resize handle style', () => {
  assert(/resize/i.test(qbCss), 'CSS should have resize-related style');
});

// --- UnresolvedBoxNode ---
test('UnresolvedBoxNode imports NodeResizeControl', () => {
  assert(ubTsx.includes('NodeResizeControl'), 'should import NodeResizeControl');
});
test('UnresolvedBoxNode renders NodeResizeControl', () => {
  assert(ubTsx.includes('<NodeResizeControl'), 'should render <NodeResizeControl');
});
test('UnresolvedBoxNode CSS has resize handle style', () => {
  assert(/resize/i.test(ubCss), 'CSS should have resize-related style');
});

// --- ClauseBoxNode / ColumnItemNode: リサイズなし ---
test('ClauseBoxNode does NOT have NodeResizeControl', () => {
  assert(!cbTsx.includes('NodeResizeControl'), 'should NOT have NodeResizeControl');
});
test('ColumnItemNode does NOT have NodeResizeControl', () => {
  assert(!ciTsx.includes('NodeResizeControl'), 'should NOT have NodeResizeControl');
});

console.log('\n=== Node Resize Tests ===\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\n  ' + pc + '/' + results.length + ' tests passed\n');
process.exit(failed ? 1 : 0);
