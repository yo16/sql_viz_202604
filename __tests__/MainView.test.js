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

const tsxPath = path.join(ROOT, 'src', 'components', 'layout', 'MainView.tsx');
const cssPath = path.join(ROOT, 'src', 'components', 'layout', 'MainView.module.css');
const tsxContent = fs.readFileSync(tsxPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

// --- TSX structure ---
test('MainView.tsx exists', () => { assert(fs.existsSync(tsxPath), 'not found'); });
test('has "use client" directive', () => { assert(tsxContent.includes('"use client"'), 'missing'); });
test('exports MainView function', () => { assert(tsxContent.includes('export function MainView'), 'not exported'); });
test('imports CSS Module', () => { assert(tsxContent.includes("from './MainView.module.css'"), 'missing'); });

// Child components
test('imports Header', () => { assert(tsxContent.includes('import { Header }'), 'no Header import'); });
test('imports SqlInputPanel', () => { assert(tsxContent.includes('SqlInputPanel'), 'no SqlInputPanel'); });
test('imports FileDropZone', () => { assert(tsxContent.includes('FileDropZone'), 'no FileDropZone'); });
test('imports FlowCanvas', () => { assert(tsxContent.includes('FlowCanvas'), 'no FlowCanvas'); });
test('imports useLineageStore', () => { assert(tsxContent.includes('useLineageStore'), 'missing'); });
test('imports initStoreSubscriptions', () => { assert(tsxContent.includes('initStoreSubscriptions'), 'missing'); });

// Rendering
test('renders Header component', () => { assert(tsxContent.includes('<Header'), 'no Header render'); });
test('renders SqlInputPanel component', () => { assert(tsxContent.includes('<SqlInputPanel'), 'no SqlInputPanel render'); });
test('renders FileDropZone component', () => { assert(tsxContent.includes('<FileDropZone'), 'no FileDropZone render'); });
test('renders FlowCanvas component', () => { assert(tsxContent.includes('<FlowCanvas'), 'no FlowCanvas render'); });

// API integration
test('calls fetch with /api/parse', () => { assert(tsxContent.includes("'/api/parse'"), 'no API URL'); });
test('uses POST method', () => { assert(tsxContent.includes("'POST'") || tsxContent.includes('method: '), 'no POST method'); });
test('passes sql and dialect in body', () => {
  assert(tsxContent.includes('sql,'), 'no sql in body');
  assert(tsxContent.includes('dialect'), 'no dialect in body');
});

// Store integration
test('calls addQuery for parsed queries', () => { assert(tsxContent.includes('addQuery'), 'no addQuery call'); });
test('initializes store subscriptions on mount', () => {
  assert(tsxContent.includes('useEffect'), 'no useEffect');
  assert(tsxContent.includes('initStoreSubscriptions()'), 'no init call');
});
test('returns unsubscribe from useEffect', () => { assert(tsxContent.includes('return unsubscribe'), 'no unsubscribe'); });

// State
test('manages isLoading state', () => {
  assert(tsxContent.includes('useState'), 'no useState');
  assert(tsxContent.includes('isLoading'), 'no isLoading');
});
test('manages error state', () => { assert(tsxContent.includes('setError'), 'no error state'); });

// File handling
test('handles file contents in handleFilesLoaded', () => {
  assert(tsxContent.includes('handleFilesLoaded'), 'no handler');
  assert(tsxContent.includes('contents.map') || tsxContent.includes('combinedSql'), 'no file combine');
});

// Collapse feature
test('has isLeftPaneCollapsed state', () => { assert(tsxContent.includes('isLeftPaneCollapsed'), 'no collapse state'); });
test('has toggleLeftPane callback', () => { assert(tsxContent.includes('toggleLeftPane'), 'no toggle callback'); });
test('renders toggle button for left pane', () => { assert(tsxContent.includes('toggleButton'), 'no toggle button'); });
test('has aria-expanded on toggle button', () => { assert(tsxContent.includes('aria-expanded'), 'no aria-expanded'); });
test('has aria-label on toggle button', () => { assert(tsxContent.includes('aria-label'), 'no aria-label'); });

// Error display
test('renders error in role="alert"', () => { assert(tsxContent.includes('role="alert"'), 'no alert role'); });

// No Tailwind
test('no Tailwind classes', () => { assert(!tsxContent.includes('className="'), 'possible Tailwind'); });

// --- CSS structure ---
test('MainView.module.css exists', () => { assert(fs.existsSync(cssPath), 'not found'); });
test('CSS has .mainView class', () => { assert(cssContent.includes('.mainView'), 'no .mainView'); });
test('CSS has .body class', () => { assert(cssContent.includes('.body'), 'no .body'); });
test('CSS has .leftPane class', () => { assert(cssContent.includes('.leftPane'), 'no .leftPane'); });
test('CSS has .rightPane class', () => { assert(cssContent.includes('.rightPane'), 'no .rightPane'); });
test('CSS has .collapsed class', () => { assert(cssContent.includes('.collapsed'), 'no .collapsed'); });
test('CSS has .toggleButton class', () => { assert(cssContent.includes('.toggleButton'), 'no .toggleButton'); });
test('CSS has transition on leftPane', () => { assert(cssContent.includes('transition'), 'no transition'); });
test('CSS leftPane width is 350px', () => { assert(cssContent.includes('width: 350px'), 'no width'); });
test('CSS collapsed has width: 0', () => { assert(cssContent.includes('width: 0'), 'no collapsed width'); });
test('CSS has flex layout', () => { assert(cssContent.includes('display: flex'), 'no flex'); });
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
console.log('\n=== MainView Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
