/**
 * UnresolvedBoxNode の推定カラムが highlightedColumns を参照し、
 * リネージュハイライト時にハイライトクラスが適用されることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-4et
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const tsxPath = path.join(ROOT, 'src', 'components', 'visualizer', 'nodes', 'UnresolvedBoxNode.tsx');
const cssPath = path.join(ROOT, 'src', 'components', 'visualizer', 'nodes', 'UnresolvedBoxNode.module.css');
const tsxSrc = fs.readFileSync(tsxPath, 'utf-8');
const cssSrc = fs.readFileSync(cssPath, 'utf-8');

const results = [];
let failed = false;
function test(name, fn) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

test('UnresolvedBoxNode.tsx references highlightedColumns from flowStore', () => {
  assert(tsxSrc.includes('highlightedColumns'),
    'should reference highlightedColumns');
});

test('UnresolvedBoxNode.tsx references useFlowStore', () => {
  assert(tsxSrc.includes('useFlowStore'),
    'should import/use useFlowStore');
});

test('UnresolvedBoxNode.tsx applies highlight class per column', () => {
  // Check that each inferred column div has conditional className logic
  assert(tsxSrc.includes('highlighted') || tsxSrc.includes('Highlighted'),
    'should have highlighted class logic for inferred columns');
});

test('CSS has highlighted style for inferred columns', () => {
  assert(/\.inferredColumn.*[Hh]ighlighted|\.highlighted/.test(cssSrc),
    'CSS should have highlight style for inferred columns');
});

test('CSS has dimmed style for inferred columns', () => {
  assert(/dimmed|\.inferredColumn.*[Dd]im/.test(cssSrc),
    'CSS should have dimmed style for inferred columns');
});

test('UnresolvedBoxNode.tsx references highlightPath for dim logic', () => {
  assert(tsxSrc.includes('highlightPath'),
    'should reference highlightPath to know when dim is active');
});

console.log('\n=== UnresolvedBox Column Highlight Tests ===\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\n  ' + pc + '/' + results.length + ' tests passed\n');
process.exit(failed ? 1 : 0);
