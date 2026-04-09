/**
 * CTE / サブクエリ内部の TableNode に displayTitle として CTE 名・エイリアス名が
 * 設定されることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-9rp
 *
 * 修正前: createTableNode は displayTitle = '[問い合わせ]' で固定（targetTable が null のため）
 * 修正後: 親側で CTE 名 / fromSub.alias を上書きする
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

test('top-level query has CTEs', () => {
  const top = Array.from(tables.values()).find((t: any) => t.ctes.length === 2)!;
  assert(top !== undefined, 'top-level CTE-holder not found');
});

test('CTE inner monthly_sales has displayTitle = "monthly_sales"', () => {
  const top = Array.from(tables.values()).find((t: any) => t.ctes.length === 2)!;
  const ms = top.ctes.find((c: any) => c.name === 'monthly_sales')!;
  assert(ms.tableNode.displayTitle === 'monthly_sales',
    'expected displayTitle "monthly_sales", got: ' + ms.tableNode.displayTitle);
});

test('CTE inner ranked_users has displayTitle = "ranked_users"', () => {
  const top = Array.from(tables.values()).find((t: any) => t.ctes.length === 2)!;
  const ru = top.ctes.find((c: any) => c.name === 'ranked_users')!;
  assert(ru.tableNode.displayTitle === 'ranked_users',
    'expected "ranked_users", got: ' + ru.tableNode.displayTitle);
});

test('top-level main query keeps "[問い合わせ]" displayTitle', () => {
  const top = Array.from(tables.values()).find((t: any) => t.ctes.length === 2)!;
  assert(top.displayTitle === '[問い合わせ]',
    'top-level should be "[問い合わせ]", got: ' + top.displayTitle);
});

console.log('\\n=== CTE Display Title Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'cteDisplayTitle-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/cteDisplayTitle-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
