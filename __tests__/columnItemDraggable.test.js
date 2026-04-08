/**
 * syncFromLineage が生成する columnItem / clauseBox ノードが
 * draggable: false で生成されることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-35o
 *
 * 修正前: draggable が未設定 (undefined) のため React Flow のデフォルト(true)で移動可能
 * 修正後: draggable === false で固定
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

function makeCol(columnName: string, tableId: string): ColumnNode {
  return {
    columnName, tableId, certainty: 'confirmed',
    dependencies: [], isFromStar: false, exprType: 'column_ref',
  };
}
function makeTable(id: string): TableNode {
  const cols = new Map<string, ColumnNode>();
  cols.set('user_id', makeCol('user_id', id));
  cols.set('user_name', makeCol('user_name', id));
  return {
    id, name: id, displayTitle: id, isRegistered: true, queryType: 'select',
    queryId: id, columns: cols, dependsOn: new Set(),
    ctes: [], fromSubqueries: [], whereSubqueries: [],
    clauses: {
      select: { columns: [
        { displayName: 'user_id', sourceTable: 'users', sourceColumn: 'user_id', exprType: 'column_ref' },
        { displayName: 'user_name', sourceTable: 'users', sourceColumn: 'user_name', exprType: 'column_ref' },
      ] },
      from: { tables: [{ name: 'users', alias: null }], joins: [] },
      where: null, groupBy: null, having: null, orderBy: null,
    },
  };
}

function reset() {
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
}

test('columnItem nodes are not draggable', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q1', makeTable('q1'));
  useFlowStore.getState().syncFromLineage(tables);
  const cols = useFlowStore.getState().nodes.filter((n: any) => n.type === 'columnItem');
  assert(cols.length >= 2, 'expected >=2 columnItem nodes, got ' + cols.length);
  for (const c of cols) {
    assert((c as any).draggable === false, 'columnItem ' + c.id + ' should have draggable=false, got ' + (c as any).draggable);
  }
});

test('clauseBox nodes are not draggable', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q1', makeTable('q1'));
  useFlowStore.getState().syncFromLineage(tables);
  const clauses = useFlowStore.getState().nodes.filter((n: any) => n.type === 'clauseBox');
  assert(clauses.length >= 1, 'expected >=1 clauseBox, got ' + clauses.length);
  for (const cl of clauses) {
    assert((cl as any).draggable === false, 'clauseBox ' + cl.id + ' should have draggable=false');
  }
});

test('root queryBox remains draggable (undefined or true)', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q1', makeTable('q1'));
  useFlowStore.getState().syncFromLineage(tables);
  const root = useFlowStore.getState().nodes.find((n: any) => n.id === 'q1' && n.type === 'queryBox')!;
  assert(root !== undefined, 'root queryBox exists');
  assert((root as any).draggable !== false, 'root queryBox should not be draggable=false');
});

console.log('\\n=== columnItem Draggable Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'columnItemDraggable-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const output = execSync('npx tsx tmp/columnItemDraggable-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
  const stdout = output.toString();
  console.log(stdout);
  if (stdout.includes('FAIL:')) process.exit(1);
} catch (e) {
  const stdout = e.stdout ? e.stdout.toString() : '';
  const stderr = e.stderr ? e.stderr.toString() : '';
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr.slice(0, 600));
  process.exit(1);
} finally {
  try { fs.unlinkSync(tmpFile); } catch {}
}
