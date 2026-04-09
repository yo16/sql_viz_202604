/**
 * 句 clauseBox を実行順 (FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY)
 * で横並びに配置することを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-q82
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

function makeCol(name: string, tid: string): ColumnNode {
  return { columnName: name, tableId: tid, certainty: 'confirmed', dependencies: [], isFromStar: false, exprType: 'column_ref' };
}

function makeFullTable(): TableNode {
  const cols = new Map<string, ColumnNode>();
  cols.set('id', makeCol('id', 'q'));
  cols.set('name', makeCol('name', 'q'));
  return {
    id: 'q', name: null, displayTitle: '[問い合わせ]',
    isRegistered: true, queryType: 'select', queryId: 'q',
    columns: cols, dependsOn: new Set(),
    ctes: [], fromSubqueries: [], whereSubqueries: [],
    clauses: {
      select: { columns: [
        { displayName: 'id', sourceTable: 'users', sourceColumn: 'id', exprType: 'column_ref' },
        { displayName: 'name', sourceTable: 'users', sourceColumn: 'name', exprType: 'column_ref' },
      ]},
      from: { tables: [{ name: 'users', alias: null }], joins: [] },
      where: { conditionText: "active = true" },
      groupBy: { expressionText: 'department' },
      having: { conditionText: 'count(*) > 1' },
      orderBy: { expressionText: 'created_at DESC' },
    },
  };
}

function reset() {
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
}

function findClause(clauseType: string): any {
  return useFlowStore.getState().nodes.find((n: any) =>
    n.type === 'clauseBox' && (n.data as any).clauseType === clauseType
  );
}

test('all six clause types are generated for full query', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q', makeFullTable());
  useFlowStore.getState().syncFromLineage(tables);
  for (const t of ['FROM', 'WHERE', 'GROUP BY', 'HAVING', 'SELECT', 'ORDER BY']) {
    assert(findClause(t) !== undefined, t + ' clauseBox not found');
  }
});

test('left column clauses stack vertically in execution order (bd-8ud)', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q', makeFullTable());
  useFlowStore.getState().syncFromLineage(tables);
  // bd-sql_viz_202604_2-8ud: 2 列レイアウト。左列は FROM→WHERE→GROUP BY→HAVING→ORDER BY を縦積み。
  const order = ['FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY'];
  const ys = order.map(t => findClause(t).position.y);
  for (let i = 1; i < ys.length; i++) {
    assert(ys[i - 1] < ys[i],
      'expected ' + order[i - 1] + '.y < ' + order[i] + '.y');
  }
  const xs = order.map(t => findClause(t).position.x);
  for (let i = 1; i < xs.length; i++) {
    assert(xs[0] === xs[i], 'left column should share x');
  }
});

test('SELECT is in right column, top-aligned with left column (bd-8ud)', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q', makeFullTable());
  useFlowStore.getState().syncFromLineage(tables);
  const sel = findClause('SELECT');
  const fromBox = findClause('FROM');
  assert(sel.position.x > fromBox.position.x, 'SELECT.x > FROM.x');
  assert(sel.position.y === fromBox.position.y, 'SELECT.y == FROM.y');
});

test('SELECT clauseBox still has columnItem children', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q', makeFullTable());
  useFlowStore.getState().syncFromLineage(tables);
  const sel = findClause('SELECT');
  const colItems = useFlowStore.getState().nodes.filter((n: any) =>
    n.type === 'columnItem' && (n as any).parentId === sel.id
  );
  assert(colItems.length === 2, 'expected 2 columnItems under SELECT, got ' + colItems.length);
});

test('clauses with null source are not generated', () => {
  reset();
  const t = makeFullTable();
  t.clauses.where = null;
  t.clauses.groupBy = null;
  t.clauses.having = null;
  t.clauses.orderBy = null;
  const tables = new Map<string, TableNode>();
  tables.set('q', t);
  useFlowStore.getState().syncFromLineage(tables);
  assert(findClause('WHERE') === undefined, 'WHERE should not exist');
  assert(findClause('GROUP BY') === undefined, 'GROUP BY should not exist');
  assert(findClause('HAVING') === undefined, 'HAVING should not exist');
  assert(findClause('ORDER BY') === undefined, 'ORDER BY should not exist');
  // FROM and SELECT still exist
  assert(findClause('FROM') !== undefined, 'FROM should exist');
  assert(findClause('SELECT') !== undefined, 'SELECT should exist');
  // and FROM.x < SELECT.x
  assert(findClause('FROM').position.x < findClause('SELECT').position.x, 'FROM left of SELECT');
});

console.log('\\n=== Horizontal Clause Layout Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'horizontalClauseLayout-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/horizontalClauseLayout-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
