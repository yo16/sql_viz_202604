/**
 * 複雑な WHERE/HAVING/JOIN 条件が `...` に潰されずに正しく整形されることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-hgg
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const FUNCTIONAL_TEST = `
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

function parse(file: string) {
  const sql = fs.readFileSync(path.join(process.cwd(), 'samples', 'queries', file), 'utf-8');
  return extractQueryStructure(parseSql(sql, 'BigQuery'), sql);
}

test('05_subquery: WHERE conditionText contains IN and subquery SELECT', () => {
  const pq = parse('05_subquery.sql');
  const where = pq.where!;
  assert(where !== null, 'where exists');
  const t = where.conditionText;
  assert(!/^\\.{3}$/.test(t), 'conditionText should not be just "..."');
  assert(t.toUpperCase().includes('IN'), 'conditionText should include IN: ' + t);
  assert(t.toUpperCase().includes('SELECT'),
    'conditionText should include subquery SELECT: ' + t);
  assert(t.includes('total_amount') || t.includes('5000'),
    'conditionText should reflect inner WHERE: ' + t);
});

test('05_subquery: simple WHERE expression is properly formatted', () => {
  // extra check: binary_expr with string literal still works
  const pq = parse('05_subquery.sql');
  const where = pq.where!;
  assert(where.conditionText.includes('user_id'), 'should mention user_id');
});

test('04_cte_with: HAVING / WHERE is still correctly formatted (regression)', () => {
  const pq = parse('04_cte_with.sql');
  // main WHERE: r.rank <= 10
  const mainWhere = pq.where;
  if (mainWhere) {
    assert(mainWhere.conditionText.toLowerCase().includes('rank'),
      'main WHERE should include rank: ' + mainWhere.conditionText);
  }
});

test('01_simple_select: WHERE still works (regression)', () => {
  const pq = parse('01_simple_select.sql');
  const where = pq.where;
  if (where) {
    assert(where.conditionText.includes('2024') || where.conditionText.includes('created_at'),
      'simple WHERE should contain date: ' + where.conditionText);
  }
});

console.log('\\n=== Where Condition Formatting Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'whereConditionFormatting-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/whereConditionFormatting-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
