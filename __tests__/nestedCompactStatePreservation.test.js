/**
 * 外側 QueryBox を開閉しても、内側の compact 状態が保持されることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-8dp
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

function getTopQueryBoxId(): string {
  const top = useFlowStore.getState().nodes.find((n: any) =>
    n.type === 'queryBox' && !n.id.includes('__cte__') && (n as any).parentId === undefined
  )!;
  return top.id;
}

function getMonthlyCteId(): string {
  return useFlowStore.getState().nodes.find(
    (n: any) => n.id.endsWith('__cte__monthly_sales')
  )!.id;
}

test('scenario: outer detail -> inner compact -> outer compact -> outer detail: inner stays compact', () => {
  const unsub = setup();
  try {
    const outerId = getTopQueryBoxId();
    const innerCteId = getMonthlyCteId();
    const store = useFlowStore.getState();

    // Step 1: 内側 CTE (monthly_sales) を compact に切替
    store.toggleDisplayMode(innerCteId);
    assert(
      useFlowStore.getState().displayModes.get(innerCteId) === 'compact',
      'inner CTE should be compact'
    );
    // 内側の SELECT clauseBox は hidden のはず
    const innerClauseBefore = useFlowStore.getState().nodes.find((n: any) =>
      n.id === innerCteId + '__clause__SELECT'
    )!;
    assert((innerClauseBefore as any).hidden === true,
      'inner SELECT clauseBox should be hidden when inner CTE is compact');

    // Step 2: 外側を compact に切替
    useFlowStore.getState().toggleDisplayMode(outerId);
    assert(useFlowStore.getState().displayModes.get(outerId) === 'compact',
      'outer should be compact');

    // Step 3: 外側を detail に戻す
    useFlowStore.getState().toggleDisplayMode(outerId);
    assert(useFlowStore.getState().displayModes.get(outerId) === 'detail',
      'outer should be back to detail');

    // 検証: 内側 CTE の displayMode が compact のまま保持されている
    assert(
      useFlowStore.getState().displayModes.get(innerCteId) === 'compact',
      'inner CTE displayMode should STILL be compact, got: ' +
        useFlowStore.getState().displayModes.get(innerCteId)
    );

    // 検証: 内側 CTE の SELECT clauseBox は hidden のまま（内側が compact なので）
    const innerClauseAfter = useFlowStore.getState().nodes.find((n: any) =>
      n.id === innerCteId + '__clause__SELECT'
    )!;
    assert((innerClauseAfter as any).hidden === true,
      'inner SELECT clauseBox should still be hidden (inner is still compact). got hidden=' +
      (innerClauseAfter as any).hidden);
  } finally { unsub(); }
});

test('outer detail unhides own direct clauseBoxes but respects inner compact', () => {
  const unsub = setup();
  try {
    const outerId = getTopQueryBoxId();
    const innerCteId = getMonthlyCteId();

    // 内側 compact
    useFlowStore.getState().toggleDisplayMode(innerCteId);
    // 外側 compact -> detail
    useFlowStore.getState().toggleDisplayMode(outerId);
    useFlowStore.getState().toggleDisplayMode(outerId);

    // 外側の main SELECT clauseBox (= outerId の子) は visible のはず
    const outerMainSelect = useFlowStore.getState().nodes.find((n: any) =>
      n.id === outerId + '__clause__SELECT'
    )!;
    assert(outerMainSelect !== undefined, 'outer main SELECT exists');
    assert(
      (outerMainSelect as any).hidden !== true,
      'outer main SELECT should be visible (outer is detail), got hidden=' + (outerMainSelect as any).hidden
    );

    // 内側 CTE queryBox 自体は visible
    const innerCteNode = useFlowStore.getState().nodes.find((n: any) => n.id === innerCteId)!;
    assert((innerCteNode as any).hidden !== true,
      'inner CTE queryBox itself should be visible (outer is detail)');
  } finally { unsub(); }
});

test('simple toggle: outer compact then detail with no inner changes restores visible state', () => {
  const unsub = setup();
  try {
    const outerId = getTopQueryBoxId();

    // 初期状態: すべて detail
    useFlowStore.getState().toggleDisplayMode(outerId); // detail -> compact
    useFlowStore.getState().toggleDisplayMode(outerId); // compact -> detail

    // 外側 main SELECT 表示される
    const mainSelect = useFlowStore.getState().nodes.find((n: any) =>
      n.id === outerId + '__clause__SELECT'
    )!;
    assert((mainSelect as any).hidden !== true, 'main SELECT visible after outer toggle cycle');
  } finally { unsub(); }
});

console.log('\\n=== Nested Compact State Preservation Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'nestedCompactStatePreservation-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/nestedCompactStatePreservation-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
