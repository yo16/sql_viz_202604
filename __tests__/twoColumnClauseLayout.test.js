/**
 * main clauseBox を 2 列レイアウトで配置することを検証する。
 * - 左列: FROM → WHERE → GROUP BY → HAVING → ORDER BY を縦積み
 * - 右列: SELECT
 *
 * 対応Beadsタスク: sql_viz_202604_2-8ud
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
        { displayName: 'id', sourceTable: 'u', sourceColumn: 'id', exprType: 'column_ref' },
        { displayName: 'name', sourceTable: 'u', sourceColumn: 'name', exprType: 'column_ref' },
      ]},
      from: { tables: [{ name: 'u', alias: null }], joins: [] },
      where: { conditionText: 'active = true' },
      groupBy: { expressionText: 'region' },
      having: { conditionText: 'count(*) > 1' },
      orderBy: { expressionText: 'created DESC' },
    },
  };
}
function reset() {
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
}
function findClause(t: string): any {
  return useFlowStore.getState().nodes.find((n: any) =>
    n.type === 'clauseBox' && (n.data as any).clauseType === t
  );
}

function setup() {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q', makeFullTable());
  useFlowStore.getState().syncFromLineage(tables);
}

test('left column: FROM, WHERE, GROUP BY, HAVING, ORDER BY share same x', () => {
  setup();
  const types = ['FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY'];
  const xs = types.map(t => findClause(t).position.x);
  for (let i = 1; i < xs.length; i++) {
    assert(xs[0] === xs[i],
      types[i] + '.x (' + xs[i] + ') should equal ' + types[0] + '.x (' + xs[0] + ')');
  }
});

test('left column: FROM < WHERE < GROUP BY < HAVING < ORDER BY in y (execution order)', () => {
  setup();
  const types = ['FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY'];
  const ys = types.map(t => findClause(t).position.y);
  for (let i = 1; i < ys.length; i++) {
    assert(ys[i - 1] < ys[i],
      types[i - 1] + '.y (' + ys[i - 1] + ') should be < ' + types[i] + '.y (' + ys[i] + ')');
  }
});

test('left column clauses do not overlap vertically', () => {
  setup();
  const types = ['FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY'];
  const boxes = types.map(t => findClause(t));
  for (let i = 1; i < boxes.length; i++) {
    const prev = boxes[i - 1];
    const prevBottom = prev.position.y + (prev.height ?? 0);
    const curr = boxes[i];
    assert(prevBottom <= curr.position.y,
      'vertical overlap: ' + (prev.data as any).clauseType + '.bottom=' + prevBottom +
      ' > ' + (curr.data as any).clauseType + '.top=' + curr.position.y);
  }
});

test('right column: SELECT is to the right of left-column clauses', () => {
  setup();
  const sel = findClause('SELECT');
  const fromBox = findClause('FROM');
  const leftRight = fromBox.position.x + (fromBox.width ?? 0);
  assert(sel.position.x >= leftRight,
    'SELECT.x (' + sel.position.x + ') should be >= left column right (' + leftRight + ')');
});

test('right column: SELECT shares y with left column top (FROM)', () => {
  setup();
  const sel = findClause('SELECT');
  const fromBox = findClause('FROM');
  assert(sel.position.y === fromBox.position.y,
    'SELECT.y (' + sel.position.y + ') should equal FROM.y (' + fromBox.position.y + ')');
});

test('SELECT clauseBox still has columnItem children', () => {
  setup();
  const sel = findClause('SELECT');
  const cols = useFlowStore.getState().nodes.filter((n: any) =>
    n.type === 'columnItem' && (n as any).parentId === sel.id
  );
  assert(cols.length === 2, 'expected 2 columnItems, got ' + cols.length);
});

test('minimal query (FROM + SELECT only): 2-column layout still works', () => {
  reset();
  const cols = new Map<string, ColumnNode>();
  cols.set('id', makeCol('id', 'q'));
  const t: TableNode = {
    id: 'q', name: null, displayTitle: '[問い合わせ]',
    isRegistered: true, queryType: 'select', queryId: 'q',
    columns: cols, dependsOn: new Set(),
    ctes: [], fromSubqueries: [], whereSubqueries: [],
    clauses: {
      select: { columns: [{ displayName: 'id', sourceTable: 'u', sourceColumn: 'id', exprType: 'column_ref' }] },
      from: { tables: [{ name: 'u', alias: null }], joins: [] },
      where: null, groupBy: null, having: null, orderBy: null,
    },
  };
  const tables = new Map<string, TableNode>();
  tables.set('q', t);
  useFlowStore.getState().syncFromLineage(tables);
  const fromBox = findClause('FROM');
  const sel = findClause('SELECT');
  assert(fromBox !== undefined, 'FROM exists');
  assert(sel !== undefined, 'SELECT exists');
  assert(sel.position.x > fromBox.position.x, 'SELECT right of FROM');
});

console.log('\\n=== Two Column Clause Layout Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'twoColumnClauseLayout-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/twoColumnClauseLayout-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
