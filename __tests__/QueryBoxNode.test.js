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

const tsxPath = path.join(ROOT, 'src', 'components', 'visualizer', 'nodes', 'QueryBoxNode.tsx');
const cssPath = path.join(ROOT, 'src', 'components', 'visualizer', 'nodes', 'QueryBoxNode.module.css');
const tsxContent = fs.readFileSync(tsxPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

// --- TSX structure ---
test('QueryBoxNode.tsx exists', () => { assert(fs.existsSync(tsxPath), 'not found'); });
test('has "use client" directive', () => { assert(tsxContent.includes('"use client"'), 'missing'); });
test('exports QueryBoxNode (memo)', () => { assert(tsxContent.includes('export const QueryBoxNode = memo'), 'not exported'); });
test('imports Handle and Position', () => {
  assert(tsxContent.includes('Handle'), 'no Handle');
  assert(tsxContent.includes('Position'), 'no Position');
});
test('imports QueryBoxNodeData', () => { assert(tsxContent.includes('QueryBoxNodeData'), 'missing'); });
test('imports useFlowStore', () => { assert(tsxContent.includes('useFlowStore'), 'missing'); });
test('imports CSS Module', () => { assert(tsxContent.includes("from './QueryBoxNode.module.css'"), 'missing'); });

// Title and badge
test('renders title', () => { assert(tsxContent.includes('{title}'), 'no title'); });
test('renders CTAS/SELECT badge', () => {
  assert(tsxContent.includes("'CTAS'"), 'no CTAS');
  assert(tsxContent.includes("'SELECT'"), 'no SELECT');
});
test('renders toggle icon (compact/detail)', () => {
  assert(tsxContent.includes('▸') || tsxContent.includes('▸'), 'no compact icon');
  assert(tsxContent.includes('▾') || tsxContent.includes('▾'), 'no detail icon');
});

// Toggle
test('calls toggleDisplayMode on click', () => {
  assert(tsxContent.includes('toggleDisplayMode'), 'no toggleDisplayMode');
  assert(tsxContent.includes('onClick={handleToggle}'), 'no onClick');
});

// Compact mode
test('renders compactColumns in compact mode', () => {
  assert(tsxContent.includes('compactColumns'), 'no compactColumns');
  assert(tsxContent.includes('compactBody') || tsxContent.includes('styles.compactBody'), 'no compactBody');
});
test('limits compact columns to 10', () => {
  assert(tsxContent.includes('.slice(0, 10)') || tsxContent.includes('slice(0, 10)'), 'no 10 limit');
});
test('shows "+N more" for excess columns', () => {
  assert(tsxContent.includes('more'), 'no more indicator');
});

// Handles at container level (not inside titleBar)
test('Handles are at container level (not inside titleBar)', () => {
  // Handle should appear before and after titleBar in the JSX
  const containerStart = tsxContent.indexOf('className={styles.container}');
  const titleBarStart = tsxContent.indexOf('className={styles.titleBar}');
  const firstHandle = tsxContent.indexOf('<Handle', containerStart);
  // First Handle should be between container and titleBar
  assert(firstHandle < titleBarStart, 'Handle should be before titleBar');
});
test('has target handle (left)', () => {
  assert(tsxContent.includes('type="target"') && tsxContent.includes('Position.Left'), 'no left handle');
});
test('has source handle (right)', () => {
  assert(tsxContent.includes('type="source"') && tsxContent.includes('Position.Right'), 'no right handle');
});

// Keyboard accessibility
test('has onKeyDown handler', () => { assert(tsxContent.includes('onKeyDown'), 'no onKeyDown'); });
test('has role="button" and tabIndex', () => {
  assert(tsxContent.includes('role="button"'), 'no role');
  assert(tsxContent.includes('tabIndex={0}'), 'no tabIndex');
});
test('handles Enter and Space keys', () => {
  assert(tsxContent.includes("'Enter'"), 'no Enter');
  assert(tsxContent.includes("' '"), 'no Space');
});

// No Tailwind
test('no Tailwind classes', () => { assert(!tsxContent.includes('className="'), 'possible Tailwind'); });

// --- CSS structure ---
test('QueryBoxNode.module.css exists', () => { assert(fs.existsSync(cssPath), 'not found'); });
test('CSS has .container with position: relative', () => {
  assert(cssContent.includes('.container'), 'no .container');
  assert(cssContent.includes('position: relative'), 'no position relative');
});
test('CSS has .titleBar class', () => { assert(cssContent.includes('.titleBar'), 'no .titleBar'); });
test('CSS has .title class', () => { assert(cssContent.includes('.title'), 'no .title'); });
test('CSS has .badge class', () => { assert(cssContent.includes('.badge'), 'no .badge'); });
test('CSS has .handle class', () => { assert(cssContent.includes('.handle'), 'no .handle'); });
test('CSS has .compactBody class', () => { assert(cssContent.includes('.compactBody'), 'no .compactBody'); });
test('CSS has focus-visible style', () => { assert(cssContent.includes(':focus-visible'), 'no focus-visible'); });
test('CSS has hover style', () => { assert(cssContent.includes(':hover'), 'no hover'); });
test('CSS uses CSS Custom Properties', () => { assert(cssContent.includes('var(--'), 'no custom props'); });
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
console.log('\n=== QueryBoxNode Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
