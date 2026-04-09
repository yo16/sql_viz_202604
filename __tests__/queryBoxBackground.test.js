/**
 * QueryBoxNode の container が親 wrapper 全体に拡張され、背景色が塗られることを
 * CSS 構造的に検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-kfq
 *
 * - .container に width: 100% / height: 100% が設定されている
 * - .container に子 clauseBox (#ffffff) と区別できる背景色が設定されている
 * - compact モードでも titleBar のみならず全体を囲む
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

// Parse .container block
function extractContainerBlock(css) {
  const match = css.match(/\.container\s*\{([^}]*)\}/);
  return match ? match[1] : '';
}
const containerBlock = extractContainerBlock(cssSrc);

test('.container has width: 100%', () => {
  assert(/width:\s*100%/.test(containerBlock),
    '.container should have width: 100% (to cover React Flow wrapper fully)');
});

test('.container has height: 100%', () => {
  assert(/height:\s*100%/.test(containerBlock),
    '.container should have height: 100%');
});

test('.container has box-sizing: border-box', () => {
  assert(/box-sizing:\s*border-box/.test(containerBlock),
    '.container should have box-sizing: border-box to include border in size');
});

test('.container has a background set', () => {
  assert(/background\s*:/.test(containerBlock), '.container must have background');
});

test('.container background is distinct from child clauseBox white (#ffffff / --color-bg-node)', () => {
  // Extract background value
  const bgMatch = containerBlock.match(/background\s*:\s*([^;]+);/);
  assert(bgMatch !== null, 'background declaration not found');
  const bg = bgMatch[1].trim();
  // Must not be pure white or --color-bg-node (both of which match clauseBox)
  assert(bg !== '#ffffff' && bg !== '#fff' && bg !== 'white',
    'container bg should not be pure white (same as clauseBox), got: ' + bg);
  assert(!/--color-bg-node/.test(bg),
    'container bg should not reference --color-bg-node (same as clauseBox), got: ' + bg);
});

console.log('\n=== QueryBox Background Tests ===\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\n  ' + pc + '/' + results.length + ' tests passed\n');
process.exit(failed ? 1 : 0);
