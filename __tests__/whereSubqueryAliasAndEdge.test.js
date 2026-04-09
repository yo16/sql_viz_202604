/**
 * WHERE conditionText のサブクエリ部分が alias に置換され、
 * WHERE サブクエリから本体 WHERE clauseBox へのエッジが生成されることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-hnw
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

// --- conditionText alias substitution ---
test('WHERE conditionText contains the subquery alias [WHERE サブクエリ 1]', () => {
  const t = pq.where!.conditionText;
  assert(t.includes('[WHERE サブクエリ 1]'),
    'expected alias in conditionText, got: ' + t);
});

test('WHERE conditionText does NOT contain raw SELECT of subquery', () => {
  const t = pq.where!.conditionText;
  // Raw subquery body reference
  assert(!/SELECT\\s+DISTINCT/i.test(t),
    'conditionText should not contain raw SELECT DISTINCT, got: ' + t);
});

test('WHERE conditionText still contains IN operator and u.user_id', () => {
  const t = pq.where!.conditionText;
  assert(t.includes('user_id'), 'conditionText should mention user_id: ' + t);
  assert(/IN/i.test(t), 'conditionText should include IN: ' + t);
});

// --- flowStore integration ---
function setupStore() {
  useLineageStore.getState().resetAll();
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
  const unsub = initStoreSubscriptions();
  useLineageStore.getState().addQuery(pq);
  return unsub;
}

test('flowStore: edge exists from WHERE sub to main WHERE clauseBox', () => {
  const unsub = setupStore();
  try {
    const nodes = useFlowStore.getState().nodes;
    const main = nodes.find((n: any) =>
      n.type === 'queryBox' &&
      !n.id.includes('__cte__') && !n.id.includes('__fromsub__') && !n.id.includes('__wheresub__') &&
      (n as any).parentId === undefined
    )!;
    const wsub = nodes.find((n: any) => n.id.includes('__wheresub__'))!;
    assert(wsub !== undefined, 'where sub node exists');

    // edge with targetClauseType = 'WHERE', targetTableId = main.id, source = wsub.id
    const edge = useFlowStore.getState().edges.find((e: any) => {
      const d = e.data as any;
      return d?.dependencyType === 'table_dependency'
        && e.source === wsub.id
        && d.targetTableId === main.id
        && d.targetClauseType === 'WHERE';
    });
    assert(edge !== undefined,
      'edge where-sub -> main (WHERE) should exist. Found edges: ' +
      JSON.stringify(useFlowStore.getState().edges
        .filter((e: any) => (e.data as any)?.dependencyType === 'table_dependency')
        .map((e: any) => ({ s: e.source, t: e.target, tct: (e.data as any).targetClauseType }))
      ));
  } finally { unsub(); }
});

test('flowStore: detail mode retargets edge to WHERE clauseBox node', () => {
  const unsub = setupStore();
  try {
    const nodes = useFlowStore.getState().nodes;
    const main = nodes.find((n: any) =>
      n.type === 'queryBox' &&
      !n.id.includes('__cte__') && !n.id.includes('__fromsub__') && !n.id.includes('__wheresub__') &&
      (n as any).parentId === undefined
    )!;
    const wsub = nodes.find((n: any) => n.id.includes('__wheresub__'))!;
    const edge = useFlowStore.getState().edges.find((e: any) => {
      const d = e.data as any;
      return d?.dependencyType === 'table_dependency'
        && e.source === wsub.id
        && d.targetClauseType === 'WHERE';
    });
    assert(edge.target === main.id + '__clause__WHERE',
      'detail mode: edge.target should be WHERE clauseBox, got: ' + edge.target);
  } finally { unsub(); }
});

test('flowStore: compact mode retargets edge to main QueryBox', () => {
  const unsub = setupStore();
  try {
    const main = useFlowStore.getState().nodes.find((n: any) =>
      n.type === 'queryBox' &&
      !n.id.includes('__cte__') && !n.id.includes('__fromsub__') && !n.id.includes('__wheresub__') &&
      (n as any).parentId === undefined
    )!;
    useFlowStore.getState().toggleDisplayMode(main.id); // -> compact
    const wsub = useFlowStore.getState().nodes.find((n: any) => n.id.includes('__wheresub__'))!;
    const edge = useFlowStore.getState().edges.find((e: any) => {
      const d = e.data as any;
      return d?.dependencyType === 'table_dependency'
        && e.source === wsub.id
        && d.targetClauseType === 'WHERE';
    });
    assert(edge.target === main.id,
      'compact mode: edge.target should revert to main QueryBox, got: ' + edge.target);
  } finally { unsub(); }
});

console.log('\\n=== WHERE Subquery Alias and Edge Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'whereSubqueryAliasAndEdge-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/whereSubqueryAliasAndEdge-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
