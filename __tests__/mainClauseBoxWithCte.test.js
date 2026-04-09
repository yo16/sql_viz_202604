/**
 * CTEやサブクエリを持つクエリでも、メインの SELECT/FROM/WHERE clauseBox が
 * 生成されることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-u8l
 *
 * 修正前: buildQueryBoxNodes の detail 分岐が ctes.length === 0 で短絡し、
 *         CTE持ちクエリには main clauseBox が作られない
 * 修正後: CTE/サブクエリの有無に関わらず、detail モードなら main SELECT/FROM/WHERE
 *         clauseBox を生成し、位置はネスト子の下に配置する
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
    const parsed = extractQueryStructure(ast, stmt);
    useLineageStore.getState().addQuery(parsed);
  }
  return unsub;
}

test('main SELECT clauseBox exists for CTE-holder query', () => {
  const unsub = setup();
  try {
    const nodes = useFlowStore.getState().nodes;
    // CTE を持つトップレベル query = ルート queryBox のうち id に __cte__ を含まないもの
    const topQuery = nodes.find((n: any) =>
      n.type === 'queryBox' && !n.id.includes('__cte__') && (n as any).parentId === undefined
    )!;
    assert(topQuery !== undefined, 'top-level CTE query not found');
    const mainSelectId = topQuery.id + '__clause__SELECT';
    const mainSelect = nodes.find((n: any) => n.id === mainSelectId);
    assert(mainSelect !== undefined, 'main SELECT clauseBox missing: ' + mainSelectId);
    assert((mainSelect as any).parentId === topQuery.id, 'main SELECT parentId mismatch');
  } finally { unsub(); }
});

test('main FROM clauseBox exists and references ranked_users + users JOIN', () => {
  const unsub = setup();
  try {
    const nodes = useFlowStore.getState().nodes;
    const topQuery = nodes.find((n: any) =>
      n.type === 'queryBox' && !n.id.includes('__cte__') && (n as any).parentId === undefined
    )!;
    const mainFromId = topQuery.id + '__clause__FROM';
    const mainFrom = nodes.find((n: any) => n.id === mainFromId);
    assert(mainFrom !== undefined, 'main FROM clauseBox missing');
    const label = (mainFrom!.data as any).label as string;
    assert(label.includes('ranked_users'), 'FROM label should include ranked_users, got: ' + label);
    assert(label.includes('users'), 'FROM label should include users, got: ' + label);
  } finally { unsub(); }
});

test('main WHERE clauseBox exists', () => {
  const unsub = setup();
  try {
    const nodes = useFlowStore.getState().nodes;
    const topQuery = nodes.find((n: any) =>
      n.type === 'queryBox' && !n.id.includes('__cte__') && (n as any).parentId === undefined
    )!;
    const mainWhere = nodes.find((n: any) => n.id === topQuery.id + '__clause__WHERE');
    assert(mainWhere !== undefined, 'main WHERE clauseBox missing');
    const label = (mainWhere!.data as any).label as string;
    assert(label.includes('rank'), 'WHERE label should reference rank, got: ' + label);
  } finally { unsub(); }
});

test('main clauseBoxes are positioned to the RIGHT of CTE children (bd-hk1)', () => {
  const unsub = setup();
  try {
    const nodes = useFlowStore.getState().nodes;
    const topQuery = nodes.find((n: any) =>
      n.type === 'queryBox' && !n.id.includes('__cte__') && (n as any).parentId === undefined
    )!;
    const cteChildren = nodes.filter((n: any) =>
      (n as any).parentId === topQuery.id && n.type === 'queryBox'
    );
    assert(cteChildren.length === 2, 'should have 2 CTE children, got ' + cteChildren.length);
    const cteMaxRight = Math.max(...cteChildren.map((n: any) => {
      const w = n.width ?? n.measured?.width ?? 220;
      return n.position.x + w;
    }));
    const mainSelect = nodes.find((n: any) => n.id === topQuery.id + '__clause__SELECT')!;
    // bd-hk1: main clauseBox は CTE 子の「下」ではなく「右」に配置される
    assert(mainSelect.position.x >= cteMaxRight,
      'main SELECT x (' + mainSelect.position.x + ') should be >= CTE right (' + cteMaxRight + ')');
  } finally { unsub(); }
});

test('CTE inner clauseBoxes still exist (regression from 2ml)', () => {
  const unsub = setup();
  try {
    const nodes = useFlowStore.getState().nodes;
    const cteBoxes = nodes.filter((n: any) => n.type === 'queryBox' && n.id.includes('__cte__'));
    assert(cteBoxes.length === 2, 'should have 2 CTE inner queryBoxes');
    for (const cte of cteBoxes) {
      const sel = nodes.find((n: any) => n.id === cte.id + '__clause__SELECT');
      assert(sel !== undefined, 'CTE inner SELECT missing for ' + cte.id);
    }
  } finally { unsub(); }
});

console.log('\\n=== Main Clause Box with CTE Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'mainClauseBoxWithCte-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/mainClauseBoxWithCte-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
