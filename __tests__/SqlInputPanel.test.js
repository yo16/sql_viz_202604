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

const tsxPath = path.join(ROOT, 'src', 'components', 'input', 'SqlInputPanel.tsx');
const cssPath = path.join(ROOT, 'src', 'components', 'input', 'SqlInputPanel.module.css');
const tsxContent = fs.readFileSync(tsxPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

// --- TSX structure ---
test('SqlInputPanel.tsx exists', () => { assert(fs.existsSync(tsxPath), 'not found'); });
test('has "use client" directive', () => { assert(tsxContent.includes('"use client"'), 'missing'); });
test('exports SqlInputPanel function', () => { assert(tsxContent.includes('export function SqlInputPanel'), 'not exported'); });
test('exports SqlInputPanelProps interface', () => { assert(tsxContent.includes('export interface SqlInputPanelProps'), 'no props interface'); });
test('imports CSS Module', () => { assert(tsxContent.includes("from './SqlInputPanel.module.css'"), 'missing'); });

// Props
test('props has onSubmit', () => { assert(tsxContent.includes('onSubmit:'), 'no onSubmit'); });
test('props has isLoading', () => { assert(tsxContent.includes('isLoading:'), 'no isLoading'); });

// Core UI
test('renders textarea', () => { assert(tsxContent.includes('<textarea'), 'no textarea'); });
test('textarea has label association', () => {
  assert(tsxContent.includes('htmlFor='), 'no htmlFor');
  assert(tsxContent.includes('id='), 'no id');
});
test('renders submit button', () => { assert(tsxContent.includes('パース実行'), 'no submit text'); });
test('renders loading state', () => { assert(tsxContent.includes('実行中'), 'no loading text'); });

// Submit behavior
test('calls onSubmit from handleSubmit', () => { assert(tsxContent.includes('onSubmit(sql)'), 'no onSubmit call'); });
test('validates empty/whitespace sql', () => { assert(tsxContent.includes('trim()'), 'no trim check'); });
test('disables submit when loading or empty', () => {
  assert(tsxContent.includes('isLoading'), 'no isLoading check');
  assert(tsxContent.includes('isSubmitDisabled'), 'no disabled flag');
});

// Keyboard shortcut
test('has onKeyDown handler for Ctrl+Enter', () => { assert(tsxContent.includes('onKeyDown'), 'no onKeyDown'); });
test('handles Ctrl/Cmd + Enter', () => {
  assert(tsxContent.includes('ctrlKey'), 'no ctrlKey');
  assert(tsxContent.includes('metaKey'), 'no metaKey');
  assert(tsxContent.includes("'Enter'"), 'no Enter key');
});

// Clear button
test('has clear button (conditional)', () => { assert(tsxContent.includes('クリア'), 'no clear button'); });
test('clear button resets sql state', () => { assert(tsxContent.includes('setSql'), 'no setSql'); });

// useState
test('uses useState for sql', () => { assert(tsxContent.includes('useState'), 'no useState'); });

// useCallback
test('uses useCallback for handlers', () => { assert(tsxContent.includes('useCallback'), 'no useCallback'); });

// Accessibility
test('has aria-label on buttons', () => { assert(tsxContent.includes('aria-label'), 'no aria-label'); });

// No Tailwind
test('no Tailwind classes', () => { assert(!tsxContent.includes('className="'), 'possible Tailwind'); });

// --- CSS structure ---
test('SqlInputPanel.module.css exists', () => { assert(fs.existsSync(cssPath), 'not found'); });
test('CSS has .container class', () => { assert(cssContent.includes('.container'), 'no .container'); });
test('CSS has .textarea class', () => { assert(cssContent.includes('.textarea'), 'no .textarea'); });
test('CSS has .submitButton class', () => { assert(cssContent.includes('.submitButton'), 'no .submitButton'); });
test('CSS has .clearButton class', () => { assert(cssContent.includes('.clearButton'), 'no .clearButton'); });
test('CSS has .header class', () => { assert(cssContent.includes('.header'), 'no .header'); });
test('CSS has .footer class', () => { assert(cssContent.includes('.footer'), 'no .footer'); });
test('CSS uses CSS Custom Properties', () => { assert(cssContent.includes('var(--'), 'no custom props'); });
test('CSS has disabled styles', () => { assert(cssContent.includes(':disabled'), 'no disabled style'); });
test('CSS has focus-visible for submitButton', () => { assert(cssContent.includes(':focus-visible'), 'no focus-visible'); });
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
console.log('\n=== SqlInputPanel Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
