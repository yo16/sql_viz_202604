/**
 * CTE / サブクエリ内部の TableNode にカラム情報が正しく populate されることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-2ml
 *
 * 修正前: createTableNode が columns: new Map() で空 → CTE 内部 TableNode に
 *         カラムが一切設定されず、QueryBox を開いても中身が表示されない
 * 修正後: createTableNode 内で query.select.columns から columns Map を populate
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const FUNCTIONAL_TEST = `
import { buildLineageGraph } from '../src/lib/lineage/buildLineageGraph';
import { parseSql, splitStatements } from '../src/lib/parser/sqlParser';
import { extractQueryStructure } from '../src/lib/parser/astExtractor';
import { useFlowStore } from '../src/stores/flowStore';
import { useLineageStore } from '../src/stores/lineageStore';
import { initStoreSubscriptions } from '../src/stores/storeSubscriptions';
import * as fs from 'fs';
import * as path from 'path';

const results: Array<{ name: string; status: string; error?: string }> = [];
let failed = false;
function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e: any) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }

const sql = fs.readFileSync(path.join(process.cwd(), 'samples', 'queries', '04_cte_with.sql'), 'utf-8');
const queries: any[] = [];
for (const stmt of splitStatements(sql)) {
  const ast = parseSql(stmt, 'BigQuery');
  queries.push(extractQueryStructure(ast, stmt));
}

test('ParsedQuery has CTEs extracted', () => {
  assert(queries.length >= 1, 'at least one parsed query');
  const q = queries[0];
  assert(q.ctes.length === 2, 'should have 2 CTEs (monthly_sales, ranked_users), got ' + q.ctes.length);
});

test('CTE inner ParsedQuery has select.columns populated', () => {
  const cte0 = queries[0].ctes[0];
  assert(cte0.query.select.columns.length > 0, 'CTE monthly_sales should have select columns');
});

test('buildLineageGraph populates CTE inner TableNode columns', () => {
  const tables = buildLineageGraph(queries);
  // トップレベルテーブル（[問い合わせ]）
  const topIds = Array.from(tables.keys()).filter((id) => {
    const t = tables.get(id)!;
    return t.isRegistered && t.queryType === 'select' && t.ctes.length === 2;
  });
  assert(topIds.length === 1, 'expected 1 top-level CTE-holder query, got ' + topIds.length);
  const top = tables.get(topIds[0])!;
  const monthlySales = top.ctes.find((c: any) => c.name === 'monthly_sales')!;
  const rankedUsers = top.ctes.find((c: any) => c.name === 'ranked_users')!;
  assert(monthlySales !== undefined, 'monthly_sales CTE exists');
  assert(rankedUsers !== undefined, 'ranked_users CTE exists');
  assert(monthlySales.tableNode.columns.size > 0, 'monthly_sales should have columns, got ' + monthlySales.tableNode.columns.size);
  assert(rankedUsers.tableNode.columns.size > 0, 'ranked_users should have columns, got ' + rankedUsers.tableNode.columns.size);
});

test('flowStore generates SELECT clauseBox for CTE inner QueryBox', () => {
  // Reset both stores and subscribe
  useLineageStore.getState().resetAll();
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
  const unsub = initStoreSubscriptions();
  try {
    for (const q of queries) {
      useLineageStore.getState().addQuery(q);
    }
    const nodes = useFlowStore.getState().nodes;
    // CTE 内部 queryBox の ID パターン: {topId}__cte__{cteName}
    const cteQueryBoxes = nodes.filter((n: any) => n.type === 'queryBox' && n.id.includes('__cte__'));
    assert(cteQueryBoxes.length === 2, 'should have 2 CTE queryBoxes, got ' + cteQueryBoxes.length);

    // 各 CTE 内部 queryBox に対応する SELECT clauseBox があるべき
    for (const cteBox of cteQueryBoxes) {
      const selectClauseId = cteBox.id + '__clause__SELECT';
      const selectClause = nodes.find((n: any) => n.id === selectClauseId);
      assert(selectClause !== undefined, 'SELECT clauseBox missing for ' + cteBox.id);
      // columnItem 子ノードも存在するべき
      const colItems = nodes.filter((n: any) => n.type === 'columnItem' && (n as any).parentId === selectClauseId);
      assert(colItems.length > 0, 'columnItems missing under ' + selectClauseId);
    }
  } finally {
    unsub();
  }
});

console.log('\\n=== CTE Inner Columns Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'cteInnerColumns-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/cteInnerColumns-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
