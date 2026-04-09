/**
 * メインクエリが自分の CTE を FROM で参照する場合、
 * CTE → main query のエッジが生成されることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-icu
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

function setup() {
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

test('edge exists: ranked_users CTE -> main query', () => {
  const unsub = setup();
  try {
    const nodes = useFlowStore.getState().nodes;
    const main = nodes.find((n: any) =>
      n.type === 'queryBox' && !n.id.includes('__cte__') && (n as any).parentId === undefined
    )!;
    const rankedCte = nodes.find((n: any) => n.id.endsWith('__cte__ranked_users'))!;
    const edge = useFlowStore.getState().edges.find((e: any) => {
      const d = e.data as any;
      return d?.dependencyType === 'table_dependency'
        && e.source === rankedCte.id
        && d.targetTableId === main.id;
    });
    assert(edge !== undefined,
      'edge ' + rankedCte.id + ' -> ' + main.id + ' should exist. Found table_dependency edges: ' +
      JSON.stringify(useFlowStore.getState().edges
        .filter((e: any) => (e.data as any)?.dependencyType === 'table_dependency')
        .map((e: any) => ({ s: e.source, tt: (e.data as any).targetTableId }))
      )
    );
  } finally { unsub(); }
});

test('edge exists: users (unresolved) -> main query (top-level regular dep)', () => {
  const unsub = setup();
  try {
    const nodes = useFlowStore.getState().nodes;
    const main = nodes.find((n: any) =>
      n.type === 'queryBox' && !n.id.includes('__cte__') && (n as any).parentId === undefined
    )!;
    const edge = useFlowStore.getState().edges.find((e: any) => {
      const d = e.data as any;
      return d?.dependencyType === 'table_dependency'
        && e.source === 'users'
        && d.targetTableId === main.id;
    });
    assert(edge !== undefined, 'users -> main edge should still exist');
  } finally { unsub(); }
});

test('no duplicate edges for ranked_users -> main', () => {
  const unsub = setup();
  try {
    const nodes = useFlowStore.getState().nodes;
    const main = nodes.find((n: any) =>
      n.type === 'queryBox' && !n.id.includes('__cte__') && (n as any).parentId === undefined
    )!;
    const rankedCte = nodes.find((n: any) => n.id.endsWith('__cte__ranked_users'))!;
    const matches = useFlowStore.getState().edges.filter((e: any) => {
      const d = e.data as any;
      return d?.dependencyType === 'table_dependency'
        && e.source === rankedCte.id
        && d.targetTableId === main.id;
    });
    assert(matches.length === 1, 'should have exactly 1 edge, got ' + matches.length);
  } finally { unsub(); }
});

console.log('\\n=== CTE -> Main Edge Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'cteToMainEdge-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/cteToMainEdge-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
