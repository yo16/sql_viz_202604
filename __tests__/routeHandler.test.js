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

const srcPath = path.join(ROOT, 'src', 'app', 'api', 'parse', 'route.ts');
const content = fs.readFileSync(srcPath, 'utf-8');

// --- Structure tests ---
test('route.ts exists', () => { assert(fs.existsSync(srcPath), 'not found'); });
test('exports POST function', () => { assert(content.includes('export async function POST'), 'POST not exported'); });
test('imports validateParseRequest', () => { assert(content.includes('validateParseRequest'), 'missing'); });
test('imports parseSql and splitStatements', () => { assert(content.includes('parseSql') && content.includes('splitStatements'), 'missing'); });
test('imports extractQueryStructure', () => { assert(content.includes('extractQueryStructure'), 'missing'); });
test('returns 400 for validation errors', () => { assert(content.includes('status: 400'), 'no 400'); });
test('returns 500 for internal errors', () => { assert(content.includes('status: 500'), 'no 500'); });
test('returns INTERNAL_ERROR', () => { assert(content.includes('INTERNAL_ERROR'), 'no INTERNAL_ERROR'); });
test('returns VALIDATION_ERROR', () => { assert(content.includes('VALIDATION_ERROR'), 'no VALIDATION_ERROR'); });

// --- Functional tests ---
const FUNCTIONAL_TEST = `
// Route Handler integration test using direct function import
import { POST } from '../src/app/api/parse/route';

const results: Array<{name: string; status: string; error?: string}> = [];
let failed = false;
function test(name: string, fn: () => Promise<void> | void) {
  const result = fn();
  if (result instanceof Promise) {
    return result.then(() => results.push({ name, status: 'PASS' }))
      .catch((e: any) => { results.push({ name, status: 'FAIL', error: e.message }); failed = true; });
  }
  results.push({ name, status: 'PASS' });
  return Promise.resolve();
}
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

function makeRequest(body: any): Request {
  return new Request('http://localhost/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeInvalidJsonRequest(): Request {
  return new Request('http://localhost/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not json',
  });
}

async function run() {

// =====================
// Success cases
// =====================

await test('simple SELECT returns 200 with queries', async () => {
  const req = makeRequest({ sql: 'SELECT a.id FROM users a' });
  const res = await POST(req as any);
  assert(res.status === 200, 'status 200, got ' + res.status);
  const data = await res.json();
  assert(Array.isArray(data.queries), 'has queries array');
  assert(data.queries.length === 1, '1 query');
  assert(data.queries[0].queryType === 'select', 'queryType select');
  assert(data.queries[0].queryId.length > 0, 'has queryId');
  assert(Array.isArray(data.errors), 'has errors array');
  assert(data.errors.length === 0, 'no errors');
});

await test('CTAS returns targetTable', async () => {
  const req = makeRequest({ sql: 'CREATE TABLE output AS SELECT a.id FROM users a' });
  const res = await POST(req as any);
  const data = await res.json();
  assert(data.queries[0].queryType === 'ctas', 'ctas');
  assert(data.queries[0].targetTable === 'output', 'targetTable');
});

await test('multiple statements parsed separately', async () => {
  const req = makeRequest({ sql: 'SELECT 1 FROM a; SELECT 2 FROM b' });
  const res = await POST(req as any);
  const data = await res.json();
  assert(data.queries.length === 2, '2 queries');
});

await test('dialect parameter accepted', async () => {
  const req = makeRequest({ sql: 'SELECT 1', dialect: 'MySQL' });
  const res = await POST(req as any);
  assert(res.status === 200, 'status 200');
});

await test('default dialect is BigQuery', async () => {
  const req = makeRequest({ sql: 'SELECT 1' });
  const res = await POST(req as any);
  assert(res.status === 200, 'status 200');
});

// =====================
// Partial success (some parse, some fail)
// =====================

await test('partial success: valid + invalid SQL', async () => {
  const req = makeRequest({ sql: 'SELECT 1 FROM t; MERGE INTO t USING s ON t.id = s.id' });
  const res = await POST(req as any);
  assert(res.status === 200, 'still 200');
  const data = await res.json();
  assert(data.queries.length === 1, '1 success');
  assert(data.errors.length === 1, '1 error');
  assert(data.errors[0].errorType === 'unsupported_syntax', 'unsupported');
});

// =====================
// Validation errors (400)
// =====================

await test('empty sql returns 400', async () => {
  const req = makeRequest({ sql: '' });
  const res = await POST(req as any);
  assert(res.status === 400, 'status 400');
  const data = await res.json();
  assert(data.error === 'VALIDATION_ERROR', 'VALIDATION_ERROR');
});

await test('missing sql field returns 400', async () => {
  const req = makeRequest({});
  const res = await POST(req as any);
  assert(res.status === 400, 'status 400');
});

await test('invalid dialect returns 400', async () => {
  const req = makeRequest({ sql: 'SELECT 1', dialect: 'Oracle' });
  const res = await POST(req as any);
  assert(res.status === 400, 'status 400');
  const data = await res.json();
  assert(data.error === 'VALIDATION_ERROR', 'VALIDATION_ERROR');
});

await test('invalid JSON returns 400', async () => {
  const req = makeInvalidJsonRequest();
  const res = await POST(req as any);
  assert(res.status === 400, 'status 400');
  const data = await res.json();
  assert(data.error === 'VALIDATION_ERROR', 'VALIDATION_ERROR');
});

await test('whitespace-only sql returns 400', async () => {
  const req = makeRequest({ sql: '   ' });
  const res = await POST(req as any);
  assert(res.status === 400, 'status 400');
});

// =====================
// Response structure
// =====================

await test('response has correct ParseResponse shape', async () => {
  const req = makeRequest({ sql: 'SELECT a.id, a.name FROM users a WHERE a.status = 1' });
  const res = await POST(req as any);
  const data = await res.json();
  const q = data.queries[0];
  assert(q.queryId, 'queryId');
  assert(q.rawSql, 'rawSql');
  assert(q.select && Array.isArray(q.select.columns), 'select.columns');
  assert(q.from && Array.isArray(q.from.tables), 'from.tables');
  assert(q.from && Array.isArray(q.from.joins), 'from.joins');
});

await test('SELECT columns have correct structure', async () => {
  const req = makeRequest({ sql: 'SELECT a.id, a.name FROM users a' });
  const res = await POST(req as any);
  const data = await res.json();
  const col = data.queries[0].select.columns[0];
  assert(col.displayName === 'id', 'displayName');
  assert(col.exprType === 'column_ref', 'exprType');
  assert(Array.isArray(col.columnRefs), 'columnRefs');
});

// Output
console.log('\\n=== Route Handler Functional Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
if (failed) process.exit(1);
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
`;

test('functional tests pass (via tsx)', () => {
  const tmpFile = path.join(ROOT, 'tmp', 'routeHandler-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const output = execSync('npx tsx tmp/routeHandler-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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

try { fs.unlinkSync(path.join(ROOT, 'tmp', 'routeHandler-test.ts')); } catch {}

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
