/**
 * CTE / サブクエリ内部の FROM 参照も unresolved として global tables に登録されることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-uqr
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const FUNCTIONAL_TEST = `
import { buildLineageGraph } from '../src/lib/lineage/buildLineageGraph';
import { parseSql, splitStatements } from '../src/lib/parser/sqlParser';
import { extractQueryStructure } from '../src/lib/parser/astExtractor';
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
const tables = buildLineageGraph(queries);

test('orders (referenced from monthly_sales CTE) IS in global tables as unresolved', () => {
  const t = tables.get('orders');
  assert(t !== undefined, 'orders should be in global tables');
  assert(t!.isRegistered === false, 'orders should be unresolved');
  assert(t!.queryType === 'unresolved', 'orders queryType should be unresolved');
});

test('users (genuinely unresolved in main query) IS still in tables', () => {
  const t = tables.get('users');
  assert(t !== undefined, 'users should still be in tables');
  assert(t!.isRegistered === false, 'users should be unresolved');
});

test('monthly_sales (CTE name referenced from ranked_users) is still NOT in global tables', () => {
  // ranked_users の FROM は monthly_sales (同じスコープの sibling CTE) なので skip
  assert(!tables.has('monthly_sales'),
    'monthly_sales is a sibling CTE, should not be added as unresolved');
});

test('ranked_users (CTE name referenced from main query) is still NOT in global tables', () => {
  // main query の FROM ranked_users は自クエリの CTE 名なので skip
  assert(!tables.has('ranked_users'),
    'ranked_users is own CTE, should not be added as unresolved');
});

console.log('\\n=== CTE Inner FROM Ref Unresolved Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'cteInnerFromRefUnresolved-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/cteInnerFromRefUnresolved-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
  const stdout = out.toString();
  console.log(stdout);
  if (stdout.includes('FAIL:')) process.exit(1);
} catch (e) {
  const stdout = e.stdout ? e.stdout.toString() : '';
  const stderr = e.stderr ? e.stderr.toString() : '';
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr.slice(0, 600));
  process.exit(1);
} finally {
  try { fs.unlinkSync(tmpFile); } catch {}
}
