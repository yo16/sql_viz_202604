/**
 * flowStore の syncFromLineage がルートレベルのテーブルノードに対して
 * 左→右フローレイアウトを適用し、ノードが重ならないことを検証する統合テスト。
 *
 * 対応Beadsタスク: sql_viz_202604_2-z0e
 *
 * 検証項目:
 *   1. 複数のルートテーブルが同一座標 (0,0) に重ならない（position が分離されている）
 *   2. 依存エッジ A→B がある場合、A.x < B.x である（左→右フロー）
 *   3. 3段のチェイン A→B→C で x 座標が厳密に増加する
 *
 * このテストは `arrangeTableNodes()` が syncFromLineage 内で呼ばれていない
 * 現状の実装では FAIL する（Redフェーズ）。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const results = [];
let failed = false;

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'PASS' });
  } catch (e) {
    results.push({ name, status: 'FAIL', error: e.message });
    failed = true;
  }
}

const FUNCTIONAL_TEST = `
import { useFlowStore } from '../src/stores/flowStore';
import type { TableNode } from '../src/types/lineage';

const results: Array<{ name: string; status: string; error?: string }> = [];
let failed = false;
function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e: any) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

function makeTable(id: string, overrides: Partial<TableNode> = {}): TableNode {
  return {
    id, name: id, displayTitle: id, isRegistered: true, queryType: 'ctas',
    queryId: id, columns: new Map(), dependsOn: new Set(),
    ctes: [], fromSubqueries: [], whereSubqueries: [],
    clauses: { select: { columns: [] }, from: { tables: [], joins: [] }, where: null, groupBy: null, having: null, orderBy: null },
    ...overrides,
  };
}

function reset() {
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
}

// 親ノード（ルートレベルのテーブルbox）のみ抽出するヘルパ
function rootNodes() {
  return useFlowStore.getState().nodes.filter((n: any) => n.parentId === undefined);
}

// --- Red 1: 2つの独立したルートテーブルが重ならない ---
test('layout: two independent root tables do not overlap', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('a', makeTable('a'));
  tables.set('b', makeTable('b'));
  useFlowStore.getState().syncFromLineage(tables);

  const roots = rootNodes();
  assert(roots.length === 2, 'expected 2 root nodes, got ' + roots.length);
  const a = roots.find((n: any) => n.id === 'a')!;
  const b = roots.find((n: any) => n.id === 'b')!;
  // position が同一 (両方 {0,0}) の場合は重なり状態
  const sameX = a.position.x === b.position.x;
  const sameY = a.position.y === b.position.y;
  assert(!(sameX && sameY), 'root tables overlap at same position: a=' + JSON.stringify(a.position) + ' b=' + JSON.stringify(b.position));
});

// --- Red 2: A→B の依存がある場合 A が左、B が右 ---
test('layout: dependency A->B places A to the left of B', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('a', makeTable('a'));
  tables.set('b', makeTable('b', { dependsOn: new Set(['a']) }));
  useFlowStore.getState().syncFromLineage(tables);

  const roots = rootNodes();
  const a = roots.find((n: any) => n.id === 'a')!;
  const b = roots.find((n: any) => n.id === 'b')!;
  assert(a !== undefined && b !== undefined, 'both a and b must exist as root nodes');
  assert(a.position.x < b.position.x, 'expected a.x < b.x, got a.x=' + a.position.x + ' b.x=' + b.position.x);
});

// --- Red 3: 3段チェーン A→B→C で x が厳密に増加 ---
test('layout: chain A->B->C has strictly increasing x', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('a', makeTable('a'));
  tables.set('b', makeTable('b', { dependsOn: new Set(['a']) }));
  tables.set('c', makeTable('c', { dependsOn: new Set(['b']) }));
  useFlowStore.getState().syncFromLineage(tables);

  const roots = rootNodes();
  const a = roots.find((n: any) => n.id === 'a')!;
  const b = roots.find((n: any) => n.id === 'b')!;
  const c = roots.find((n: any) => n.id === 'c')!;
  assert(a.position.x < b.position.x, 'a.x < b.x');
  assert(b.position.x < c.position.x, 'b.x < c.x');
});

// --- Red 4: 4ノード菱形 A->B, A->C, B->D, C->D で B/C は同レベル、D は最右 ---
test('layout: diamond A->{B,C}->D places D rightmost', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('a', makeTable('a'));
  tables.set('b', makeTable('b', { dependsOn: new Set(['a']) }));
  tables.set('c', makeTable('c', { dependsOn: new Set(['a']) }));
  tables.set('d', makeTable('d', { dependsOn: new Set(['b', 'c']) }));
  useFlowStore.getState().syncFromLineage(tables);

  const roots = rootNodes();
  const a = roots.find((n: any) => n.id === 'a')!;
  const b = roots.find((n: any) => n.id === 'b')!;
  const c = roots.find((n: any) => n.id === 'c')!;
  const d = roots.find((n: any) => n.id === 'd')!;
  assert(a.position.x < b.position.x, 'a.x < b.x');
  assert(a.position.x < c.position.x, 'a.x < c.x');
  assert(b.position.x < d.position.x, 'b.x < d.x');
  assert(c.position.x < d.position.x, 'c.x < d.x');
  // B と C は同レベルなので x は等しい想定
  assert(b.position.x === c.position.x, 'B and C should be at same x (same layer), b.x=' + b.position.x + ' c.x=' + c.position.x);
});

// --- Output ---
console.log('\\n=== flowStore Table Layout Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('layout: syncFromLineage applies left-to-right layout (via tsx)', () => {
  const tmpDir = path.join(ROOT, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, 'flowStoreTableLayout-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const output = execSync('npx tsx tmp/flowStoreTableLayout-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    const stdout = output.toString();
    console.log(stdout);
    if (stdout.includes('FAIL:')) throw new Error('Some functional tests failed');
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : '';
    const stdout = e.stdout ? e.stdout.toString() : '';
    if (stdout) console.log(stdout);
    throw new Error('Failed: ' + (stderr.slice(0, 800) || e.message));
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
});

console.log('\n=== flowStoreTableLayout Test Harness ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
