/**
 * 親 QueryBox 内のネスト要素 (CTE / FROMサブクエリ / WHEREサブクエリ) を
 * 依存順で左→右に並べることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-47d
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

function setup(file: string) {
  useLineageStore.getState().resetAll();
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
  const unsub = initStoreSubscriptions();
  const sql = fs.readFileSync(path.join(process.cwd(), 'samples', 'queries', file), 'utf-8');
  for (const stmt of splitStatements(sql)) {
    const ast = parseSql(stmt, 'BigQuery');
    useLineageStore.getState().addQuery(extractQueryStructure(ast, stmt));
  }
  return unsub;
}

test('04_cte_with: monthly_sales is left of ranked_users', () => {
  const unsub = setup('04_cte_with.sql');
  try {
    const nodes = useFlowStore.getState().nodes;
    const monthly = nodes.find((n: any) => n.id.endsWith('__cte__monthly_sales'))!;
    const ranked = nodes.find((n: any) => n.id.endsWith('__cte__ranked_users'))!;
    assert(monthly !== undefined, 'monthly_sales CTE not found');
    assert(ranked !== undefined, 'ranked_users CTE not found');
    assert(monthly.position.x < ranked.position.x,
      'monthly_sales.x (' + monthly.position.x + ') should be < ranked_users.x (' + ranked.position.x + ')');
  } finally { unsub(); }
});

test('04_cte_with: CTE children do not overlap (distinct x)', () => {
  const unsub = setup('04_cte_with.sql');
  try {
    const nodes = useFlowStore.getState().nodes;
    const cteNodes = nodes.filter((n: any) => n.type === 'queryBox' && n.id.includes('__cte__'));
    assert(cteNodes.length === 2, 'should have 2 CTE nodes');
    const xs = cteNodes.map((n: any) => n.position.x).sort((a: number, b: number) => a - b);
    // 重ならない: 2つのxが異なる
    assert(xs[0] !== xs[1], 'CTE children should have distinct x positions');
    // 左側のCTEの右端が右側のCTEの左端よりも左にある
    const left = cteNodes.find((n: any) => n.position.x === xs[0])!;
    const right = cteNodes.find((n: any) => n.position.x === xs[1])!;
    const leftWidth = left.width ?? 220;
    assert(left.position.x + leftWidth <= right.position.x,
      'left CTE right edge should be <= right CTE left edge: ' +
      (left.position.x + leftWidth) + ' <= ' + right.position.x);
  } finally { unsub(); }
});

test('04_cte_with: main clauseBoxes still positioned below CTE children', () => {
  const unsub = setup('04_cte_with.sql');
  try {
    const nodes = useFlowStore.getState().nodes;
    const top = nodes.find((n: any) =>
      n.type === 'queryBox' && !n.id.includes('__cte__') && (n as any).parentId === undefined
    )!;
    const cteNodes = nodes.filter((n: any) => (n as any).parentId === top.id && n.type === 'queryBox');
    const cteMaxBottom = Math.max(...cteNodes.map((n: any) => {
      const h = n.height ?? n.measured?.height ?? 80;
      return n.position.y + h;
    }));
    const mainSelect = nodes.find((n: any) => n.id === top.id + '__clause__SELECT')!;
    assert(mainSelect.position.y >= cteMaxBottom,
      'main SELECT should be below CTE children');
  } finally { unsub(); }
});

console.log('\\n=== Nested Child Ordering Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'nestedChildOrdering-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/nestedChildOrdering-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
