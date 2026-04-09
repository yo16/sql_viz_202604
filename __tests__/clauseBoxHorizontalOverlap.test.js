/**
 * clauseBox 横並び配置で重ならないこと、および CTE 持ちクエリの main 句が
 * ネスト子の右に配置されることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-hk1
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const FUNCTIONAL_TEST = `
import { parseSql, splitStatements } from '../src/lib/parser/sqlParser';
import { extractQueryStructure } from '../src/lib/parser/astExtractor';
import { useLineageStore } from '../src/stores/lineageStore';
import { useFlowStore } from '../src/stores/flowStore';
import { initStoreSubscriptions } from '../src/stores/storeSubscriptions';
import type { TableNode, ColumnNode } from '../src/types/lineage';
import * as fs from 'fs';
import * as path from 'path';

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

function setupCTE() {
  useLineageStore.getState().resetAll();
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
  const unsub = initStoreSubscriptions();
  const sql = fs.readFileSync(path.join(process.cwd(), 'samples', 'queries', '04_cte_with.sql'), 'utf-8');
  for (const stmt of splitStatements(sql)) {
    const ast = parseSql(stmt, 'BigQuery');
    useLineageStore.getState().addQuery(extractQueryStructure(ast, stmt));
  }
  return unsub;
}

function setupLeaf() {
  useLineageStore.getState().resetAll();
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
  const cols = new Map<string, ColumnNode>();
  cols.set('id', makeCol('id', 'q'));
  cols.set('name', makeCol('name', 'q'));
  const table: TableNode = {
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
  const tables = new Map<string, TableNode>();
  tables.set('q', table);
  useFlowStore.getState().syncFromLineage(tables);
}

function clausesOf(parentId: string) {
  return useFlowStore.getState().nodes.filter((n: any) =>
    n.type === 'clauseBox' && (n as any).parentId === parentId
  );
}

test('leaf query: all 6 clause boxes do not overlap', () => {
  setupLeaf();
  const clauses = clausesOf('q').sort((a: any, b: any) => a.position.x - b.position.x);
  for (let i = 1; i < clauses.length; i++) {
    const prev = clauses[i - 1];
    const curr = clauses[i];
    const prevRight = prev.position.x + (prev.width ?? 0);
    assert(prevRight <= curr.position.x,
      'overlap: ' + (prev.data as any).clauseType + '.right(' + prevRight + ') > ' +
      (curr.data as any).clauseType + '.left(' + curr.position.x + ')');
  }
});

test('leaf query: SELECT and ORDER BY do not overlap specifically', () => {
  setupLeaf();
  const sel = clausesOf('q').find((n: any) => (n.data as any).clauseType === 'SELECT')!;
  const ob = clausesOf('q').find((n: any) => (n.data as any).clauseType === 'ORDER BY')!;
  const selRight = sel.position.x + (sel.width ?? 0);
  assert(selRight <= ob.position.x,
    'SELECT right (' + selRight + ', x=' + sel.position.x + ' w=' + (sel.width ?? 0) +
    ') should be <= ORDER BY left (' + ob.position.x + ')');
});

test('04_cte_with: main clauseBoxes are RIGHT of CTE children (not below)', () => {
  const unsub = setupCTE();
  try {
    const nodes = useFlowStore.getState().nodes;
    const top = nodes.find((n: any) =>
      n.type === 'queryBox' && !n.id.includes('__cte__') && (n as any).parentId === undefined
    )!;
    const cteNodes = nodes.filter((n: any) => (n as any).parentId === top.id && n.type === 'queryBox');
    const cteMaxRight = Math.max(...cteNodes.map((n: any) => n.position.x + (n.width ?? 220)));
    const mainClauses = nodes.filter((n: any) =>
      n.type === 'clauseBox' && (n as any).parentId === top.id
    );
    assert(mainClauses.length > 0, 'main clauses should exist');
    for (const c of mainClauses) {
      assert(c.position.x >= cteMaxRight,
        (c.data as any).clauseType + '.x (' + c.position.x + ') should be >= cteMaxRight (' + cteMaxRight + ')');
    }
  } finally { unsub(); }
});

test('04_cte_with: main clauseBoxes do not overlap each other', () => {
  const unsub = setupCTE();
  try {
    const nodes = useFlowStore.getState().nodes;
    const top = nodes.find((n: any) =>
      n.type === 'queryBox' && !n.id.includes('__cte__') && (n as any).parentId === undefined
    )!;
    const mainClauses = nodes.filter((n: any) =>
      n.type === 'clauseBox' && (n as any).parentId === top.id
    ).sort((a: any, b: any) => a.position.x - b.position.x);
    for (let i = 1; i < mainClauses.length; i++) {
      const prev: any = mainClauses[i - 1];
      const curr: any = mainClauses[i];
      const prevRight = prev.position.x + (prev.width ?? 0);
      assert(prevRight <= curr.position.x,
        'main clause overlap: ' + (prev.data as any).clauseType + '.right=' + prevRight +
        ' > ' + (curr.data as any).clauseType + '.left=' + curr.position.x);
    }
  } finally { unsub(); }
});

test('04_cte_with: main clauses share y = PADDING_TOP (44)', () => {
  const unsub = setupCTE();
  try {
    const nodes = useFlowStore.getState().nodes;
    const top = nodes.find((n: any) =>
      n.type === 'queryBox' && !n.id.includes('__cte__') && (n as any).parentId === undefined
    )!;
    const mainClauses = nodes.filter((n: any) =>
      n.type === 'clauseBox' && (n as any).parentId === top.id
    );
    const ys = new Set(mainClauses.map((n: any) => n.position.y));
    assert(ys.size === 1, 'all main clauses should share y, got ' + Array.from(ys).join(','));
  } finally { unsub(); }
});

console.log('\\n=== ClauseBox Horizontal Overlap Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'clauseBoxHorizontalOverlap-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/clauseBoxHorizontalOverlap-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
