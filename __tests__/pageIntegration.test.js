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

const pagePath = path.join(ROOT, 'src', 'app', 'page.tsx');
const layoutPath = path.join(ROOT, 'src', 'app', 'layout.tsx');
const oldCssPath = path.join(ROOT, 'src', 'app', 'page.module.css');
const globalsPath = path.join(ROOT, 'src', 'app', 'globals.css');

const pageContent = fs.readFileSync(pagePath, 'utf-8');
const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
const globalsContent = fs.readFileSync(globalsPath, 'utf-8');

// --- page.tsx ---
test('page.tsx exists', () => { assert(fs.existsSync(pagePath), 'not found'); });
test('page.tsx has default export', () => {
  assert(pageContent.includes('export default function'), 'no default export');
});
test('page.tsx imports MainView', () => {
  assert(pageContent.includes('MainView'), 'no MainView import');
  assert(pageContent.includes("from '@/components/layout/MainView'"), 'wrong import path');
});
test('page.tsx renders <MainView />', () => { assert(pageContent.includes('<MainView'), 'no MainView render'); });
test('page.tsx is Server Component (no "use client" directive)', () => {
  // Check that first non-empty non-comment line is not "use client"
  const lines = pageContent.split('\n').map(l => l.trim());
  const firstCodeLine = lines.find(l => l.length > 0 && !l.startsWith('//') && !l.startsWith('/*') && !l.startsWith('*'));
  assert(firstCodeLine !== '"use client";' && firstCodeLine !== "'use client';", 'first line should not be use client directive');
});
test('page.tsx does not import removed page.module.css', () => {
  assert(!pageContent.includes('page.module.css'), 'still imports page.module.css');
});

// --- page.module.css should be deleted ---
test('page.module.css is removed', () => {
  assert(!fs.existsSync(oldCssPath), 'page.module.css should be deleted');
});

// --- layout.tsx ---
test('layout.tsx exists', () => { assert(fs.existsSync(layoutPath), 'not found'); });
test('layout.tsx has metadata export', () => { assert(layoutContent.includes('export const metadata'), 'no metadata'); });
test('layout.tsx has RootLayout default export', () => {
  assert(layoutContent.includes('export default function RootLayout'), 'no RootLayout');
});
test('layout.tsx imports globals.css', () => {
  assert(
    layoutContent.includes("'./globals.css'") || layoutContent.includes('"./globals.css"'),
    'no globals import'
  );
});
test('layout.tsx renders html and body', () => {
  assert(layoutContent.includes('<html'), 'no html');
  assert(layoutContent.includes('<body'), 'no body');
});
test('layout.tsx has lang attribute', () => { assert(layoutContent.includes('lang='), 'no lang'); });
test('layout.tsx has title in metadata', () => { assert(layoutContent.includes('title:'), 'no title'); });
test('layout.tsx is Server Component (no "use client" directive)', () => {
  const lines = layoutContent.split('\n').map(l => l.trim());
  const firstCodeLine = lines.find(l => l.length > 0 && !l.startsWith('//') && !l.startsWith('/*') && !l.startsWith('*'));
  assert(firstCodeLine !== '"use client";' && firstCodeLine !== "'use client';", 'first line should not be use client directive');
});

// --- globals.css ---
test('globals.css imports variables.css', () => {
  assert(globalsContent.includes("'../styles/variables.css'"), 'no variables import');
});

// --- tsc ---
test('project compiles (tsc --noEmit)', () => {
  try { execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe', timeout: 60000 }); }
  catch (e) { throw new Error('tsc failed: ' + (e.stderr ? e.stderr.toString().slice(0, 500) : e.message)); }
});

// --- Next.js build ---
test('Next.js build succeeds', () => {
  try {
    const output = execSync('npx next build', { cwd: ROOT, stdio: 'pipe', timeout: 180000 });
    const stdout = output.toString();
    assert(stdout.includes('Compiled successfully'), 'build did not compile');
  } catch (e) {
    throw new Error('Next.js build failed: ' + (e.stderr ? e.stderr.toString().slice(0, 500) : e.message));
  }
});

// --- Output ---
console.log('\n=== Page Integration Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
