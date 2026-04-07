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

const tsxPath = path.join(ROOT, 'src', 'components', 'input', 'ErrorDisplay.tsx');
const cssPath = path.join(ROOT, 'src', 'components', 'input', 'ErrorDisplay.module.css');
const tsxContent = fs.readFileSync(tsxPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

// --- TSX structure ---
test('ErrorDisplay.tsx exists', () => { assert(fs.existsSync(tsxPath), 'not found'); });
test('has "use client" directive', () => { assert(tsxContent.includes('"use client"'), 'missing'); });
test('exports ErrorDisplay function', () => { assert(tsxContent.includes('export function ErrorDisplay'), 'not exported'); });
test('exports ErrorDisplayProps interface', () => { assert(tsxContent.includes('export interface ErrorDisplayProps'), 'no props interface'); });
test('imports ParseError type', () => { assert(tsxContent.includes('ParseError'), 'no ParseError import'); });
test('imports CSS Module', () => { assert(tsxContent.includes("from './ErrorDisplay.module.css'"), 'no css import'); });

// Props
test('props has generalError', () => { assert(tsxContent.includes('generalError'), 'no generalError'); });
test('props has parseErrors', () => { assert(tsxContent.includes('parseErrors'), 'no parseErrors'); });
test('props has onClear', () => { assert(tsxContent.includes('onClear'), 'no onClear'); });

// Rendering
test('returns null when no errors', () => { assert(tsxContent.includes('return null'), 'no early return'); });
test('renders generalError', () => { assert(tsxContent.includes('{generalError}'), 'no generalError render'); });
test('renders parseErrors list', () => { assert(tsxContent.includes('parseErrors.map'), 'no map'); });
test('renders error message', () => { assert(tsxContent.includes('err.message'), 'no message render'); });
test('renders raw SQL when expanded', () => { assert(tsxContent.includes('err.rawSql'), 'no rawSql render'); });

// Expand toggle
test('uses useState for expanded indices', () => {
  assert(tsxContent.includes('useState'), 'no useState');
  assert(tsxContent.includes('expandedIndices'), 'no expanded state');
});
test('has toggleExpand function', () => { assert(tsxContent.includes('toggleExpand'), 'no toggle'); });
test('uses Set for expanded tracking', () => { assert(tsxContent.includes('new Set'), 'no Set'); });

// Error type formatting
test('has formatErrorType helper', () => { assert(tsxContent.includes('formatErrorType'), 'no formatter'); });
test('handles syntax_error type', () => { assert(tsxContent.includes("'syntax_error'"), 'no syntax_error'); });
test('handles unsupported_syntax type', () => { assert(tsxContent.includes("'unsupported_syntax'"), 'no unsupported_syntax'); });
test('handles parse_error type', () => { assert(tsxContent.includes("'parse_error'"), 'no parse_error'); });

// Accessibility
test('has role="alert"', () => { assert(tsxContent.includes('role="alert"'), 'no alert role'); });
test('has aria-expanded', () => { assert(tsxContent.includes('aria-expanded'), 'no aria-expanded'); });
test('has aria-label on buttons', () => { assert(tsxContent.includes('aria-label'), 'no aria-label'); });

// Conditional rendering
test('clear button conditional on onClear', () => { assert(tsxContent.includes('onClear &&'), 'no conditional clear'); });
test('error count display', () => { assert(tsxContent.includes('parseErrors.length'), 'no count'); });

// No Tailwind
test('no Tailwind classes', () => { assert(!tsxContent.includes('className="'), 'possible Tailwind'); });

// --- CSS structure ---
test('ErrorDisplay.module.css exists', () => { assert(fs.existsSync(cssPath), 'not found'); });
test('CSS has .container class', () => { assert(cssContent.includes('.container'), 'no .container'); });
test('CSS has .header class', () => { assert(cssContent.includes('.header'), 'no .header'); });
test('CSS has .errorList class', () => { assert(cssContent.includes('.errorList'), 'no .errorList'); });
test('CSS has .errorItem class', () => { assert(cssContent.includes('.errorItem'), 'no .errorItem'); });
test('CSS has .errorType class', () => { assert(cssContent.includes('.errorType'), 'no .errorType'); });
test('CSS has .rawSql class', () => { assert(cssContent.includes('.rawSql'), 'no .rawSql'); });
test('CSS has type_unsupported_syntax variant', () => { assert(cssContent.includes('.type_unsupported_syntax'), 'no variant'); });
test('CSS has type_parse_error variant', () => { assert(cssContent.includes('.type_parse_error'), 'no variant'); });
test('CSS uses CSS Custom Properties', () => { assert(cssContent.includes('var(--'), 'no custom props'); });
test('CSS has hover/focus styles', () => {
  assert(cssContent.includes(':hover'), 'no hover');
  assert(cssContent.includes(':focus-visible'), 'no focus-visible');
});
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
console.log('\n=== ErrorDisplay Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
