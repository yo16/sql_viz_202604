/**
 * 左列 clauseBox を縦展開したとき、下の兄弟 clauseBox が重ならないように
 * 再スタックされ、親 QueryBox の高さも自動拡張されることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-ogr
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
  return {
    id: 'q', name: null, displayTitle: '[問い合わせ]',
    isRegistered: true, queryType: 'select', queryId: 'q',
    columns: cols, dependsOn: new Set(),
    ctes: [], fromSubqueries: [], whereSubqueries: [],
    clauses: {
      select: { columns: [{ displayName: 'id', sourceTable: 'u', sourceColumn: 'id', exprType: 'column_ref' }] },
      from: { tables: [{ name: 'a', alias: null }], joins: [
        { joinType: 'INNER', table: 'b', alias: 'bb', onConditionText: 'a.id = b.a_id AND a.x = b.y AND a.created_at >= b.start_date AND a.region IN (\\'US\\', \\'EU\\')' }
      ] },
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
function setup() {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q', makeFullTable());
  useFlowStore.getState().syncFromLineage(tables);
}
function findClause(t: string): any {
  return useFlowStore.getState().nodes.find((n: any) =>
    n.type === 'clauseBox' && (n.data as any).clauseType === t
  );
}

test('before expand: left column clauses do not overlap', () => {
  setup();
  const types = ['FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY'];
  const boxes = types.map(findClause);
  for (let i = 1; i < boxes.length; i++) {
    const prev = boxes[i - 1];
    const curr = boxes[i];
    const prevBottom = prev.position.y + (prev.height ?? 0);
    assert(prevBottom <= curr.position.y, 'no overlap initially');
  }
});

test('expanding FROM pushes WHERE/GROUP BY/HAVING/ORDER BY down', () => {
  setup();
  const fromBox = findClause('FROM');
  const whereBefore = findClause('WHERE').position.y;
  const groupByBefore = findClause('GROUP BY').position.y;
  const havingBefore = findClause('HAVING').position.y;
  const orderByBefore = findClause('ORDER BY').position.y;

  // FROM を展開
  useFlowStore.getState().toggleClauseExpand(fromBox.id);

  const whereAfter = findClause('WHERE').position.y;
  const groupByAfter = findClause('GROUP BY').position.y;
  const havingAfter = findClause('HAVING').position.y;
  const orderByAfter = findClause('ORDER BY').position.y;

  assert(whereAfter > whereBefore, 'WHERE moved down: ' + whereBefore + ' -> ' + whereAfter);
  assert(groupByAfter > groupByBefore, 'GROUP BY moved down');
  assert(havingAfter > havingBefore, 'HAVING moved down');
  assert(orderByAfter > orderByBefore, 'ORDER BY moved down');
});

test('after expand: left column clauses still do not overlap', () => {
  setup();
  useFlowStore.getState().toggleClauseExpand(findClause('FROM').id);
  const types = ['FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY'];
  const boxes = types.map(findClause);
  for (let i = 1; i < boxes.length; i++) {
    const prev = boxes[i - 1];
    const curr = boxes[i];
    const prevBottom = prev.position.y + (prev.height ?? 0);
    assert(prevBottom <= curr.position.y,
      'after-expand overlap: ' + (prev.data as any).clauseType + '.bottom=' + prevBottom +
      ' > ' + (curr.data as any).clauseType + '.top=' + curr.position.y);
  }
});

test('parent QueryBox height expands to contain expanded left column', () => {
  setup();
  const parentBefore = useFlowStore.getState().nodes.find((n: any) => n.id === 'q')! as any;
  const beforeH = parentBefore.height;

  useFlowStore.getState().toggleClauseExpand(findClause('FROM').id);

  const parentAfter = useFlowStore.getState().nodes.find((n: any) => n.id === 'q')! as any;
  const afterH = parentAfter.height;
  assert(afterH > beforeH, 'parent QueryBox should grow, before=' + beforeH + ' after=' + afterH);

  // 親の高さが最下の clauseBox の bottom を含む
  const orderBy = findClause('ORDER BY');
  const orderByBottom = orderBy.position.y + (orderBy.height ?? 0);
  assert(afterH >= orderByBottom,
    'parent height (' + afterH + ') must contain ORDER BY bottom (' + orderByBottom + ')');
});

test('collapse restores original positions', () => {
  setup();
  const fromId = findClause('FROM').id;
  const whereBefore = findClause('WHERE').position.y;
  const orderByBefore = findClause('ORDER BY').position.y;

  // expand then collapse
  useFlowStore.getState().toggleClauseExpand(fromId);
  useFlowStore.getState().toggleClauseExpand(fromId);

  const whereAfter = findClause('WHERE').position.y;
  const orderByAfter = findClause('ORDER BY').position.y;
  assert(whereAfter === whereBefore, 'WHERE restored: ' + whereBefore + ' -> ' + whereAfter);
  assert(orderByAfter === orderByBefore, 'ORDER BY restored');
});

test('expanding WHERE also pushes siblings below', () => {
  setup();
  const whereBox = findClause('WHERE');
  const gbBefore = findClause('GROUP BY').position.y;
  useFlowStore.getState().toggleClauseExpand(whereBox.id);
  const gbAfter = findClause('GROUP BY').position.y;
  assert(gbAfter > gbBefore, 'GROUP BY should move down when WHERE expands');
});

console.log('\\n=== Left Column Restack on Expand Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'leftColumnRestackOnExpand-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/leftColumnRestackOnExpand-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
