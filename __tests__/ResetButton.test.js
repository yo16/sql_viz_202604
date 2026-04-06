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

const tsxPath = path.join(ROOT, 'src', 'components', 'ui', 'ResetButton.tsx');
const cssPath = path.join(ROOT, 'src', 'components', 'ui', 'ResetButton.module.css');
const tsxContent = fs.readFileSync(tsxPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

// --- Structure tests: TSX ---
test('ResetButton.tsx exists', () => { assert(fs.existsSync(tsxPath), 'not found'); });
test('has "use client" directive', () => { assert(tsxContent.includes('"use client"'), 'missing'); });
test('exports ResetButton function', () => { assert(tsxContent.includes('export function ResetButton'), 'not exported'); });
test('imports useLineageStore', () => { assert(tsxContent.includes('useLineageStore'), 'missing'); });
test('imports CSS Module', () => { assert(tsxContent.includes("from './ResetButton.module.css'"), 'css import'); });
test('calls resetAll', () => { assert(tsxContent.includes('resetAll'), 'no resetAll call'); });
test('uses window.confirm for confirmation', () => { assert(tsxContent.includes('window.confirm') || tsxContent.includes('confirm('), 'no confirm dialog'); });
test('renders button element', () => { assert(tsxContent.includes('<button'), 'no button'); });
test('has type="button"', () => { assert(tsxContent.includes('type="button"'), 'no type=button'); });
test('has aria-label for accessibility', () => { assert(tsxContent.includes('aria-label'), 'no aria-label'); });
test('no Tailwind classes', () => { assert(!tsxContent.includes('className="'), 'possible Tailwind'); });

// --- Structure tests: CSS ---
test('ResetButton.module.css exists', () => { assert(fs.existsSync(cssPath), 'not found'); });
test('CSS has .button class', () => { assert(cssContent.includes('.button'), 'no .button'); });
test('CSS uses CSS Custom Properties', () => { assert(cssContent.includes('var(--'), 'no custom props'); });
test('CSS has hover style', () => { assert(cssContent.includes(':hover'), 'no hover'); });
test('CSS has focus style', () => { assert(cssContent.includes(':focus') || cssContent.includes(':focus-visible'), 'no focus'); });
test('CSS has no @tailwind or @apply', () => {
  assert(!cssContent.includes('@tailwind'), 'has @tailwind');
  assert(!cssContent.includes('@apply'), 'has @apply');
});

// --- tsc compilation ---
test('project compiles (tsc --noEmit)', () => {
  try { execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe', timeout: 60000 }); }
  catch (e) { throw new Error('tsc failed: ' + (e.stderr ? e.stderr.toString().slice(0, 500) : e.message)); }
});

// --- Output ---
console.log('\n=== ResetButton Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
