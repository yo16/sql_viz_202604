/**
 * カラムクリック時に、上流・下流のリネージュチェーン上にあるすべてのカラム項目が
 * ハイライト対象 (highlightedColumns) に含まれることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-26k
 *
 * テストデータ:
 *   raw_users.user_name → stg_orders.user_name → mart_user_summary.user_name → rpt_high_value_users.user_name
 *
 * mart_user_summary.user_name をクリックしたとき:
 * - 上流: stg_orders.user_name がハイライト
 * - 下流: rpt_high_value_users.user_name がハイライト
 * - クリック自身: mart_user_summary.user_name もハイライト
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
  for (const file of ['06_lineage_step1_staging.sql', '07_lineage_step2_mart.sql', '08_lineage_step3_report.sql']) {
    const sql = fs.readFileSync(path.join(process.cwd(), 'samples', 'queries', file), 'utf-8');
    for (const stmt of splitStatements(sql)) {
      const ast = parseSql(stmt, 'BigQuery');
      useLineageStore.getState().addQuery(extractQueryStructure(ast, stmt));
    }
  }
  return unsub;
}

test('highlightedColumns exists in flowStore state', () => {
  const unsub = setup();
  try {
    const state = useFlowStore.getState() as any;
    // highlightedColumns が null (= 非ハイライト時) または Set であること
    assert(
      state.highlightedColumns === null || state.highlightedColumns instanceof Set,
      'highlightedColumns should be null or Set'
    );
  } finally { unsub(); }
});

test('clicking mart_user_summary.user_name highlights stg_orders.user_name (upstream)', () => {
  const unsub = setup();
  try {
    useFlowStore.getState().highlightLineage('mart_user_summary', 'user_name');
    const hc = (useFlowStore.getState() as any).highlightedColumns as Set<string> | null;
    assert(hc !== null, 'highlightedColumns should not be null after highlight');
    assert(hc!.has('stg_orders:user_name'),
      'stg_orders:user_name should be highlighted. Got: ' + Array.from(hc!).join(', '));
  } finally { unsub(); }
});

test('clicking mart_user_summary.user_name highlights rpt_high_value_users.user_name (downstream)', () => {
  const unsub = setup();
  try {
    useFlowStore.getState().highlightLineage('mart_user_summary', 'user_name');
    const hc = (useFlowStore.getState() as any).highlightedColumns as Set<string> | null;
    assert(hc !== null, 'highlightedColumns not null');
    assert(hc!.has('rpt_high_value_users:user_name'),
      'rpt_high_value_users:user_name should be highlighted. Got: ' + Array.from(hc!).join(', '));
  } finally { unsub(); }
});

test('clicking mart_user_summary.user_name also highlights itself', () => {
  const unsub = setup();
  try {
    useFlowStore.getState().highlightLineage('mart_user_summary', 'user_name');
    const hc = (useFlowStore.getState() as any).highlightedColumns as Set<string> | null;
    assert(hc!.has('mart_user_summary:user_name'),
      'clicked column itself should be highlighted');
  } finally { unsub(); }
});

test('clearHighlight resets highlightedColumns to null', () => {
  const unsub = setup();
  try {
    useFlowStore.getState().highlightLineage('mart_user_summary', 'user_name');
    useFlowStore.getState().clearHighlight();
    const hc = (useFlowStore.getState() as any).highlightedColumns;
    assert(hc === null, 'highlightedColumns should be null after clear');
  } finally { unsub(); }
});

test('ColumnItemNode isHighlighted check uses highlightedColumns', () => {
  // ColumnItemNode.tsx が highlightedColumns を参照していることを構造的に確認
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'visualizer', 'nodes', 'ColumnItemNode.tsx'),
    'utf-8'
  );
  assert(src.includes('highlightedColumns'),
    'ColumnItemNode.tsx should reference highlightedColumns');
});

console.log('\\n=== Lineage Highlight All Columns Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'lineageHighlightAllColumns-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/lineageHighlightAllColumns-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
