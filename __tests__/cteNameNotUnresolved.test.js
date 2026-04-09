/**
 * CTE 名が未登録テーブル扱いされないことを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-r11
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

test('CTE name "monthly_sales" is NOT in global tables map', () => {
  assert(!tables.has('monthly_sales'),
    'monthly_sales should not be in global tables, but found: ' +
    (tables.get('monthly_sales') as any)?.queryType);
});

test('CTE name "ranked_users" is NOT in global tables map', () => {
  assert(!tables.has('ranked_users'),
    'ranked_users should not be in global tables, but found: ' +
    (tables.get('ranked_users') as any)?.queryType);
});

test('genuinely unresolved "users" IS in global tables as unresolved', () => {
  const t = tables.get('users');
  assert(t !== undefined, 'users should be in tables');
  assert(t!.isRegistered === false, 'users should be unregistered');
  assert(t!.queryType === 'unresolved', 'users queryType should be unresolved');
});

test('main query is in global tables as registered CTE-holder', () => {
  const holders = Array.from(tables.values()).filter((t: any) =>
    t.isRegistered && t.ctes.length === 2
  );
  assert(holders.length === 1, 'exactly 1 CTE-holder main query should exist');
});

console.log('\\n=== CTE Name Not Unresolved Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'cteNameNotUnresolved-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/cteNameNotUnresolved-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
