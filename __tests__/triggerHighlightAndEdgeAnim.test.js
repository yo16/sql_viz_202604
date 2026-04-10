/**
 * トリガー列の濃色強調＋ハイライトエッジのアニメーション破線を検証する。
 * 対応Beadsタスク: sql_viz_202604_2-d58
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const colItemTsx = fs.readFileSync(path.join(ROOT, 'src/components/visualizer/nodes/ColumnItemNode.tsx'), 'utf-8');
const colItemCss = fs.readFileSync(path.join(ROOT, 'src/components/visualizer/nodes/ColumnItemNode.module.css'), 'utf-8');
const unresBoxTsx = fs.readFileSync(path.join(ROOT, 'src/components/visualizer/nodes/UnresolvedBoxNode.tsx'), 'utf-8');
const unresBoxCss = fs.readFileSync(path.join(ROOT, 'src/components/visualizer/nodes/UnresolvedBoxNode.module.css'), 'utf-8');
const edgeCss = fs.readFileSync(path.join(ROOT, 'src/components/visualizer/edges/LineageEdge.module.css'), 'utf-8');

const results = [];
let failed = false;
function test(name, fn) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// --- Trigger column distinction ---
test('ColumnItemNode.tsx distinguishes trigger vs chain highlight', () => {
  assert(colItemTsx.includes('trigger') || colItemTsx.includes('Trigger'),
    'should have trigger-specific class logic');
});

test('ColumnItemNode CSS has trigger highlight style (darker)', () => {
  assert(/trigger/i.test(colItemCss),
    'CSS should have trigger highlight style');
});

test('UnresolvedBoxNode.tsx distinguishes trigger column', () => {
  assert(unresBoxTsx.includes('trigger') || unresBoxTsx.includes('Trigger'),
    'should have trigger class logic');
});

test('UnresolvedBoxNode CSS has trigger highlight style', () => {
  assert(/trigger/i.test(unresBoxCss),
    'CSS should have trigger highlight style');
});

// --- Edge animation ---
test('LineageEdge CSS has animated stroke for highlighted edges', () => {
  assert(/@keyframes/.test(edgeCss),
    'CSS should have @keyframes animation');
  assert(/stroke-dashoffset|dash/.test(edgeCss),
    'CSS should animate stroke-dashoffset or dash');
});

test('LineageEdge CSS animation applies only to highlighted state', () => {
  assert(/\.highlighted/.test(edgeCss),
    'animation should be scoped to .highlighted class');
});

console.log('\n=== Trigger Highlight & Edge Animation Tests ===\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\n  ' + pc + '/' + results.length + ' tests passed\n');
process.exit(failed ? 1 : 0);
