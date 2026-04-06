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

const filePath = path.join(ROOT, 'src', 'types', 'flow.ts');

// --- File existence ---

test('src/types/flow.ts exists', () => {
  if (!fs.existsSync(filePath)) {
    aborted = true;
    throw new Error('flow.ts not found');
  }
});

const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';

// --- Required exports ---

const requiredInterfaces = [
  'QueryBoxNodeData',
  'ClauseBoxNodeData',
  'ColumnItemNodeData',
  'UnresolvedBoxNodeData',
  'FlowState',
  'FlowActions',
];

const requiredTypes = [
  'DisplayMode',
  'FlowNodeData',
  'FlowNode',
  'FlowEdge',
  'FlowStore',
];

for (const name of requiredInterfaces) {
  test(`export interface ${name} is defined`, () => {
    const pattern = new RegExp(`export\\s+interface\\s+${name}\\b`);
    assert(pattern.test(content), `interface ${name} not found or not exported`);
  });
}

for (const name of requiredTypes) {
  test(`export type ${name} is defined`, () => {
    const pattern = new RegExp(`export\\s+type\\s+${name}\\b`);
    assert(pattern.test(content), `type ${name} not found or not exported`);
  });
}

// --- Imports ---

test('imports Node, Edge from @xyflow/react', () => {
  assert(content.includes('@xyflow/react'), 'import from @xyflow/react not found');
  assert(content.includes('Node'), 'Node import not found');
  assert(content.includes('Edge'), 'Edge import not found');
});

test('imports TableNode and Certainty from lineage', () => {
  assert(content.includes('TableNode'), 'TableNode import not found');
  assert(content.includes('Certainty'), 'Certainty import not found');
  assert(
    content.includes("from './lineage'") || content.includes('from "./lineage"'),
    'import from lineage not found'
  );
});

test('imports SelectColumn from api', () => {
  assert(content.includes('SelectColumn'), 'SelectColumn import not found');
  assert(
    content.includes("from './api'") || content.includes('from "./api"'),
    'import from api not found'
  );
});

// --- QueryBoxNodeData fields ---

test('QueryBoxNodeData has tableName: string', () => {
  assert(content.includes('tableName: string'), 'QueryBoxNodeData.tableName not found');
});

test('QueryBoxNodeData has title: string', () => {
  assert(content.includes('title: string'), 'QueryBoxNodeData.title not found');
});

test('QueryBoxNodeData has queryType with select|ctas', () => {
  assert(content.includes("'select'"), 'queryType missing select');
  assert(content.includes("'ctas'"), 'queryType missing ctas');
});

test('QueryBoxNodeData has displayMode: DisplayMode', () => {
  assert(content.includes('displayMode: DisplayMode'), 'QueryBoxNodeData.displayMode not found');
});

test('QueryBoxNodeData has compactColumns: string[]', () => {
  assert(content.includes('compactColumns: string[]'), 'QueryBoxNodeData.compactColumns not found');
});

test('QueryBoxNodeData has isRegistered: boolean', () => {
  assert(content.includes('isRegistered: boolean'), 'QueryBoxNodeData.isRegistered not found');
});

// --- ClauseBoxNodeData fields ---

test('ClauseBoxNodeData has clauseType with all 6 clause types', () => {
  assert(content.includes("'SELECT'"), 'clauseType missing SELECT');
  assert(content.includes("'FROM'"), 'clauseType missing FROM');
  assert(content.includes("'WHERE'"), 'clauseType missing WHERE');
  assert(content.includes("'GROUP BY'"), 'clauseType missing GROUP BY');
  assert(content.includes("'HAVING'"), 'clauseType missing HAVING');
  assert(content.includes("'ORDER BY'"), 'clauseType missing ORDER BY');
});

test('ClauseBoxNodeData has label: string', () => {
  assert(content.includes('label: string'), 'ClauseBoxNodeData.label not found');
});

// --- ColumnItemNodeData fields ---

test('ColumnItemNodeData has displayName: string', () => {
  assert(content.includes('displayName: string'), 'ColumnItemNodeData.displayName not found');
});

test('ColumnItemNodeData has sourceTable: string | null', () => {
  assert(content.includes('sourceTable: string | null'), 'ColumnItemNodeData.sourceTable not found');
});

test('ColumnItemNodeData has exprType referencing SelectColumn', () => {
  assert(content.includes("SelectColumn['exprType']"), 'ColumnItemNodeData.exprType reference not found');
});

test('ColumnItemNodeData has certainty: Certainty', () => {
  assert(content.includes('certainty: Certainty'), 'ColumnItemNodeData.certainty not found');
});

test('ColumnItemNodeData has isHighlighted: boolean', () => {
  assert(content.includes('isHighlighted: boolean'), 'ColumnItemNodeData.isHighlighted not found');
});

test('ColumnItemNodeData has conditionText: string | null', () => {
  assert(content.includes('conditionText: string | null'), 'ColumnItemNodeData.conditionText not found');
});

// --- UnresolvedBoxNodeData fields ---

test('UnresolvedBoxNodeData has inferredColumns: string[]', () => {
  assert(content.includes('inferredColumns: string[]'), 'UnresolvedBoxNodeData.inferredColumns not found');
});

// --- FlowState fields ---

test('FlowState has nodes: FlowNode[]', () => {
  assert(content.includes('nodes: FlowNode[]'), 'FlowState.nodes not using FlowNode type');
});

test('FlowState has edges: FlowEdge[]', () => {
  assert(content.includes('edges: FlowEdge[]'), 'FlowState.edges not using FlowEdge type');
});

test('FlowState has displayModes: Map<string, DisplayMode>', () => {
  assert(content.includes('displayModes: Map<string, DisplayMode>'), 'FlowState.displayModes not found');
});

test('FlowState has highlightPath nullable', () => {
  assert(content.includes('highlightPath:'), 'FlowState.highlightPath not found');
  assert(content.includes('| null'), 'highlightPath not nullable');
});

// --- FlowActions fields ---

test('FlowActions has syncFromLineage method', () => {
  assert(content.includes('syncFromLineage:'), 'FlowActions.syncFromLineage not found');
});

test('FlowActions has toggleDisplayMode method', () => {
  assert(content.includes('toggleDisplayMode:'), 'FlowActions.toggleDisplayMode not found');
});

test('FlowActions has highlightLineage method', () => {
  assert(content.includes('highlightLineage:'), 'FlowActions.highlightLineage not found');
});

test('FlowActions has clearHighlight method', () => {
  assert(content.includes('clearHighlight:'), 'FlowActions.clearHighlight not found');
});

// --- FlowStore ---

test('FlowStore is FlowState & FlowActions', () => {
  assert(content.includes('FlowState & FlowActions'), 'FlowStore intersection type not found');
});

// --- DisplayMode ---

test('DisplayMode includes compact and detail', () => {
  assert(content.includes("'compact'"), 'DisplayMode missing compact');
  assert(content.includes("'detail'"), 'DisplayMode missing detail');
});

// --- TypeScript compilation check ---

test('flow.ts compiles without errors (tsc --noEmit)', () => {
  try {
    execSync('npx tsc --noEmit --strict --esModuleInterop --moduleResolution bundler --module esnext --target ES2017 --skipLibCheck src/types/flow.ts', {
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
