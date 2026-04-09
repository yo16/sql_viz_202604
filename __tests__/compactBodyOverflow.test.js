/**
 * QueryBox compact モードで列名が box 幅からはみ出ないことを CSS 構造的に検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-3bk
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const cssPath = path.join(ROOT, 'src', 'components', 'visualizer', 'nodes', 'QueryBoxNode.module.css');
const cssSrc = fs.readFileSync(cssPath, 'utf-8');

const results = [];
let failed = false;
function test(name, fn) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

function extractBlock(css, selector) {
  // Escape dot in selector for regex
  const esc = selector.replace(/\./g, '\\.');
  const re = new RegExp(esc + '\\s*\\{([^}]*)\\}');
  const m = css.match(re);
  return m ? m[1] : '';
}

const compactBody = extractBlock(cssSrc, '.compactBody');
const compactColumn = extractBlock(cssSrc, '.compactColumn');

test('.compactBody has width: 100%', () => {
  assert(/width:\s*100%/.test(compactBody),
    '.compactBody should have width: 100% to constrain children');
});

test('.compactBody has box-sizing: border-box', () => {
  assert(/box-sizing:\s*border-box/.test(compactBody),
    '.compactBody should have box-sizing: border-box');
});

test('.compactBody has overflow: hidden', () => {
  assert(/overflow:\s*hidden/.test(compactBody),
    '.compactBody should clip overflowing children');
});

test('.compactColumn keeps overflow: hidden + text-overflow: ellipsis + white-space: nowrap', () => {
  assert(/overflow:\s*hidden/.test(compactColumn),
    '.compactColumn should keep overflow: hidden');
  assert(/text-overflow:\s*ellipsis/.test(compactColumn),
    '.compactColumn should keep text-overflow: ellipsis');
  assert(/white-space:\s*nowrap/.test(compactColumn),
    '.compactColumn should keep white-space: nowrap');
});

test('.compactColumn has max-width: 100%', () => {
  assert(/max-width:\s*100%/.test(compactColumn),
    '.compactColumn should have max-width: 100%');
});

test('.compactColumn has min-width: 0', () => {
  assert(/min-width:\s*0/.test(compactColumn),
    '.compactColumn should have min-width: 0 to allow shrinking');
});

test('.container still has overflow: visible (for handles)', () => {
  const container = extractBlock(cssSrc, '.container');
  assert(/overflow:\s*visible/.test(container),
    '.container should keep overflow: visible so React Flow handles are not clipped');
});

console.log('\n=== CompactBody Overflow Tests ===\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\n  ' + pc + '/' + results.length + ' tests passed\n');
process.exit(failed ? 1 : 0);
