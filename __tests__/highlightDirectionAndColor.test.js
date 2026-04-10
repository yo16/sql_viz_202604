/**
 * ハイライトアニメ方向がトリガーから外向き + 赤み強調色を検証する。
 * 対応Beadsタスク: sql_viz_202604_2-2vk
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// --- Structure tests ---
const edgeCss = fs.readFileSync(path.join(ROOT, 'src/components/visualizer/edges/LineageEdge.module.css'), 'utf-8');
const edgeTsx = fs.readFileSync(path.join(ROOT, 'src/components/visualizer/edges/LineageEdge.tsx'), 'utf-8');
const varsCss = fs.readFileSync(path.join(ROOT, 'src/styles/variables.css'), 'utf-8');

const results = [];
let failed = false;
function test(name, fn) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

test('CSS has upstream animation class', () => {
  assert(/upstream/i.test(edgeCss), 'CSS should have upstream class');
});

test('CSS has downstream animation class', () => {
  assert(/downstream/i.test(edgeCss), 'CSS should have downstream class');
});

test('LineageEdge.tsx reads highlightDirection from edge data', () => {
  assert(edgeTsx.includes('highlightDirection') || edgeTsx.includes('Direction'),
    'component should read highlightDirection');
});

test('--color-highlight is red-shifted (not pure orange #f59e0b)', () => {
  // extract --color-highlight value
  const match = varsCss.match(/--color-highlight:\s*([^;]+);/);
  assert(match, '--color-highlight not found');
  const val = match[1].trim().toLowerCase();
  assert(val !== '#f59e0b', '--color-highlight should not be pure orange, got: ' + val);
});

test('--color-edge-highlighted is red-shifted (not blue #2563eb)', () => {
  const match = varsCss.match(/--color-edge-highlighted:\s*([^;]+);/);
  assert(match, '--color-edge-highlighted not found');
  const val = match[1].trim().toLowerCase();
  assert(val !== '#2563eb', '--color-edge-highlighted should not be blue, got: ' + val);
});

// --- Functional: highlightDirection in edge data ---
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
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null, highlightedColumns: null });
  const unsub = initStoreSubscriptions();
  for (const file of ['06_lineage_step1_staging.sql', '07_lineage_step2_mart.sql', '08_lineage_step3_report.sql']) {
    const sql = fs.readFileSync(path.join(process.cwd(), 'samples', 'queries', file), 'utf-8');
    for (const stmt of splitStatements(sql)) {
      const ast = parseSql(stmt, 'BigQuery');
      useLineageStore.getState().addQuery(extractQueryStructure(ast, stmt));
    }
  }
  return unsub;
}

test('upstream edges have highlightDirection = upstream', () => {
  const unsub = setup();
  try {
    useFlowStore.getState().highlightLineage('mart_user_summary', 'user_name');
    // stg_orders -> mart is upstream (stg_orders.user_name → mart.user_name)
    const upstreamEdge = useFlowStore.getState().edges.find((e: any) => {
      const d = e.data as any;
      return d?.isHighlighted && d?.highlightDirection === 'upstream';
    });
    assert(upstreamEdge !== undefined, 'should have at least one upstream highlighted edge');
  } finally { unsub(); }
});

test('downstream edges have highlightDirection = downstream', () => {
  const unsub = setup();
  try {
    useFlowStore.getState().highlightLineage('mart_user_summary', 'user_name');
    const downstreamEdge = useFlowStore.getState().edges.find((e: any) => {
      const d = e.data as any;
      return d?.isHighlighted && d?.highlightDirection === 'downstream';
    });
    assert(downstreamEdge !== undefined, 'should have at least one downstream highlighted edge');
  } finally { unsub(); }
});

console.log('\\n=== Highlight Direction Functional Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('functional: highlightDirection in edge data (via tsx)', () => {
  const tmpDir = path.join(ROOT, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, 'highlightDirection-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const out = execSync('npx tsx tmp/highlightDirection-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    const stdout = out.toString();
    console.log(stdout);
    if (stdout.includes('FAIL:')) throw new Error('failed');
  } catch (e) {
    const stdout = e.stdout ? e.stdout.toString() : '';
    if (stdout) console.log(stdout);
    throw new Error('Failed: ' + (e.stderr ? e.stderr.toString().slice(0, 600) : e.message));
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
});

console.log('\n=== Highlight Direction & Color Tests ===\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\n  ' + pc + '/' + results.length + ' tests passed\n');
process.exit(failed ? 1 : 0);
