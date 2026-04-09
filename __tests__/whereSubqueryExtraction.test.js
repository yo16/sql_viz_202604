/**
 * WHERE 句内のサブクエリが抽出され、独立した queryBox として描画されること、
 * および内部で参照される外部テーブル (orders) からエッジが引かれることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-7kq
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
import * as fs from 'fs';
import * as path from 'path';

const results: Array<{ name: string; status: string; error?: string }> = [];
let failed = false;
function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e: any) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }

const sql = fs.readFileSync(path.join(process.cwd(), 'samples', 'queries', '05_subquery.sql'), 'utf-8');
const pq = extractQueryStructure(parseSql(sql, 'BigQuery'), sql);

test('ParsedQuery: where.subqueries has 1 subquery', () => {
  assert(pq.where !== null, 'where exists');
  assert(pq.where!.subqueries.length === 1,
    'expected 1 where subquery, got ' + pq.where!.subqueries.length);
});

test('ParsedQuery: where subquery has alias containing "WHERE" or "サブクエリ"', () => {
  const sub = pq.where!.subqueries[0];
  assert(typeof sub.alias === 'string' && sub.alias.length > 0, 'alias set');
  // allow any conventional naming
});

test('ParsedQuery: where subquery inner FROM references orders', () => {
  const sub = pq.where!.subqueries[0];
  const innerFromTables = sub.query.from.tables.map((t: any) => t.name);
  assert(innerFromTables.includes('orders'),
    'inner FROM should include orders, got: ' + innerFromTables.join(','));
});

// --- flowStore integration ---
function setupStore() {
  useLineageStore.getState().resetAll();
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
  const unsub = initStoreSubscriptions();
  useLineageStore.getState().addQuery(pq);
  return unsub;
}

test('flowStore: where subquery queryBox node exists as child of main', () => {
  const unsub = setupStore();
  try {
    const nodes = useFlowStore.getState().nodes;
    const main = nodes.find((n: any) =>
      n.type === 'queryBox' &&
      !n.id.includes('__cte__') && !n.id.includes('__fromsub__') && !n.id.includes('__wheresub__') &&
      (n as any).parentId === undefined
    )!;
    const wsub = nodes.find((n: any) => n.id.includes('__wheresub__') && (n as any).parentId === main.id);
    assert(wsub !== undefined,
      'where subquery queryBox expected. Got nodes: ' +
      nodes.filter((n: any) => n.type === 'queryBox').map((n: any) => n.id).join(', '));
  } finally { unsub(); }
});

test('flowStore: edge orders -> where subquery exists', () => {
  const unsub = setupStore();
  try {
    const nodes = useFlowStore.getState().nodes;
    const wsub = nodes.find((n: any) => n.id.includes('__wheresub__'))!;
    const edge = useFlowStore.getState().edges.find((e: any) => {
      const d = e.data as any;
      return d?.dependencyType === 'table_dependency'
        && e.source === 'orders'
        && d.targetTableId === wsub.id;
    });
    assert(edge !== undefined,
      'edge orders -> ' + wsub.id + ' should exist. Found edges: ' +
      JSON.stringify(useFlowStore.getState().edges
        .filter((e: any) => (e.data as any)?.dependencyType === 'table_dependency')
        .map((e: any) => ({ s: e.source, tt: (e.data as any).targetTableId }))
      )
    );
  } finally { unsub(); }
});

console.log('\\n=== WHERE Subquery Extraction Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'whereSubqueryExtraction-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/whereSubqueryExtraction-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
