/**
 * ClauseBoxNode の縦展開機能を検証する。
 * 対応Beadsタスク: sql_viz_202604_2-oi5
 *
 * - toggleClauseExpand を呼ぶと該当 clauseBox の data.expanded が true になる
 * - 高さが collapsed (28) より大きくなる
 * - 再呼出で false に戻り、高さが元 (28) に戻る
 * - SELECT 句は対象外（ColumnItem 子があるため）
 * - 親 QueryBox サイズが再計算される
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// --- structural checks ---
const tsxPath = path.join(ROOT, 'src', 'components', 'visualizer', 'nodes', 'ClauseBoxNode.tsx');
const tsxSrc = fs.readFileSync(tsxPath, 'utf-8');
const cssPath = path.join(ROOT, 'src', 'components', 'visualizer', 'nodes', 'ClauseBoxNode.module.css');
const cssSrc = fs.readFileSync(cssPath, 'utf-8');
const flowStorePath = path.join(ROOT, 'src', 'stores', 'flowStore.ts');
const flowStoreSrc = fs.readFileSync(flowStorePath, 'utf-8');
const typesPath = path.join(ROOT, 'src', 'types', 'flow.ts');
const typesSrc = fs.readFileSync(typesPath, 'utf-8');

const results = [];
let failed = false;
function test(name, fn) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

test('ClauseBoxNodeData has expanded field', () => {
  assert(/expanded\?\s*:\s*boolean/.test(typesSrc), 'expanded field missing in ClauseBoxNodeData');
});
test('FlowActions has toggleClauseExpand', () => {
  assert(/toggleClauseExpand/.test(typesSrc), 'toggleClauseExpand missing in FlowActions');
});
test('ClauseBoxNode.tsx imports useFlowStore', () => {
  assert(tsxSrc.includes('useFlowStore'), 'useFlowStore not imported');
});
test('ClauseBoxNode.tsx has toggle handler', () => {
  assert(tsxSrc.includes('toggleClauseExpand'), 'toggleClauseExpand not used');
});
test('ClauseBoxNode.tsx renders expand icon', () => {
  assert(tsxSrc.includes('▾') || tsxSrc.includes('▸'), 'expand icon missing');
});
test('CSS has expanded class', () => {
  assert(/\.expanded/.test(cssSrc), '.expanded class missing in CSS');
});
test('flowStore.ts implements toggleClauseExpand', () => {
  assert(/toggleClauseExpand:\s*\(/.test(flowStoreSrc), 'toggleClauseExpand action missing');
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

function makeCol(name: string, tid: string): ColumnNode {
  return { columnName: name, tableId: tid, certainty: 'confirmed', dependencies: [], isFromStar: false, exprType: 'column_ref' };
}
function makeTable(): TableNode {
  const cols = new Map<string, ColumnNode>();
  cols.set('id', makeCol('id', 'q'));
  return {
    id: 'q', name: null, displayTitle: '[問い合わせ]',
    isRegistered: true, queryType: 'select', queryId: 'q',
    columns: cols, dependsOn: new Set(),
    ctes: [], fromSubqueries: [], whereSubqueries: [],
    clauses: {
      select: { columns: [{ displayName: 'id', sourceTable: 'a', sourceColumn: 'id', exprType: 'column_ref' }] },
      from: { tables: [{ name: 'a', alias: null }, { name: 'b', alias: 'bb' }], joins: [
        { joinType: 'INNER', table: 'c', alias: 'cc', onConditionText: 'a.id = c.a_id AND a.x = c.y AND a.created_at >= c.start_date' }
      ] },
      where: { conditionText: "a.status = 'active' AND a.created_at >= '2024-01-01' AND a.region IN ('US', 'EU', 'APAC')" },
      groupBy: null, having: null, orderBy: null,
    },
  };
}
function reset() {
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
}

test('initial state: clauseBox is not expanded', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q', makeTable());
  useFlowStore.getState().syncFromLineage(tables);
  const fromBox = useFlowStore.getState().nodes.find((n: any) => n.id === 'q__clause__FROM')!;
  assert(fromBox !== undefined, 'FROM clauseBox missing');
  const data = fromBox.data as any;
  assert(data.expanded === undefined || data.expanded === false, 'expanded should be falsy initially');
});

test('toggleClauseExpand sets expanded=true and increases height', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q', makeTable());
  useFlowStore.getState().syncFromLineage(tables);
  const before = useFlowStore.getState().nodes.find((n: any) => n.id === 'q__clause__FROM')!;
  const beforeH = (before as any).height;
  useFlowStore.getState().toggleClauseExpand('q__clause__FROM');
  const after = useFlowStore.getState().nodes.find((n: any) => n.id === 'q__clause__FROM')!;
  const afterH = (after as any).height;
  assert((after.data as any).expanded === true, 'expanded should be true after toggle');
  assert(afterH > beforeH, 'height should grow on expand, before=' + beforeH + ' after=' + afterH);
});

test('toggleClauseExpand twice restores expanded=false and original height', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q', makeTable());
  useFlowStore.getState().syncFromLineage(tables);
  const beforeH = (useFlowStore.getState().nodes.find((n: any) => n.id === 'q__clause__FROM') as any).height;
  useFlowStore.getState().toggleClauseExpand('q__clause__FROM');
  useFlowStore.getState().toggleClauseExpand('q__clause__FROM');
  const after = useFlowStore.getState().nodes.find((n: any) => n.id === 'q__clause__FROM')!;
  assert((after.data as any).expanded === false, 'expanded should be false after second toggle');
  assert((after as any).height === beforeH, 'height should restore, before=' + beforeH + ' after=' + (after as any).height);
});

test('SELECT clauseBox is not affected by toggleClauseExpand (no-op)', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q', makeTable());
  useFlowStore.getState().syncFromLineage(tables);
  const beforeH = (useFlowStore.getState().nodes.find((n: any) => n.id === 'q__clause__SELECT') as any).height;
  useFlowStore.getState().toggleClauseExpand('q__clause__SELECT');
  const after = useFlowStore.getState().nodes.find((n: any) => n.id === 'q__clause__SELECT')!;
  // SELECT should be left as-is (no expand state) since it has columnItem children
  const afterH = (after as any).height;
  assert(afterH === beforeH, 'SELECT height should not change, before=' + beforeH + ' after=' + afterH);
});

test('parent QueryBox height increases when child clauseBox is expanded', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q', makeTable());
  useFlowStore.getState().syncFromLineage(tables);
  const parentBefore = useFlowStore.getState().nodes.find((n: any) => n.id === 'q')!;
  const beforeH = (parentBefore as any).height;
  useFlowStore.getState().toggleClauseExpand('q__clause__FROM');
  const parentAfter = useFlowStore.getState().nodes.find((n: any) => n.id === 'q')!;
  const afterH = (parentAfter as any).height;
  assert(afterH > beforeH, 'parent QueryBox height should grow when child expanded, before=' + beforeH + ' after=' + afterH);
});

console.log('\\n=== ClauseBox Expand Functional Tests ===\\n');
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
  const tmpFile = path.join(tmpDir, 'clauseBoxExpand-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const out = execSync('npx tsx tmp/clauseBoxExpand-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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

console.log('\n=== ClauseBoxExpand Tests ===\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\n  ' + pc + '/' + results.length + ' tests passed\n');
process.exit(failed ? 1 : 0);
