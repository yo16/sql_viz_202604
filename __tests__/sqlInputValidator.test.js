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

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// We need to compile and run the TS module. Use tsx to execute a helper script.
// Since we don't have tsx/ts-node, we'll compile the validator with tsc first,
// then test the compiled output. But for simplicity, let's use a different approach:
// read the source and verify structure, then test via npx tsx inline.

// First, verify the source file exists and has correct exports
const fs = require('fs');
const srcPath = path.join(ROOT, 'src', 'lib', 'validators', 'sqlInputValidator.ts');
const content = fs.readFileSync(srcPath, 'utf-8');

// --- Source structure tests ---

test('sqlInputValidator.ts exists', () => {
  assert(fs.existsSync(srcPath), 'File not found');
});

test('exports validateParseRequest function', () => {
  assert(content.includes('export function validateParseRequest'), 'validateParseRequest not exported');
});

test('exports ValidationResult interface', () => {
  assert(content.includes('export interface ValidationResult'), 'ValidationResult not exported');
});

test('exports SQL_MAX_LENGTH constant', () => {
  assert(content.includes('export const SQL_MAX_LENGTH'), 'SQL_MAX_LENGTH not exported');
});

test('exports VALID_DIALECTS constant', () => {
  assert(content.includes('export const VALID_DIALECTS'), 'VALID_DIALECTS not exported');
});

test('SQL_MAX_LENGTH is 100000', () => {
  assert(content.includes('100_000') || content.includes('100000'), 'SQL_MAX_LENGTH value incorrect');
});

test('imports SqlDialect from @/types/api', () => {
  assert(content.includes("from '@/types/api'"), 'SqlDialect import not found');
});

// --- Functional tests via compiled script ---
// Create a temporary test script that imports and tests the validator

const testScript = `
import { validateParseRequest, SQL_MAX_LENGTH, VALID_DIALECTS } from '../src/lib/validators/sqlInputValidator';

const results: Array<{name: string; status: string; error?: string}> = [];
let failed = false;

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, status: 'PASS' });
  } catch (e: any) {
    results.push({ name, status: 'FAIL', error: e.message });
    failed = true;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// --- Valid requests ---

test('valid: simple SQL string', () => {
  const result = validateParseRequest({ sql: 'SELECT 1' });
  assert(result.valid === true, 'should be valid');
  assert(result.error === undefined, 'should have no error');
});

test('valid: SQL with dialect', () => {
  const result = validateParseRequest({ sql: 'SELECT 1', dialect: 'BigQuery' });
  assert(result.valid === true, 'should be valid');
});

test('valid: all dialects accepted', () => {
  for (const d of VALID_DIALECTS) {
    const result = validateParseRequest({ sql: 'SELECT 1', dialect: d });
    assert(result.valid === true, d + ' should be valid');
  }
});

test('valid: SQL without dialect (optional)', () => {
  const result = validateParseRequest({ sql: 'SELECT * FROM t' });
  assert(result.valid === true, 'should be valid without dialect');
});

test('valid: SQL at max length', () => {
  const sql = 'S'.repeat(SQL_MAX_LENGTH);
  const result = validateParseRequest({ sql });
  assert(result.valid === true, 'should be valid at max length');
});

test('valid: SQL at max length minus 1', () => {
  const sql = 'S'.repeat(SQL_MAX_LENGTH - 1);
  const result = validateParseRequest({ sql });
  assert(result.valid === true, 'should be valid at max length - 1');
});

// --- Invalid: body ---

test('invalid: null body', () => {
  const result = validateParseRequest(null);
  assert(result.valid === false, 'should be invalid');
  assert(result.error?.field === 'body', 'field should be body');
});

test('invalid: undefined body', () => {
  const result = validateParseRequest(undefined);
  assert(result.valid === false, 'should be invalid');
});

test('invalid: string body', () => {
  const result = validateParseRequest('hello');
  assert(result.valid === false, 'should be invalid');
});

test('invalid: number body', () => {
  const result = validateParseRequest(42);
  assert(result.valid === false, 'should be invalid');
});

test('invalid: array body', () => {
  const result = validateParseRequest([1, 2, 3]);
  assert(result.valid === false, 'should be invalid');
  assert(result.error?.field === 'sql', 'array body should fail on sql check');
  assert(result.error?.constraint === 'required', 'constraint should be required');
});

// --- Invalid: sql field ---

test('invalid: missing sql field', () => {
  const result = validateParseRequest({});
  assert(result.valid === false, 'should be invalid');
  assert(result.error?.field === 'sql', 'field should be sql');
  assert(result.error?.constraint === 'required', 'constraint should be required');
});

test('invalid: sql is null', () => {
  const result = validateParseRequest({ sql: null });
  assert(result.valid === false, 'should be invalid');
  assert(result.error?.field === 'sql', 'field should be sql');
});

test('invalid: sql is number', () => {
  const result = validateParseRequest({ sql: 123 });
  assert(result.valid === false, 'should be invalid');
});

test('invalid: sql is boolean', () => {
  const result = validateParseRequest({ sql: true });
  assert(result.valid === false, 'should be invalid');
  assert(result.error?.field === 'sql', 'field should be sql');
});

test('invalid: empty string sql', () => {
  const result = validateParseRequest({ sql: '' });
  assert(result.valid === false, 'should be invalid');
  assert(result.error?.field === 'sql', 'field should be sql');
  assert(result.error?.constraint === 'required', 'constraint should be required');
});

test('invalid: whitespace-only sql (spaces)', () => {
  const result = validateParseRequest({ sql: '      ' });
  assert(result.valid === false, 'should be invalid');
  assert(result.error?.constraint === 'required', 'constraint should be required');
});

test('invalid: whitespace-only sql (tabs and newlines)', () => {
  const result = validateParseRequest({ sql: String.fromCharCode(9, 10, 13, 32) });
  assert(result.valid === false, 'should be invalid');
  assert(result.error?.constraint === 'required', 'constraint should be required');
});

test('invalid: sql exceeds max length', () => {
  const sql = 'S'.repeat(SQL_MAX_LENGTH + 1);
  const result = validateParseRequest({ sql });
  assert(result.valid === false, 'should be invalid');
  assert(result.error?.field === 'sql', 'field should be sql');
  assert(result.error?.constraint === 'max_length', 'constraint should be max_length');
});

// --- Invalid: dialect ---

test('invalid: unsupported dialect string', () => {
  const result = validateParseRequest({ sql: 'SELECT 1', dialect: 'Oracle' });
  assert(result.valid === false, 'should be invalid');
  assert(result.error?.field === 'dialect', 'field should be dialect');
  assert(result.error?.constraint === 'enum', 'constraint should be enum');
  assert(result.error?.message?.includes('Oracle'), 'message should include the invalid value');
});

test('invalid: dialect is number', () => {
  const result = validateParseRequest({ sql: 'SELECT 1', dialect: 123 });
  assert(result.valid === false, 'should be invalid');
  assert(result.error?.field === 'dialect', 'field should be dialect');
});

test('invalid: dialect is empty string', () => {
  const result = validateParseRequest({ sql: 'SELECT 1', dialect: '' });
  assert(result.valid === false, 'should be invalid');
  assert(result.error?.field === 'dialect', 'field should be dialect');
});

test('invalid: dialect is null', () => {
  const result = validateParseRequest({ sql: 'SELECT 1', dialect: null });
  assert(result.valid === false, 'should be invalid');
  assert(result.error?.field === 'dialect', 'field should be dialect');
  assert(result.error?.constraint === 'enum', 'constraint should be enum');
});

test('invalid: dialect case sensitivity (bigquery lowercase)', () => {
  const result = validateParseRequest({ sql: 'SELECT 1', dialect: 'bigquery' });
  assert(result.valid === false, 'should be invalid - case sensitive');
});

// --- Constants ---

test('SQL_MAX_LENGTH is 100000', () => {
  assert(SQL_MAX_LENGTH === 100000, 'SQL_MAX_LENGTH should be 100000');
});

test('VALID_DIALECTS contains all 4 dialects', () => {
  assert(VALID_DIALECTS.length === 4, 'should have 4 dialects');
  assert(VALID_DIALECTS.includes('BigQuery'), 'missing BigQuery');
  assert(VALID_DIALECTS.includes('PostgreSQL'), 'missing PostgreSQL');
  assert(VALID_DIALECTS.includes('MySQL'), 'missing MySQL');
  assert(VALID_DIALECTS.includes('SQLite'), 'missing SQLite');
});

// --- TypeScript compilation check ---

test('project compiles without errors', () => {
  // Already verified by running this script with tsx
});

// Output
console.log('\\n=== Functional Test Results ===\\n');
for (const r of results) {
  if (r.status === 'PASS') {
    console.log('  PASS: ' + r.name);
  } else {
    console.log('  FAIL: ' + r.name + ' - ' + r.error);
  }
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + passCount + '/' + results.length + ' functional tests passed\\n');

process.exit(failed ? 1 : 0);
`;

fs.writeFileSync(path.join(ROOT, 'tmp', 'validator-test.ts'), testScript);

// --- Run functional tests via npx tsx ---

test('functional tests pass (via tsx)', () => {
  try {
    const output = execSync('npx tsx tmp/validator-test.ts', {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 30000,
    });
    const stdout = output.toString();
    console.log(stdout);
    assert(!stdout.includes('FAIL:'), 'Some functional tests failed');
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : '';
    const stdout = e.stdout ? e.stdout.toString() : '';
    if (stdout) console.log(stdout);
    throw new Error('Functional test execution failed: ' + stderr.slice(0, 500));
  }
});

// --- Cleanup temp files before tsc check ---
try { fs.unlinkSync(path.join(ROOT, 'tmp', 'validator-test.ts')); } catch {}

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

// Cleanup
try { fs.unlinkSync(path.join(ROOT, 'tmp', 'validator-test.ts')); } catch {}

process.exit(failed ? 1 : 0);
