const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const results = [];
let failed = false;

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'PASS' });
  } catch (e) {
    results.push({ name, status: 'FAIL', error: e.message });
    failed = true;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const srcPath = path.join(ROOT, 'src', 'lib', 'parser', 'sqlParser.ts');
const content = fs.readFileSync(srcPath, 'utf-8');

// --- Source structure tests ---

test('sqlParser.ts exists', () => {
  assert(fs.existsSync(srcPath), 'File not found');
});

test('exports parseSql function', () => {
  assert(content.includes('export function parseSql'), 'parseSql not exported');
});

test('exports preprocessSql function', () => {
  assert(content.includes('export function preprocessSql'), 'preprocessSql not exported');
});

test('exports splitStatements function', () => {
  assert(content.includes('export function splitStatements'), 'splitStatements not exported');
});

test('exports classifyError function', () => {
  assert(content.includes('export function classifyError'), 'classifyError not exported');
});

test('exports toUserFriendlyMessage function', () => {
  assert(content.includes('export function toUserFriendlyMessage'), 'toUserFriendlyMessage not exported');
});

test('exports detectUnsupportedSyntax function', () => {
  assert(content.includes('export function detectUnsupportedSyntax'), 'detectUnsupportedSyntax not exported');
});

test('imports Parser from node-sql-parser', () => {
  assert(content.includes("from 'node-sql-parser'"), 'node-sql-parser import not found');
});

test('imports SqlDialect from @/types/api', () => {
  assert(content.includes("from '@/types/api'"), 'SqlDialect import not found');
});

test('UNSUPPORTED_PATTERNS includes MERGE and UNPIVOT', () => {
  assert(content.includes('MERGE'), 'MERGE pattern not found');
  assert(content.includes('UNPIVOT'), 'UNPIVOT pattern not found');
});

// --- Run functional tests via tsx ---

test('functional tests pass (via tsx)', () => {
  try {
    const output = execSync('npx tsx tmp/sqlParser-test.ts', {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 60000,
    });
    const stdout = output.toString();
    console.log(stdout);
    assert(!stdout.includes('FAIL:'), 'Some functional tests failed');
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : '';
    const stdout = e.stdout ? e.stdout.toString() : '';
    if (stdout) console.log(stdout);
    throw new Error('Functional test execution failed: ' + stderr.slice(0, 500) + (stdout.includes('FAIL:') ? '\n' + stdout : ''));
  }
});

// Cleanup temp test file before tsc check
try { fs.unlinkSync(path.join(ROOT, 'tmp', 'sqlParser-test.ts')); } catch {}

// --- tsc project compilation check ---

test('project compiles without errors (tsc --noEmit)', () => {
  try {
    execSync('npx tsc --noEmit', {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 60000,
    });
  } catch (e) {
    throw new Error('TypeScript compilation failed: ' + (e.stderr ? e.stderr.toString().slice(0, 500) : e.message));
  }
});

// --- Output results ---
console.log('\n=== Source Structure Test Results ===\n');
for (const r of results) {
  if (r.status === 'PASS') {
    console.log(`  PASS: ${r.name}`);
  } else {
    console.log(`  FAIL: ${r.name} - ${r.error}`);
  }
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);

process.exit(failed ? 1 : 0);
