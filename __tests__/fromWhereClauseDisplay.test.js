/**
 * syncFromLineage が FROM句・WHERE句用の clauseBox ノードを生成することを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-c69
 *
 * 修正前: SELECTのclauseBoxしか生成されない
 * 修正後: FROM / WHERE のclauseBoxが生成され label が設定されている
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
  return { columnName: n, tableId: tid, certainty: 'confirmed', dependencies: [], isFromStar: false, exprType: 'column_ref' };
}

// シンプルな SELECT 1つ: FROM users WHERE created_at >= '2024-01-01'
function makeSimpleTable(): TableNode {
  const cols = new Map<string, ColumnNode>();
  cols.set('user_id', makeCol('user_id', 'q1'));
  cols.set('user_name', makeCol('user_name', 'q1'));
  return {
    id: 'q1', name: null, displayTitle: '[問い合わせ]',
    isRegistered: true, queryType: 'select', queryId: 'q1',
    columns: cols, dependsOn: new Set(),
    ctes: [], fromSubqueries: [], whereSubqueries: [],
    clauses: {
      select: { columns: [
        { displayName: 'user_id', sourceTable: 'users', sourceColumn: 'user_id', exprType: 'column_ref' },
        { displayName: 'user_name', sourceTable: 'users', sourceColumn: 'user_name', exprType: 'column_ref' },
      ]},
      from: { tables: [{ name: 'users', alias: null }], joins: [] },
      where: { conditionText: "created_at >= '2024-01-01'" },
      groupBy: null, having: null, orderBy: null,
    },
  };
}

// JOINを含むテーブル
function makeJoinTable(): TableNode {
  const cols = new Map<string, ColumnNode>();
  cols.set('id', makeCol('id', 'q2'));
  return {
    id: 'q2', name: null, displayTitle: '[問い合わせ]',
    isRegistered: true, queryType: 'select', queryId: 'q2',
    columns: cols, dependsOn: new Set(),
    ctes: [], fromSubqueries: [], whereSubqueries: [],
    clauses: {
      select: { columns: [{ displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref' }] },
      from: {
        tables: [{ name: 'a', alias: null }],
        joins: [{ joinType: 'INNER', table: 'b', alias: null, onConditionText: 'a.id = b.a_id' }],
      },
      where: null, groupBy: null, having: null, orderBy: null,
    },
  };
}

function reset() {
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
}

test('FROM clauseBox is generated with table label', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q1', makeSimpleTable());
  useFlowStore.getState().syncFromLineage(tables);
  const from = useFlowStore.getState().nodes.find((n: any) => n.type === 'clauseBox' && (n.data as any).clauseType === 'FROM');
  assert(from !== undefined, 'FROM clauseBox not found');
  const label = (from!.data as any).label as string;
  assert(label.includes('users'), 'FROM label should include "users", got: ' + label);
  assert((from! as any).parentId === 'q1', 'FROM clauseBox parentId should be q1');
});

test('WHERE clauseBox is generated with condition label', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q1', makeSimpleTable());
  useFlowStore.getState().syncFromLineage(tables);
  const where = useFlowStore.getState().nodes.find((n: any) => n.type === 'clauseBox' && (n.data as any).clauseType === 'WHERE');
  assert(where !== undefined, 'WHERE clauseBox not found');
  const label = (where!.data as any).label as string;
  assert(label.includes('created_at'), 'WHERE label should include created_at, got: ' + label);
});

test('no WHERE clauseBox when clause is null', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q2', makeJoinTable());
  useFlowStore.getState().syncFromLineage(tables);
  const where = useFlowStore.getState().nodes.find((n: any) => n.type === 'clauseBox' && (n.data as any).clauseType === 'WHERE');
  assert(where === undefined, 'WHERE clauseBox should not exist when where is null');
});

test('FROM clauseBox label includes JOIN info when joins exist', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q2', makeJoinTable());
  useFlowStore.getState().syncFromLineage(tables);
  const from = useFlowStore.getState().nodes.find((n: any) => n.type === 'clauseBox' && (n.data as any).clauseType === 'FROM');
  assert(from !== undefined, 'FROM clauseBox not found');
  const label = (from!.data as any).label as string;
  assert(label.includes('a'), 'label should include base table "a", got: ' + label);
  assert(label.toUpperCase().includes('JOIN') || label.includes('b'), 'label should include join info or "b", got: ' + label);
});

test('FROM/WHERE clauseBox are not draggable', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q1', makeSimpleTable());
  useFlowStore.getState().syncFromLineage(tables);
  const clauses = useFlowStore.getState().nodes.filter((n: any) => n.type === 'clauseBox');
  for (const c of clauses) {
    assert((c as any).draggable === false, 'clauseBox ' + c.id + ' should be draggable=false');
  }
});

test('2-column layout: FROM/WHERE stacked left, SELECT right (bd-8ud)', () => {
  // bd-sql_viz_202604_2-8ud: 横一列 → 2 列レイアウトに変更
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q1', makeSimpleTable());
  useFlowStore.getState().syncFromLineage(tables);
  const sel = useFlowStore.getState().nodes.find((n: any) => n.type === 'clauseBox' && (n.data as any).clauseType === 'SELECT')!;
  const from = useFlowStore.getState().nodes.find((n: any) => n.type === 'clauseBox' && (n.data as any).clauseType === 'FROM')!;
  const where = useFlowStore.getState().nodes.find((n: any) => n.type === 'clauseBox' && (n.data as any).clauseType === 'WHERE')!;
  // 左列: FROM/WHERE が同じ x、縦に並ぶ (FROM 上、WHERE 下)
  assert(from.position.x === where.position.x, 'FROM/WHERE share x (left col)');
  assert(from.position.y < where.position.y, 'FROM above WHERE');
  // 右列: SELECT は左列の右、FROM と同じ y
  assert(sel.position.x > from.position.x, 'SELECT in right col');
  assert(sel.position.y === from.position.y, 'SELECT top-aligned with FROM');
});

console.log('\\n=== FROM/WHERE Clause Display Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'fromWhereClauseDisplay-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const output = execSync('npx tsx tmp/fromWhereClauseDisplay-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
