/**
 * 未登録テーブル (UnresolvedBox) に明示的な width/height が設定され、
 * 複数の未登録テーブルが重ならないことを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-ple
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const FUNCTIONAL_TEST = `
import { useFlowStore } from '../src/stores/flowStore';
import type { TableNode, ColumnNode } from '../src/types/lineage';
import { LAYOUT } from '../src/layout/layoutConstants';

const results: Array<{ name: string; status: string; error?: string }> = [];
let failed = false;
function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e: any) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }

function makeCol(n: string, tid: string): ColumnNode {
  return { columnName: n, tableId: tid, certainty: 'inferred', dependencies: [], isFromStar: false, exprType: 'column_ref' };
}

function makeUnresolved(name: string, cols: string[]): TableNode {
  const columns = new Map<string, ColumnNode>();
  for (const c of cols) columns.set(c, makeCol(c, name));
  return {
    id: name, name, displayTitle: '[未登録] ' + name,
    isRegistered: false, queryType: 'unresolved', queryId: null,
    columns, dependsOn: new Set(),
    ctes: [], fromSubqueries: [], whereSubqueries: [],
    clauses: { select: { columns: [] }, from: { tables: [], joins: [] }, where: null, groupBy: null, having: null, orderBy: null },
  };
}

function makeRegistered(id: string, deps: string[]): TableNode {
  const cols = new Map<string, ColumnNode>();
  cols.set('id', makeCol('id', id));
  return {
    id, name: id, displayTitle: id, isRegistered: true, queryType: 'ctas', queryId: id,
    columns: cols, dependsOn: new Set(deps),
    ctes: [], fromSubqueries: [], whereSubqueries: [],
    clauses: {
      select: { columns: [{ displayName: 'id', sourceTable: deps[0] ?? null, sourceColumn: 'id', exprType: 'column_ref' }] },
      from: { tables: deps.map(d => ({ name: d, alias: null })), joins: [] },
      where: null, groupBy: null, having: null, orderBy: null,
    },
  };
}

function reset() {
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null, highlightedColumns: null });
}

test('unresolvedBox nodes have explicit width and height', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('raw_a', makeUnresolved('raw_a', ['col1', 'col2', 'col3', 'col4', 'col5']));
  tables.set('raw_b', makeUnresolved('raw_b', ['x', 'y', 'z']));
  tables.set('out', makeRegistered('out', ['raw_a', 'raw_b']));
  useFlowStore.getState().syncFromLineage(tables);

  const a = useFlowStore.getState().nodes.find((n: any) => n.id === 'raw_a')!;
  const b = useFlowStore.getState().nodes.find((n: any) => n.id === 'raw_b')!;
  assert(typeof (a as any).width === 'number' && (a as any).width > 0,
    'raw_a should have explicit width, got: ' + (a as any).width);
  assert(typeof (a as any).height === 'number' && (a as any).height > 0,
    'raw_a should have explicit height, got: ' + (a as any).height);
  assert(typeof (b as any).width === 'number' && (b as any).width > 0,
    'raw_b should have explicit width');
});

test('unresolvedBox detail height reflects column count', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('raw_a', makeUnresolved('raw_a', ['c1', 'c2', 'c3', 'c4', 'c5']));
  tables.set('raw_b', makeUnresolved('raw_b', ['x']));
  tables.set('out', makeRegistered('out', ['raw_a', 'raw_b']));
  useFlowStore.getState().syncFromLineage(tables);

  const a = useFlowStore.getState().nodes.find((n: any) => n.id === 'raw_a')!;
  const b = useFlowStore.getState().nodes.find((n: any) => n.id === 'raw_b')!;
  assert((a as any).height > (b as any).height,
    'raw_a (5 cols) should be taller than raw_b (1 col): ' +
    (a as any).height + ' vs ' + (b as any).height);
});

test('two unresolvedBox nodes in same layer do not overlap vertically', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('raw_a', makeUnresolved('raw_a', ['c1', 'c2', 'c3', 'c4', 'c5']));
  tables.set('raw_b', makeUnresolved('raw_b', ['x', 'y', 'z']));
  tables.set('out', makeRegistered('out', ['raw_a', 'raw_b']));
  useFlowStore.getState().syncFromLineage(tables);

  const nodes = useFlowStore.getState().nodes;
  const a = nodes.find((n: any) => n.id === 'raw_a')!;
  const b = nodes.find((n: any) => n.id === 'raw_b')!;

  // 同レイヤー = 同じx。y方向の重なりを検証
  const [top, bottom] = a.position.y < b.position.y ? [a, b] : [b, a];
  const topBottom = top.position.y + ((top as any).height ?? 0);
  assert(topBottom <= bottom.position.y,
    'top box bottom (' + topBottom + ') should be <= bottom box top (' +
    bottom.position.y + '). Gap needed: ' + LAYOUT.TABLE_GAP_VERTICAL);
});

test('unresolvedBox compact mode has smaller height', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('raw_a', makeUnresolved('raw_a', ['c1', 'c2', 'c3', 'c4', 'c5']));
  tables.set('out', makeRegistered('out', ['raw_a']));
  useFlowStore.getState().syncFromLineage(tables);

  const detailH = (useFlowStore.getState().nodes.find((n: any) => n.id === 'raw_a') as any).height;
  useFlowStore.getState().toggleDisplayMode('raw_a');
  const compactH = (useFlowStore.getState().nodes.find((n: any) => n.id === 'raw_a') as any).height;
  assert(compactH < detailH,
    'compact height (' + compactH + ') should be < detail height (' + detailH + ')');
});

console.log('\\n=== UnresolvedBox Sizing Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'unresolvedBoxSizing-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/unresolvedBoxSizing-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
