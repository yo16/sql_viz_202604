/**
 * table_dependency エッジが target の表示モードに応じて動的に接続先を切り替えることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-q8n
 *
 * - target が detail モード → edge.target = `${tid}__clause__FROM`
 * - target が compact モード → edge.target = `${tid}` (QueryBox)
 * - column_lineage エッジは現状維持
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// --- structural ---
const tsxPath = path.join(ROOT, 'src', 'components', 'visualizer', 'nodes', 'ClauseBoxNode.tsx');
const tsxSrc = fs.readFileSync(tsxPath, 'utf-8');
const flowSrc = fs.readFileSync(path.join(ROOT, 'src', 'stores', 'flowStore.ts'), 'utf-8');
const typesSrc = fs.readFileSync(path.join(ROOT, 'src', 'types', 'flow.ts'), 'utf-8');

const results = [];
let failed = false;
function test(name, fn) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

test('LineageEdgeData has targetTableId field', () => {
  assert(/targetTableId\?\s*:\s*string/.test(typesSrc), 'targetTableId missing');
});
test('ClauseBoxNode renders Handle for FROM clause', () => {
  assert(tsxSrc.includes('Handle') && tsxSrc.includes("'FROM'"), 'FROM Handle missing');
});
test('flowStore has computeTableDependencyTarget', () => {
  assert(/computeTableDependencyTarget/.test(flowSrc), 'helper missing');
});

// --- functional ---
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
function makeT(id: string, deps: string[] = []): TableNode {
  const cols = new Map<string, ColumnNode>();
  cols.set('id', makeCol('id', id));
  return {
    id, name: id, displayTitle: id, isRegistered: true, queryType: 'ctas',
    queryId: id, columns: cols, dependsOn: new Set(deps),
    ctes: [], fromSubqueries: [], whereSubqueries: [],
    clauses: {
      select: { columns: [{ displayName: 'id', sourceTable: deps[0] ?? null, sourceColumn: 'id', exprType: 'column_ref' }] },
      from: { tables: deps.length > 0 ? [{ name: deps[0], alias: null }] : [], joins: [] },
      where: null, groupBy: null, having: null, orderBy: null,
    },
  };
}
function reset() {
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
}

function findTableDepEdge(): any {
  return useFlowStore.getState().edges.find((e: any) =>
    (e.data as any)?.dependencyType === 'table_dependency'
  );
}

test('initial detail mode: edge.target points to FROM clauseBox', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('a', makeT('a'));
  tables.set('b', makeT('b', ['a']));
  useFlowStore.getState().syncFromLineage(tables);
  const edge = findTableDepEdge();
  assert(edge !== undefined, 'edge not found');
  assert(edge.target === 'b__clause__FROM',
    'expected target=b__clause__FROM, got: ' + edge.target);
  assert((edge.data as any).targetTableId === 'b', 'targetTableId should be b');
});

test('toggling target to compact: edge.target reverts to QueryBox id', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('a', makeT('a'));
  tables.set('b', makeT('b', ['a']));
  useFlowStore.getState().syncFromLineage(tables);
  useFlowStore.getState().toggleDisplayMode('b');
  const edge = findTableDepEdge();
  assert(edge.target === 'b', 'expected target=b after compact toggle, got: ' + edge.target);
});

test('toggling back to detail: edge.target points to FROM clauseBox again', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('a', makeT('a'));
  tables.set('b', makeT('b', ['a']));
  useFlowStore.getState().syncFromLineage(tables);
  useFlowStore.getState().toggleDisplayMode('b'); // → compact
  useFlowStore.getState().toggleDisplayMode('b'); // → detail
  const edge = findTableDepEdge();
  assert(edge.target === 'b__clause__FROM',
    'expected target=b__clause__FROM after re-toggle, got: ' + edge.target);
});

test('source side stays as QueryBox id (not changed)', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('a', makeT('a'));
  tables.set('b', makeT('b', ['a']));
  useFlowStore.getState().syncFromLineage(tables);
  const edge = findTableDepEdge();
  assert(edge.source === 'a', 'source should be plain a, got: ' + edge.source);
});

test('column_lineage edges are NOT retargeted', () => {
  reset();
  const tA = makeT('a');
  const tB = makeT('b', ['a']);
  // bにaのcolumn dependency を追加
  tB.columns.get('id')!.dependencies = [{ sourceTableId: 'a', sourceColumn: 'id', type: 'direct' }];
  const tables = new Map<string, TableNode>();
  tables.set('a', tA);
  tables.set('b', tB);
  useFlowStore.getState().syncFromLineage(tables);
  const colEdge = useFlowStore.getState().edges.find((e: any) =>
    (e.data as any)?.dependencyType === 'column_lineage'
  );
  assert(colEdge !== undefined, 'column_lineage edge should exist');
  // column_lineage の target は b の columnItem (b:id) のはずで、FROM clauseBox ではない
  assert(colEdge.target.includes('__clause__FROM') === false,
    'column_lineage target should not be FROM clauseBox, got: ' + colEdge.target);
});

console.log('\\n=== Edge Target Dynamic Tests ===\\n');
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
  const tmpFile = path.join(tmpDir, 'edgeTargetDynamic-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const out = execSync('npx tsx tmp/edgeTargetDynamic-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    const stdout = out.toString();
    console.log(stdout);
    if (stdout.includes('FAIL:')) throw new Error('functional test failed');
  } catch (e) {
    const stdout = e.stdout ? e.stdout.toString() : '';
    if (stdout) console.log(stdout);
    throw new Error('Failed: ' + (e.stderr ? e.stderr.toString().slice(0, 600) : e.message));
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
});

console.log('\n=== EdgeTargetDynamic Tests ===\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\n  ' + pc + '/' + results.length + ' tests passed\n');
process.exit(failed ? 1 : 0);
