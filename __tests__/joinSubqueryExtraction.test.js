/**
 * JOIN サブクエリが subqueries と joins の両方に記録され、
 * メインクエリの dependsOn・FROM ラベル・エッジが正しく構築されることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-ih7
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

test('ParsedQuery: recent is in from.subqueries', () => {
  assert(pq.from.subqueries.some((s: any) => s.alias === 'recent'),
    'recent should be in from.subqueries');
});

test('ParsedQuery: recent is ALSO in from.joins (bd-ih7)', () => {
  const rec = pq.from.joins.find((j: any) => j.table === 'recent' || j.alias === 'recent');
  assert(rec !== undefined,
    'recent should be in from.joins. Got joins: ' + JSON.stringify(pq.from.joins));
  assert(rec.joinType === 'INNER', 'joinType should be INNER');
});

test('ParsedQuery: recent JOIN has onConditionText containing user_id', () => {
  const rec = pq.from.joins.find((j: any) => j.table === 'recent' || j.alias === 'recent');
  assert(rec !== undefined, 'recent join exists');
  assert(rec.onConditionText.includes('user_id'),
    'onConditionText should include user_id, got: ' + rec.onConditionText);
});

// --- flowStore integration ---
test('flowStore: main query depends on recent (edge exists)', () => {
  useLineageStore.getState().resetAll();
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
  const unsub = initStoreSubscriptions();
  try {
    useLineageStore.getState().addQuery(pq);
    const nodes = useFlowStore.getState().nodes;
    const main = nodes.find((n: any) =>
      n.type === 'queryBox' && !n.id.includes('__fromsub__') && (n as any).parentId === undefined
    )!;
    const recentSub = nodes.find((n: any) => n.id.endsWith('__fromsub__recent'))!;
    assert(recentSub !== undefined, 'recent fromSub node exists');

    const edge = useFlowStore.getState().edges.find((e: any) => {
      const d = e.data as any;
      return d?.dependencyType === 'table_dependency'
        && e.source === recentSub.id
        && d.targetTableId === main.id;
    });
    assert(edge !== undefined,
      'edge recent fromSub -> main should exist. Found table_dependency edges: ' +
      JSON.stringify(useFlowStore.getState().edges
        .filter((e: any) => (e.data as any)?.dependencyType === 'table_dependency')
        .map((e: any) => ({ s: e.source, tt: (e.data as any).targetTableId }))
      ));
  } finally { unsub(); }
});

test('flowStore: main FROM clauseBox label includes INNER JOIN recent', () => {
  useLineageStore.getState().resetAll();
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
  const unsub = initStoreSubscriptions();
  try {
    useLineageStore.getState().addQuery(pq);
    const nodes = useFlowStore.getState().nodes;
    const main = nodes.find((n: any) =>
      n.type === 'queryBox' && !n.id.includes('__fromsub__') && (n as any).parentId === undefined
    )!;
    const fromClause = nodes.find((n: any) => n.id === main.id + '__clause__FROM');
    assert(fromClause !== undefined, 'FROM clauseBox exists');
    const label = (fromClause!.data as any).label as string;
    assert(label.includes('INNER'), 'FROM label should include INNER, got: ' + label);
    assert(label.includes('recent'), 'FROM label should include recent, got: ' + label);
  } finally { unsub(); }
});

console.log('\\n=== Join Subquery Extraction Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'joinSubqueryExtraction-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/joinSubqueryExtraction-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
