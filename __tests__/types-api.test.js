const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const results = [];
let failed = false;
let aborted = false;

function test(name, fn) {
  if (aborted) {
    results.push({ name, status: 'SKIP', error: 'skipped due to prior critical failure' });
    return;
  }
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

const filePath = path.join(ROOT, 'src', 'types', 'api.ts');

// --- File existence ---

test('src/types/api.ts exists', () => {
  if (!fs.existsSync(filePath)) {
    aborted = true;
    throw new Error('api.ts not found');
  }
});

const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';

// --- Required type/interface exports ---

const requiredExports = [
  { name: 'SqlDialect', kind: 'type' },
  { name: 'ParseRequest', kind: 'interface' },
  { name: 'ParseResponse', kind: 'interface' },
  { name: 'ParsedQuery', kind: 'interface' },
  { name: 'ParseError', kind: 'interface' },
  { name: 'SelectClause', kind: 'interface' },
  { name: 'SelectColumn', kind: 'interface' },
  { name: 'ColumnRef', kind: 'interface' },
  { name: 'FromClause', kind: 'interface' },
  { name: 'FromTable', kind: 'interface' },
  { name: 'JoinInfo', kind: 'interface' },
  { name: 'SubqueryInfo', kind: 'interface' },
  { name: 'WhereClause', kind: 'interface' },
  { name: 'GroupByClause', kind: 'interface' },
  { name: 'HavingClause', kind: 'interface' },
  { name: 'OrderByClause', kind: 'interface' },
  { name: 'CteDefinition', kind: 'interface' },
  { name: 'ApiValidationError', kind: 'interface' },
  { name: 'ApiInternalError', kind: 'interface' },
  { name: 'ApiError', kind: 'type' },
];

for (const { name, kind } of requiredExports) {
  test(`export ${kind} ${name} is defined`, () => {
    const pattern = kind === 'type'
      ? new RegExp(`export\\s+type\\s+${name}\\b`)
      : new RegExp(`export\\s+interface\\s+${name}\\b`);
    assert(pattern.test(content), `${kind} ${name} not found or not exported`);
  });
}

// --- Key field checks ---

test('ParseRequest has sql: string field', () => {
  assert(content.includes('sql: string'), 'ParseRequest.sql field not found');
});

test('ParseRequest has dialect?: SqlDialect field', () => {
  assert(content.includes('dialect?: SqlDialect'), 'ParseRequest.dialect field not found');
});

test('ParseResponse has queries: ParsedQuery[] field', () => {
  assert(content.includes('queries: ParsedQuery[]'), 'ParseResponse.queries field not found');
});

test('ParseResponse has errors: ParseError[] field', () => {
  assert(content.includes('errors: ParseError[]'), 'ParseResponse.errors field not found');
});

test('ParsedQuery has queryId: string field', () => {
  assert(content.includes('queryId: string'), 'ParsedQuery.queryId field not found');
});

test('ParsedQuery has queryType with select|ctas', () => {
  assert(
    content.includes("'select' | 'ctas'"),
    'ParsedQuery.queryType literals not found'
  );
});

test('ParsedQuery has nullable where field', () => {
  assert(content.includes('where: WhereClause | null'), 'ParsedQuery.where nullable field not found');
});

test('SelectColumn has exprType with all literal types', () => {
  assert(content.includes('column_ref'), 'exprType missing column_ref');
  assert(content.includes('star'), 'exprType missing star');
  assert(content.includes('table_star'), 'exprType missing table_star');
  assert(content.includes('expression'), 'exprType missing expression');
  assert(content.includes('aggr_func'), 'exprType missing aggr_func');
  assert(content.includes('literal'), 'exprType missing literal');
});

test('JoinInfo has joinType with all join kinds', () => {
  assert(content.includes("'INNER'"), 'joinType missing INNER');
  assert(content.includes("'LEFT'"), 'joinType missing LEFT');
  assert(content.includes("'RIGHT'"), 'joinType missing RIGHT');
  assert(content.includes("'FULL'"), 'joinType missing FULL');
  assert(content.includes("'CROSS'"), 'joinType missing CROSS');
});

test('SqlDialect includes BigQuery, PostgreSQL, MySQL, SQLite', () => {
  assert(content.includes("'BigQuery'"), 'SqlDialect missing BigQuery');
  assert(content.includes("'PostgreSQL'"), 'SqlDialect missing PostgreSQL');
  assert(content.includes("'MySQL'"), 'SqlDialect missing MySQL');
  assert(content.includes("'SQLite'"), 'SqlDialect missing SQLite');
});

test('ParseError has errorType with all error kinds', () => {
  assert(content.includes("'syntax_error'"), 'errorType missing syntax_error');
  assert(content.includes("'unsupported_syntax'"), 'errorType missing unsupported_syntax');
  assert(content.includes("'parse_error'"), 'errorType missing parse_error');
});

// --- TypeScript compilation check ---

test('api.ts compiles without errors (tsc --noEmit)', () => {
  try {
    execSync('npx tsc --noEmit src/types/api.ts --strict --esModuleInterop --moduleResolution bundler --module esnext --target ES2017 --skipLibCheck', {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 30000,
    });
  } catch (e) {
    throw new Error('TypeScript compilation failed: ' + (e.stderr ? e.stderr.toString().slice(0, 500) : e.message));
  }
});

// --- Output results ---
console.log('\n=== Test Results ===\n');
for (const r of results) {
  if (r.status === 'PASS') {
    console.log(`  PASS: ${r.name}`);
  } else if (r.status === 'SKIP') {
    console.log(`  SKIP: ${r.name}`);
  } else {
    console.log(`  FAIL: ${r.name} - ${r.error}`);
  }
}
const passCount = results.filter(r => r.status === 'PASS').length;
const skipCount = results.filter(r => r.status === 'SKIP').length;
console.log(`\n  ${passCount}/${results.length} tests passed` + (skipCount > 0 ? `, ${skipCount} skipped` : '') + '\n');

process.exit(failed ? 1 : 0);
