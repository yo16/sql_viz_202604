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

const tsxPath = path.join(ROOT, 'src', 'components', 'layout', 'Header.tsx');
const cssPath = path.join(ROOT, 'src', 'components', 'layout', 'Header.module.css');
const tsxContent = fs.readFileSync(tsxPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

// --- TSX structure ---
test('Header.tsx exists', () => { assert(fs.existsSync(tsxPath), 'not found'); });
test('has "use client" directive', () => { assert(tsxContent.includes('"use client"'), 'missing'); });
test('exports Header function', () => { assert(tsxContent.includes('export function Header'), 'not exported'); });
test('imports DialectSelector', () => { assert(tsxContent.includes('DialectSelector'), 'missing'); });
test('imports ResetButton', () => { assert(tsxContent.includes('ResetButton'), 'missing'); });
test('imports useLineageStore', () => { assert(tsxContent.includes('useLineageStore'), 'missing'); });
test('imports CSS Module', () => { assert(tsxContent.includes("from './Header.module.css'"), 'missing'); });
test('renders header element', () => { assert(tsxContent.includes('<header'), 'no header'); });
test('renders DialectSelector component', () => { assert(tsxContent.includes('<DialectSelector'), 'no DialectSelector'); });
test('renders ResetButton component', () => { assert(tsxContent.includes('<ResetButton'), 'no ResetButton'); });
test('passes dialect and onChange to DialectSelector', () => {
  assert(tsxContent.includes('value={dialect}'), 'no value prop');
  assert(tsxContent.includes('onChange={setDialect}'), 'no onChange prop');
});
test('gets dialect from lineageStore', () => { assert(tsxContent.includes('s.dialect'), 'no dialect selector'); });
test('gets setDialect from lineageStore', () => { assert(tsxContent.includes('s.setDialect'), 'no setDialect selector'); });
test('has title text', () => { assert(tsxContent.includes('SQL Visualizer'), 'no title'); });
test('no Tailwind classes', () => { assert(!tsxContent.includes('className="'), 'possible Tailwind'); });

// --- CSS structure ---
test('Header.module.css exists', () => { assert(fs.existsSync(cssPath), 'not found'); });
test('CSS has .header class', () => { assert(cssContent.includes('.header'), 'no .header'); });
test('CSS has .title class', () => { assert(cssContent.includes('.title'), 'no .title'); });
test('CSS has .actions class', () => { assert(cssContent.includes('.actions'), 'no .actions'); });
test('CSS uses CSS Custom Properties', () => { assert(cssContent.includes('var(--'), 'no custom props'); });
test('CSS uses flexbox layout', () => { assert(cssContent.includes('display: flex'), 'no flex'); });
test('CSS has border-bottom', () => { assert(cssContent.includes('border-bottom'), 'no border'); });
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
console.log('\n=== Header Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
