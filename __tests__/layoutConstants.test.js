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

const srcPath = path.join(ROOT, 'src', 'layout', 'layoutConstants.ts');
const content = fs.readFileSync(srcPath, 'utf-8');

// --- Structure tests ---
test('layoutConstants.ts exists', () => { assert(fs.existsSync(srcPath), 'not found'); });
test('exports LAYOUT const', () => { assert(content.includes('export const LAYOUT'), 'not exported'); });
test('uses as const', () => { assert(content.includes('as const'), 'not immutable'); });

// --- Functional tests ---
const FUNCTIONAL_TEST = `
import { LAYOUT } from '../src/layout/layoutConstants';

const results: Array<{name: string; status: string; error?: string}> = [];
let failed = false;
function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e: any) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

// Each constant value verified inside test() blocks

test('PADDING_TOP === 44', () => { assert(LAYOUT.PADDING_TOP === 44, 'got ' + LAYOUT.PADDING_TOP); });
test('PADDING_HORIZONTAL === 12', () => { assert(LAYOUT.PADDING_HORIZONTAL === 12, 'got ' + LAYOUT.PADDING_HORIZONTAL); });
test('PADDING_BOTTOM === 12', () => { assert(LAYOUT.PADDING_BOTTOM === 12, 'got ' + LAYOUT.PADDING_BOTTOM); });
test('CHILD_GAP_VERTICAL === 8', () => { assert(LAYOUT.CHILD_GAP_VERTICAL === 8, 'got ' + LAYOUT.CHILD_GAP_VERTICAL); });
test('CHILD_GAP_HORIZONTAL === 16', () => { assert(LAYOUT.CHILD_GAP_HORIZONTAL === 16, 'got ' + LAYOUT.CHILD_GAP_HORIZONTAL); });
test('COMPACT_NODE_WIDTH === 200', () => { assert(LAYOUT.COMPACT_NODE_WIDTH === 200, 'got ' + LAYOUT.COMPACT_NODE_WIDTH); });
test('COMPACT_BASE_HEIGHT === 44', () => { assert(LAYOUT.COMPACT_BASE_HEIGHT === 44, 'got ' + LAYOUT.COMPACT_BASE_HEIGHT); });
test('COMPACT_COLUMN_ROW_HEIGHT === 22', () => { assert(LAYOUT.COMPACT_COLUMN_ROW_HEIGHT === 22, 'got ' + LAYOUT.COMPACT_COLUMN_ROW_HEIGHT); });
test('COMPACT_MAX_COLUMNS === 10', () => { assert(LAYOUT.COMPACT_MAX_COLUMNS === 10, 'got ' + LAYOUT.COMPACT_MAX_COLUMNS); });
test('COLUMN_ITEM_HEIGHT === 28', () => { assert(LAYOUT.COLUMN_ITEM_HEIGHT === 28, 'got ' + LAYOUT.COLUMN_ITEM_HEIGHT); });
test('COLUMN_ITEM_MIN_WIDTH === 150', () => { assert(LAYOUT.COLUMN_ITEM_MIN_WIDTH === 150, 'got ' + LAYOUT.COLUMN_ITEM_MIN_WIDTH); });
test('CLAUSE_HEADER_HEIGHT === 28', () => { assert(LAYOUT.CLAUSE_HEADER_HEIGHT === 28, 'got ' + LAYOUT.CLAUSE_HEADER_HEIGHT); });
test('QUERY_BOX_MIN_WIDTH === 220', () => { assert(LAYOUT.QUERY_BOX_MIN_WIDTH === 220, 'got ' + LAYOUT.QUERY_BOX_MIN_WIDTH); });
test('QUERY_BOX_MIN_HEIGHT === 80', () => { assert(LAYOUT.QUERY_BOX_MIN_HEIGHT === 80, 'got ' + LAYOUT.QUERY_BOX_MIN_HEIGHT); });
test('UNRESOLVED_BOX_MIN_WIDTH === 180', () => { assert(LAYOUT.UNRESOLVED_BOX_MIN_WIDTH === 180, 'got ' + LAYOUT.UNRESOLVED_BOX_MIN_WIDTH); });
test('TABLE_GAP_HORIZONTAL === 80', () => { assert(LAYOUT.TABLE_GAP_HORIZONTAL === 80, 'got ' + LAYOUT.TABLE_GAP_HORIZONTAL); });
test('TABLE_GAP_VERTICAL === 40', () => { assert(LAYOUT.TABLE_GAP_VERTICAL === 40, 'got ' + LAYOUT.TABLE_GAP_VERTICAL); });
test('CTE_GAP_HORIZONTAL === 40', () => { assert(LAYOUT.CTE_GAP_HORIZONTAL === 40, 'got ' + LAYOUT.CTE_GAP_HORIZONTAL); });
test('MAX_NEST_DEPTH === 5', () => { assert(LAYOUT.MAX_NEST_DEPTH === 5, 'got ' + LAYOUT.MAX_NEST_DEPTH); });

test('all values are numbers', () => {
  for (const [key, value] of Object.entries(LAYOUT)) {
    assert(typeof value === 'number', key + ' is not a number');
  }
});

test('all values are positive', () => {
  for (const [key, value] of Object.entries(LAYOUT)) {
    assert((value as number) > 0, key + ' is not positive: ' + value);
  }
});

test('LAYOUT has exactly 19 properties', () => {
  const count = Object.keys(LAYOUT).length;
  assert(count === 19, 'expected 19, got ' + count);
});

// Output
console.log('\\n=== layoutConstants Functional Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('functional tests pass (via tsx)', () => {
  const tmpFile = path.join(ROOT, 'tmp', 'layoutConst-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const output = execSync('npx tsx tmp/layoutConst-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    const stdout = output.toString();
    console.log(stdout);
    assert(!stdout.includes('FAIL:'), 'Some functional tests failed');
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : '';
    const stdout = e.stdout ? e.stdout.toString() : '';
    if (stdout) console.log(stdout);
    throw new Error('Failed: ' + stderr.slice(0, 500));
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
});

try { fs.unlinkSync(path.join(ROOT, 'tmp', 'layoutConst-test.ts')); } catch {}

test('project compiles (tsc --noEmit)', () => {
  try { execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe', timeout: 60000 }); }
  catch (e) { throw new Error('tsc failed: ' + (e.stderr ? e.stderr.toString().slice(0, 500) : e.message)); }
});

// Output
console.log('\n=== Structure Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
