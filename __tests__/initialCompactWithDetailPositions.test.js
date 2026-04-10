/**
 * 初回パース後に全ノードが compact 状態になり、
 * 開いたときに干渉しないことを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-boe (v2)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

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
  return { columnName: n, tableId: tid, certainty: 'confirmed', dependencies: [{ sourceTableId: 'src', sourceColumn: n, type: 'direct' }], isFromStar: false, exprType: 'column_ref' };
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

test('all queryBox nodes start compact', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('src', makeUnresolved('src', ['id', 'name']));
  tables.set('out', makeT('out', ['src'], ['id', 'name']));
  useFlowStore.getState().syncFromLineage(tables);
  const qb = useFlowStore.getState().nodes.find((n: any) => n.id === 'out' && n.type === 'queryBox')!;
  assert((qb.data as any).displayMode === 'compact', 'queryBox should be compact');
});

test('all unresolvedBox nodes start compact', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('src', makeUnresolved('src', ['id', 'name']));
  tables.set('out', makeT('out', ['src'], ['id']));
  useFlowStore.getState().syncFromLineage(tables);
  const ub = useFlowStore.getState().nodes.find((n: any) => n.id === 'src')!;
  assert((ub.data as any).displayMode === 'compact', 'unresolvedBox should be compact');
});

test('clauseBox children are hidden initially', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('src', makeUnresolved('src', ['id']));
  tables.set('out', makeT('out', ['src'], ['id']));
  useFlowStore.getState().syncFromLineage(tables);
  const clauses = useFlowStore.getState().nodes.filter((n: any) => n.type === 'clauseBox');
  assert(clauses.length > 0, 'clauseBoxes should exist (generated in detail build)');
  for (const c of clauses) {
    assert((c as any).hidden === true, c.id + ' should be hidden');
  }
});

test('toggle to detail shows clauseBox children (not empty)', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('src', makeUnresolved('src', ['id']));
  tables.set('out', makeT('out', ['src'], ['id']));
  useFlowStore.getState().syncFromLineage(tables);
  // Toggle out to detail
  useFlowStore.getState().toggleDisplayMode('out');
  const clauses = useFlowStore.getState().nodes.filter((n: any) =>
    n.type === 'clauseBox' && (n as any).parentId === 'out'
  );
  assert(clauses.length > 0, 'clauseBoxes should exist after toggle to detail');
  const visibleClauses = clauses.filter((c: any) => !c.hidden);
  assert(visibleClauses.length > 0,
    'at least one clauseBox should be visible after toggle. hidden states: ' +
    clauses.map((c: any) => c.id + ':' + c.hidden).join(', '));
});

test('opened boxes do not overlap (detail positions preserved)', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('src1', makeUnresolved('src1', ['a', 'b', 'c', 'd', 'e']));
  tables.set('src2', makeUnresolved('src2', ['x', 'y', 'z']));
  tables.set('out', makeT('out', ['src1', 'src2'], ['id']));
  useFlowStore.getState().syncFromLineage(tables);
  // Toggle both to detail
  useFlowStore.getState().toggleDisplayMode('src1');
  useFlowStore.getState().toggleDisplayMode('src2');
  const s1 = useFlowStore.getState().nodes.find((n: any) => n.id === 'src1')!;
  const s2 = useFlowStore.getState().nodes.find((n: any) => n.id === 'src2')!;
  const [top, bottom] = s1.position.y < s2.position.y ? [s1, s2] : [s2, s1];
  const topBottom = top.position.y + ((top as any).height ?? 0);
  assert(topBottom <= bottom.position.y,
    'opened boxes should not overlap: topBottom=' + topBottom + ' bottomTop=' + bottom.position.y);
});

console.log('\\n=== Initial Compact v2 Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'initialCompact-v2-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/initialCompact-v2-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
  const stdout = out.toString();
  console.log(stdout);
  if (stdout.includes('FAIL:')) process.exit(1);
} catch (e) {
  const stdout = e.stdout ? e.stdout.toString() : '';
  const stderr = e.stderr ? e.stderr.toString() : '';
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr.slice(0, 800));
  process.exit(1);
} finally {
  try { fs.unlinkSync(tmpFile); } catch {}
}
