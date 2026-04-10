/**
 * expandAll / compactAll アクションで全ノードを一括開閉できることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-f4z
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// --- 構造テスト ---
const flowTypes = fs.readFileSync(path.join(ROOT, 'src/types/flow.ts'), 'utf-8');
const flowStore = fs.readFileSync(path.join(ROOT, 'src/stores/flowStore.ts'), 'utf-8');

const results = [];
let failed = false;
function test(name, fn) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

test('FlowActions has expandAll', () => {
  assert(flowTypes.includes('expandAll'), 'expandAll missing in FlowActions');
});
test('FlowActions has compactAll', () => {
  assert(flowTypes.includes('compactAll'), 'compactAll missing in FlowActions');
});
test('flowStore implements expandAll', () => {
  assert(/expandAll:\s*\(/.test(flowStore), 'expandAll action missing in flowStore');
});
test('flowStore implements compactAll', () => {
  assert(/compactAll:\s*\(/.test(flowStore), 'compactAll action missing in flowStore');
});

// --- 機能テスト ---
const FUNCTIONAL_TEST = `
import { useFlowStore } from '../src/stores/flowStore';
import type { TableNode, ColumnNode } from '../src/types/lineage';

const results: Array<{ name: string; status: string; error?: string }> = [];
let failed = false;
function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e: any) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }

function makeCol(n: string, tid: string): ColumnNode {
  return { columnName: n, tableId: tid, certainty: 'confirmed', dependencies: [], isFromStar: false, exprType: 'column_ref' };
}
function makeT(id: string, deps: string[], cols: string[]): TableNode {
  const columns = new Map<string, ColumnNode>();
  for (const c of cols) columns.set(c, makeCol(c, id));
  return {
    id, name: id, displayTitle: id, isRegistered: true, queryType: 'ctas', queryId: id,
    columns, dependsOn: new Set(deps),
    ctes: [], fromSubqueries: [], whereSubqueries: [],
    clauses: {
      select: { columns: cols.map(c => ({ displayName: c, sourceTable: deps[0] ?? null, sourceColumn: c, exprType: 'column_ref' })) },
      from: { tables: deps.map(d => ({ name: d, alias: null })), joins: [] },
      where: null, groupBy: null, having: null, orderBy: null,
    },
  };
}
function makeUnresolved(name: string, cols: string[]): TableNode {
  const columns = new Map<string, ColumnNode>();
  for (const c of cols) columns.set(c, { columnName: c, tableId: name, certainty: 'inferred', dependencies: [], isFromStar: false, exprType: 'column_ref' });
  return {
    id: name, name, displayTitle: '[未登録] ' + name,
    isRegistered: false, queryType: 'unresolved', queryId: null,
    columns, dependsOn: new Set(),
    ctes: [], fromSubqueries: [], whereSubqueries: [],
    clauses: { select: { columns: [] }, from: { tables: [], joins: [] }, where: null, groupBy: null, having: null, orderBy: null },
  };
}
function reset() {
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null, highlightedColumns: null });
}

function setup() {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('src', makeUnresolved('src', ['id', 'name']));
  tables.set('mid', makeT('mid', ['src'], ['id', 'name']));
  tables.set('out', makeT('out', ['mid'], ['id']));
  useFlowStore.getState().syncFromLineage(tables);
}

test('compactAll sets all queryBox/unresolvedBox to compact', () => {
  setup();
  // initial = detail
  (useFlowStore.getState() as any).compactAll();
  const nodes = useFlowStore.getState().nodes;
  const boxes = nodes.filter((n: any) => n.type === 'queryBox' || n.type === 'unresolvedBox');
  assert(boxes.length >= 3, 'should have at least 3 boxes');
  for (const b of boxes) {
    assert((b.data as any).displayMode === 'compact',
      b.id + ' should be compact, got: ' + (b.data as any).displayMode);
  }
});

test('expandAll sets all queryBox/unresolvedBox to detail', () => {
  setup();
  (useFlowStore.getState() as any).compactAll();
  (useFlowStore.getState() as any).expandAll();
  const nodes = useFlowStore.getState().nodes;
  const boxes = nodes.filter((n: any) => n.type === 'queryBox' || n.type === 'unresolvedBox');
  for (const b of boxes) {
    assert((b.data as any).displayMode === 'detail',
      b.id + ' should be detail, got: ' + (b.data as any).displayMode);
  }
});

test('compactAll hides clauseBox children', () => {
  setup();
  (useFlowStore.getState() as any).compactAll();
  const clauses = useFlowStore.getState().nodes.filter((n: any) => n.type === 'clauseBox');
  assert(clauses.length > 0, 'clauseBoxes should exist');
  for (const c of clauses) {
    assert((c as any).hidden === true, c.id + ' should be hidden');
  }
});

test('expandAll unhides clauseBox children', () => {
  setup();
  (useFlowStore.getState() as any).compactAll();
  (useFlowStore.getState() as any).expandAll();
  const clauses = useFlowStore.getState().nodes.filter((n: any) =>
    n.type === 'clauseBox' && (n as any).parentId !== undefined
  );
  // ルートレベルの clauseBox は visible のはず
  const rootParentIds = useFlowStore.getState().nodes
    .filter((n: any) => (n.type === 'queryBox' || n.type === 'unresolvedBox') && n.parentId === undefined)
    .map((n: any) => n.id);
  const rootClauses = clauses.filter((c: any) => rootParentIds.includes(c.parentId));
  for (const c of rootClauses) {
    assert((c as any).hidden !== true, c.id + ' should be visible after expandAll');
  }
});

test('compactAll then expandAll: queryBox sizes change', () => {
  setup();
  const midDetailH = (useFlowStore.getState().nodes.find((n: any) => n.id === 'mid') as any)?.height;
  (useFlowStore.getState() as any).compactAll();
  const midCompactH = (useFlowStore.getState().nodes.find((n: any) => n.id === 'mid') as any)?.height;
  (useFlowStore.getState() as any).expandAll();
  const midExpandedH = (useFlowStore.getState().nodes.find((n: any) => n.id === 'mid') as any)?.height;
  if (midDetailH !== undefined && midCompactH !== undefined) {
    assert(midCompactH < midDetailH, 'compact height should be < detail');
  }
  if (midCompactH !== undefined && midExpandedH !== undefined) {
    assert(midExpandedH > midCompactH, 'expanded height should be > compact');
  }
});

test('displayModes map updated correctly', () => {
  setup();
  (useFlowStore.getState() as any).compactAll();
  const dm = useFlowStore.getState().displayModes;
  for (const [, v] of dm) assert(v === 'compact', 'all should be compact');
  (useFlowStore.getState() as any).expandAll();
  const dm2 = useFlowStore.getState().displayModes;
  for (const [, v] of dm2) assert(v === 'detail', 'all should be detail');
});

console.log('\\n=== Expand/Collapse All Functional Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('functional tests pass (via tsx)', () => {
  const tmpDir = path.join(ROOT, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, 'expandCollapseAll-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const out = execSync('npx tsx tmp/expandCollapseAll-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    const stdout = out.toString();
    console.log(stdout);
    if (stdout.includes('FAIL:')) throw new Error('functional failed');
  } catch (e) {
    const stdout = e.stdout ? e.stdout.toString() : '';
    if (stdout) console.log(stdout);
    throw new Error('Failed: ' + (e.stderr ? e.stderr.toString().slice(0, 600) : e.message));
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
});

console.log('\n=== Expand/Collapse All Tests ===\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\n  ' + pc + '/' + results.length + ' tests passed\n');
process.exit(failed ? 1 : 0);
