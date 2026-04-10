/**
 * 初回パース後に全ノードが compact 状態になり、
 * 位置は detail レイアウト基準のまま維持されることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-boe
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

test('all queryBox nodes start in compact mode after syncFromLineage', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('src', makeUnresolved('src', ['id', 'name']));
  tables.set('mid', makeT('mid', ['src'], ['id', 'name', 'value']));
  tables.set('out', makeT('out', ['mid'], ['id', 'total']));
  useFlowStore.getState().syncFromLineage(tables);
  const queryBoxes = useFlowStore.getState().nodes.filter((n: any) => n.type === 'queryBox');
  for (const qb of queryBoxes) {
    const dm = (qb.data as any).displayMode;
    assert(dm === 'compact', qb.id + ' should be compact, got: ' + dm);
  }
});

test('all unresolvedBox nodes start in compact mode', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('src', makeUnresolved('src', ['id', 'name']));
  tables.set('out', makeT('out', ['src'], ['id']));
  useFlowStore.getState().syncFromLineage(tables);
  const unresBoxes = useFlowStore.getState().nodes.filter((n: any) => n.type === 'unresolvedBox');
  for (const ub of unresBoxes) {
    const dm = (ub.data as any).displayMode;
    assert(dm === 'compact', ub.id + ' should be compact, got: ' + dm);
  }
});

test('child clauseBox/columnItem nodes are hidden', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('src', makeUnresolved('src', ['id']));
  tables.set('out', makeT('out', ['src'], ['id']));
  useFlowStore.getState().syncFromLineage(tables);
  const childNodes = useFlowStore.getState().nodes.filter((n: any) =>
    n.type === 'clauseBox' || n.type === 'columnItem'
  );
  for (const c of childNodes) {
    assert((c as any).hidden === true, c.id + ' should be hidden in compact, got: ' + (c as any).hidden);
  }
});

test('two tables in same layer do not overlap even when opened (positions from detail layout)', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('src1', makeUnresolved('src1', ['a', 'b', 'c', 'd', 'e']));
  tables.set('src2', makeUnresolved('src2', ['x', 'y', 'z']));
  tables.set('out', makeT('out', ['src1', 'src2'], ['id']));
  useFlowStore.getState().syncFromLineage(tables);
  // Both src1/src2 are in same layer. Get their positions.
  const src1 = useFlowStore.getState().nodes.find((n: any) => n.id === 'src1')!;
  const src2 = useFlowStore.getState().nodes.find((n: any) => n.id === 'src2')!;
  // Toggle both to detail to get their real sizes
  useFlowStore.getState().toggleDisplayMode('src1');
  useFlowStore.getState().toggleDisplayMode('src2');
  const src1d = useFlowStore.getState().nodes.find((n: any) => n.id === 'src1')!;
  const src2d = useFlowStore.getState().nodes.find((n: any) => n.id === 'src2')!;
  // Positions should still not overlap with detail sizes
  const [top, bottom] = src1d.position.y < src2d.position.y ? [src1d, src2d] : [src2d, src1d];
  const topBottom = top.position.y + ((top as any).height ?? 0);
  assert(topBottom <= bottom.position.y,
    'detail-opened nodes should not overlap: topBottom=' + topBottom + ' bottomTop=' + bottom.position.y);
});

test('displayModes map has compact for all table IDs', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('src', makeUnresolved('src', ['id']));
  tables.set('out', makeT('out', ['src'], ['id']));
  useFlowStore.getState().syncFromLineage(tables);
  const dm = useFlowStore.getState().displayModes;
  assert(dm.get('out') === 'compact', 'out displayMode should be compact');
  assert(dm.get('src') === 'compact', 'src displayMode should be compact');
});

console.log('\\n=== Initial Compact with Detail Positions Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'initialCompact-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/initialCompact-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
