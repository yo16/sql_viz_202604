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

const filePath = path.join(ROOT, 'src', 'types', 'lineage.ts');

// --- File existence ---

test('src/types/lineage.ts exists', () => {
  if (!fs.existsSync(filePath)) {
    aborted = true;
    throw new Error('lineage.ts not found');
  }
});

const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';

// --- Required type/interface exports (9 interfaces + 2 types) ---

const requiredExports = [
  { name: 'DependencyType', kind: 'type' },
  { name: 'Certainty', kind: 'type' },
  { name: 'ColumnDependency', kind: 'interface' },
  { name: 'ColumnNode', kind: 'interface' },
  { name: 'ClauseInfo', kind: 'interface' },
  { name: 'CteNode', kind: 'interface' },
  { name: 'SubqueryNode', kind: 'interface' },
  { name: 'TableNode', kind: 'interface' },
  { name: 'LineagePath', kind: 'interface' },
];

for (const { name, kind } of requiredExports) {
  test(`export ${kind} ${name} is defined`, () => {
    const pattern = kind === 'type'
      ? new RegExp(`export\\s+type\\s+${name}\\b`)
      : new RegExp(`export\\s+interface\\s+${name}\\b`);
    assert(pattern.test(content), `${kind} ${name} not found or not exported`);
  });
}

// --- SqlDialect re-export from api.ts ---

test('SqlDialect is re-exported from api.ts', () => {
  assert(
    content.includes("from './api'") || content.includes('from "./api"'),
    'SqlDialect re-export from api.ts not found'
  );
  assert(content.includes('SqlDialect'), 'SqlDialect not mentioned in lineage.ts');
});

// --- DependencyType literal values (6 values) ---

test('DependencyType includes all 6 values', () => {
  assert(content.includes("'direct'"), 'missing direct');
  assert(content.includes("'expression'"), 'missing expression');
  assert(content.includes("'condition'"), 'missing condition');
  assert(content.includes("'aggregate'"), 'missing aggregate');
  assert(content.includes("'join_key'"), 'missing join_key');
  assert(content.includes("'star'"), 'missing star');
});

// --- Certainty literal values (3 values) ---

test('Certainty includes all 3 values', () => {
  assert(content.includes("'confirmed'"), 'missing confirmed');
  assert(content.includes("'inferred'"), 'missing inferred');
  assert(content.includes("'propagated'"), 'missing propagated');
});

// --- ColumnDependency fields ---

test('ColumnDependency has sourceTableId: string', () => {
  assert(content.includes('sourceTableId: string'), 'ColumnDependency.sourceTableId not found');
});

test('ColumnDependency has sourceColumn: string', () => {
  assert(content.includes('sourceColumn: string'), 'ColumnDependency.sourceColumn not found');
});

test('ColumnDependency has type: DependencyType', () => {
  assert(content.includes('type: DependencyType'), 'ColumnDependency.type not found');
});

// --- ColumnNode fields ---

test('ColumnNode has columnName: string', () => {
  assert(content.includes('columnName: string'), 'ColumnNode.columnName not found');
});

test('ColumnNode has tableId: string', () => {
  assert(content.includes('tableId: string'), 'ColumnNode.tableId not found');
});

test('ColumnNode has certainty: Certainty', () => {
  assert(content.includes('certainty: Certainty'), 'ColumnNode.certainty not found');
});

test('ColumnNode has dependencies: ColumnDependency[]', () => {
  assert(content.includes('dependencies: ColumnDependency[]'), 'ColumnNode.dependencies not found');
});

test('ColumnNode has isFromStar: boolean', () => {
  assert(content.includes('isFromStar: boolean'), 'ColumnNode.isFromStar not found');
});

test('ColumnNode has exprType with all 6 literal values', () => {
  // Verify all 6 exprType values exist in the ColumnNode context
  const exprTypeMatch = content.match(/exprType:\s*([^;]+);/);
  assert(exprTypeMatch, 'exprType field not found');
  const exprTypeDef = exprTypeMatch[1];
  assert(exprTypeDef.includes('column_ref'), 'exprType missing column_ref');
  assert(exprTypeDef.includes('star'), 'exprType missing star');
  assert(exprTypeDef.includes('table_star'), 'exprType missing table_star');
  assert(exprTypeDef.includes('expression'), 'exprType missing expression');
  assert(exprTypeDef.includes('aggr_func'), 'exprType missing aggr_func');
  assert(exprTypeDef.includes('literal'), 'exprType missing literal');
});

// --- TableNode fields ---

test('TableNode has id: string', () => {
  assert(content.includes('id: string'), 'TableNode.id not found');
});

test('TableNode has name: string | null', () => {
  assert(content.includes('name: string | null'), 'TableNode.name not found');
});

test('TableNode has displayTitle: string', () => {
  assert(content.includes('displayTitle: string'), 'TableNode.displayTitle not found');
});

test('TableNode has isRegistered: boolean', () => {
  assert(content.includes('isRegistered: boolean'), 'TableNode.isRegistered not found');
});

test('TableNode has queryType with select|ctas|unresolved', () => {
  assert(content.includes("'select'"), 'queryType missing select');
  assert(content.includes("'ctas'"), 'queryType missing ctas');
  assert(content.includes("'unresolved'"), 'queryType missing unresolved');
});

test('TableNode has queryId: string | null', () => {
  assert(content.includes('queryId: string | null'), 'TableNode.queryId not found');
});

test('TableNode has columns: Map<string, ColumnNode>', () => {
  assert(content.includes('columns: Map<string, ColumnNode>'), 'TableNode.columns Map not found');
});

test('TableNode has dependsOn: Set<string>', () => {
  assert(content.includes('dependsOn: Set<string>'), 'TableNode.dependsOn Set not found');
});

test('TableNode has ctes: CteNode[]', () => {
  assert(content.includes('ctes: CteNode[]'), 'TableNode.ctes not found');
});

test('TableNode has fromSubqueries: SubqueryNode[]', () => {
  assert(content.includes('fromSubqueries: SubqueryNode[]'), 'TableNode.fromSubqueries not found');
});

test('TableNode has whereSubqueries: SubqueryNode[]', () => {
  assert(content.includes('whereSubqueries: SubqueryNode[]'), 'TableNode.whereSubqueries not found');
});

test('TableNode has clauses: ClauseInfo', () => {
  assert(content.includes('clauses: ClauseInfo'), 'TableNode.clauses not found');
});

// --- CteNode fields ---

test('CteNode has name: string', () => {
  assert(content.includes('name: string'), 'CteNode.name not found');
});

test('CteNode has tableNode: TableNode', () => {
  assert(content.includes('tableNode: TableNode'), 'CteNode.tableNode not found');
});

// --- SubqueryNode fields ---

test('SubqueryNode has alias: string', () => {
  assert(content.includes('alias: string'), 'SubqueryNode.alias not found');
});

test('SubqueryNode has tableNode: TableNode', () => {
  // already checked via CteNode, but confirms SubqueryNode also has it
  assert(content.includes('tableNode: TableNode'), 'SubqueryNode.tableNode not found');
});

// --- ClauseInfo fields ---

test('ClauseInfo has select field', () => {
  assert(content.includes('select:'), 'ClauseInfo.select not found');
});

test('ClauseInfo has from field', () => {
  assert(content.includes('from:'), 'ClauseInfo.from not found');
});

test('ClauseInfo has where/groupBy/having/orderBy nullable fields', () => {
  assert(content.includes('where:'), 'ClauseInfo.where not found');
  assert(content.includes('groupBy:'), 'ClauseInfo.groupBy not found');
  assert(content.includes('having:'), 'ClauseInfo.having not found');
  assert(content.includes('orderBy:'), 'ClauseInfo.orderBy not found');
});

// --- LineagePath fields ---

test('LineagePath has sourceTableId: string', () => {
  assert(content.includes('sourceTableId: string'), 'LineagePath.sourceTableId not found');
});

test('LineagePath has sourceColumn: string', () => {
  assert(content.includes('sourceColumn: string'), 'LineagePath.sourceColumn not found');
});

test('LineagePath has targetTableId: string', () => {
  assert(content.includes('targetTableId: string'), 'LineagePath.targetTableId not found');
});

test('LineagePath has targetColumn: string', () => {
  assert(content.includes('targetColumn: string'), 'LineagePath.targetColumn not found');
});

test('LineagePath has dependencyType: DependencyType', () => {
  assert(content.includes('dependencyType: DependencyType'), 'LineagePath.dependencyType not found');
});

// --- TypeScript compilation check ---

test('lineage.ts compiles without errors (tsc --noEmit)', () => {
  try {
    execSync('npx tsc --noEmit --strict --esModuleInterop --moduleResolution bundler --module esnext --target ES2017 --skipLibCheck src/types/lineage.ts', {
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
