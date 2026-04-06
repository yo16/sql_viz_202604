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

const tsxPath = path.join(ROOT, 'src', 'components', 'ui', 'DialectSelector.tsx');
const cssPath = path.join(ROOT, 'src', 'components', 'ui', 'DialectSelector.module.css');
const tsxContent = fs.readFileSync(tsxPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

// --- Structure tests: TSX ---
test('DialectSelector.tsx exists', () => { assert(fs.existsSync(tsxPath), 'not found'); });
test('has "use client" directive', () => { assert(tsxContent.includes('"use client"'), 'missing use client'); });
test('exports DialectSelector function', () => { assert(tsxContent.includes('export function DialectSelector'), 'not exported'); });
test('imports SqlDialect from @/types/api', () => { assert(tsxContent.includes("from '@/types/api'"), 'api import'); });
test('imports CSS Module', () => { assert(tsxContent.includes("from './DialectSelector.module.css'"), 'css import'); });
test('has DialectSelectorProps interface', () => { assert(tsxContent.includes('DialectSelectorProps'), 'no props interface'); });
test('has value prop of SqlDialect type', () => { assert(tsxContent.includes('value: SqlDialect'), 'no value prop'); });
test('has onChange prop', () => { assert(tsxContent.includes('onChange:'), 'no onChange prop'); });
test('renders select element', () => { assert(tsxContent.includes('<select'), 'no select element'); });
test('renders label element', () => { assert(tsxContent.includes('<label'), 'no label'); });
test('has htmlFor/id for accessibility', () => {
  assert(tsxContent.includes('htmlFor='), 'no htmlFor');
  assert(tsxContent.includes('id='), 'no id');
});

// Dialect options
test('includes BigQuery option (enabled)', () => {
  assert(tsxContent.includes("'BigQuery'"), 'no BigQuery');
  assert(tsxContent.includes('disabled: false'), 'no enabled option');
});
test('includes PostgreSQL option (disabled)', () => { assert(tsxContent.includes("'PostgreSQL'"), 'no PostgreSQL'); });
test('includes MySQL option (disabled)', () => { assert(tsxContent.includes("'MySQL'"), 'no MySQL'); });
test('includes SQLite option (disabled)', () => { assert(tsxContent.includes("'SQLite'"), 'no SQLite'); });
test('disabled options exist', () => { assert(tsxContent.includes('disabled: true'), 'no disabled'); });

// No Tailwind
test('no Tailwind classes in TSX', () => {
  assert(!tsxContent.includes('className="'), 'possible Tailwind class string');
});

// --- Structure tests: CSS ---
test('DialectSelector.module.css exists', () => { assert(fs.existsSync(cssPath), 'not found'); });
test('CSS has .container class', () => { assert(cssContent.includes('.container'), 'no .container'); });
test('CSS has .label class', () => { assert(cssContent.includes('.label'), 'no .label'); });
test('CSS has .select class', () => { assert(cssContent.includes('.select'), 'no .select'); });
test('CSS uses CSS Custom Properties', () => {
  assert(cssContent.includes('var(--'), 'no CSS Custom Properties');
});
test('CSS has no @tailwind or @apply', () => {
  assert(!cssContent.includes('@tailwind'), 'has @tailwind');
  assert(!cssContent.includes('@apply'), 'has @apply');
});
test('CSS has focus style', () => { assert(cssContent.includes(':focus'), 'no focus style'); });
test('CSS has disabled option style', () => { assert(cssContent.includes(':disabled') || cssContent.includes('option:disabled'), 'no disabled style'); });

// --- tsc compilation ---
test('project compiles (tsc --noEmit)', () => {
  try { execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe', timeout: 60000 }); }
  catch (e) { throw new Error('tsc failed: ' + (e.stderr ? e.stderr.toString().slice(0, 500) : e.message)); }
});

// --- Output ---
console.log('\n=== DialectSelector Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
