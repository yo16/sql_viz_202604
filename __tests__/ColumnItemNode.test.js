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

const tsxPath = path.join(ROOT, 'src', 'components', 'visualizer', 'nodes', 'ColumnItemNode.tsx');
const cssPath = path.join(ROOT, 'src', 'components', 'visualizer', 'nodes', 'ColumnItemNode.module.css');
const tsxContent = fs.readFileSync(tsxPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

// --- TSX structure ---
test('ColumnItemNode.tsx exists', () => { assert(fs.existsSync(tsxPath), 'not found'); });
test('has "use client" directive', () => { assert(tsxContent.includes('"use client"'), 'missing'); });
test('exports ColumnItemNode (memo)', () => { assert(tsxContent.includes('export const ColumnItemNode = memo'), 'not exported with memo'); });
test('imports Handle and Position from @xyflow/react', () => {
  assert(tsxContent.includes('Handle'), 'no Handle');
  assert(tsxContent.includes('Position'), 'no Position');
});
test('imports ColumnItemNodeData from @/types/flow', () => { assert(tsxContent.includes('ColumnItemNodeData'), 'missing'); });
test('imports useFlowStore', () => { assert(tsxContent.includes('useFlowStore'), 'missing'); });
test('imports CSS Module', () => { assert(tsxContent.includes("from './ColumnItemNode.module.css'"), 'missing'); });

// Certainty styles
test('has inferred style class', () => { assert(tsxContent.includes('styles.inferred'), 'no inferred class'); });
test('has propagated style class', () => { assert(tsxContent.includes('styles.propagated'), 'no propagated class'); });
test('has highlighted style class', () => { assert(tsxContent.includes('styles.highlighted'), 'no highlighted class'); });
test('shows star icon for propagated', () => { assert(tsxContent.includes('starIcon'), 'no starIcon'); });

// Handles
test('has target handle (left)', () => { assert(tsxContent.includes('type="target"') && tsxContent.includes('Position.Left'), 'no left target handle'); });
test('has source handle (right)', () => { assert(tsxContent.includes('type="source"') && tsxContent.includes('Position.Right'), 'no right source handle'); });

// Click/highlight
test('has onClick handler', () => { assert(tsxContent.includes('onClick={handleClick}'), 'no onClick'); });
test('uses highlightLineage from store', () => { assert(tsxContent.includes('highlightLineage'), 'no highlightLineage'); });
test('uses clearHighlight from store', () => { assert(tsxContent.includes('clearHighlight'), 'no clearHighlight'); });
test('implements toggle logic (re-click clears)', () => {
  assert(tsxContent.includes('highlightPath?.tableId'), 'no toggle check');
  assert(tsxContent.includes('clearHighlight()'), 'no clearHighlight call');
});

// Keyboard accessibility
test('has onKeyDown handler', () => { assert(tsxContent.includes('onKeyDown'), 'no onKeyDown'); });
test('has role="button" and tabIndex', () => {
  assert(tsxContent.includes('role="button"'), 'no role');
  assert(tsxContent.includes('tabIndex={0}'), 'no tabIndex');
});
test('handles Enter and Space keys', () => {
  assert(tsxContent.includes("'Enter'"), 'no Enter key');
  assert(tsxContent.includes("' '"), 'no Space key');
});

// Condition text
test('renders conditionText when present', () => { assert(tsxContent.includes('conditionText'), 'no conditionText'); });

// No Tailwind
test('no Tailwind classes', () => { assert(!tsxContent.includes('className="'), 'possible Tailwind'); });

// --- CSS structure ---
test('ColumnItemNode.module.css exists', () => { assert(fs.existsSync(cssPath), 'not found'); });
test('CSS has .container class', () => { assert(cssContent.includes('.container'), 'no .container'); });
test('CSS has .inferred class', () => { assert(cssContent.includes('.inferred'), 'no .inferred'); });
test('CSS has .highlighted class', () => { assert(cssContent.includes('.highlighted'), 'no .highlighted'); });
test('CSS has .handle class', () => { assert(cssContent.includes('.handle'), 'no .handle'); });
test('CSS has .name class', () => { assert(cssContent.includes('.name'), 'no .name'); });
test('CSS has .starIcon class', () => { assert(cssContent.includes('.starIcon'), 'no .starIcon'); });
test('CSS uses CSS Custom Properties', () => { assert(cssContent.includes('var(--'), 'no custom props'); });
test('CSS has hover style', () => { assert(cssContent.includes(':hover'), 'no hover'); });
test('CSS has no @tailwind or @apply', () => {
  assert(!cssContent.includes('@tailwind'), 'has @tailwind');
  assert(!cssContent.includes('@apply'), 'has @apply');
});

// --- tsc ---
test('project compiles (tsc --noEmit)', () => {
  try { execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe', timeout: 60000 }); }
  catch (e) { throw new Error('tsc failed: ' + (e.stderr ? e.stderr.toString().slice(0, 500) : e.message)); }
});

// --- Output ---
console.log('\n=== ColumnItemNode Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
