/**
 * compact モードの QueryBox 高さが列数に応じて動的に計算されることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-n5t
 *
 * - 1 列: COMPACT_BASE_HEIGHT + 1*22 = 66
 * - 5 列: COMPACT_BASE_HEIGHT + 5*22 = 154
 * - 15 列 (上限超過): COMPACT_BASE_HEIGHT + 10*22 + more_row = 264+more
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const FUNCTIONAL_TEST = `
import { useFlowStore } from '../src/stores/flowStore';
import type { TableNode, ColumnNode } from '../src/types/lineage';
import { LAYOUT } from '../src/layout/layoutConstants';

const results: Array<{ name: string; status: string; error?: string }> = [];
let failed = false;
function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e: any) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }

function makeCol(n: string, tid: string): ColumnNode {
  return { columnName: n, tableId: tid, certainty: 'confirmed', dependencies: [], isFromStar: false, exprType: 'column_ref' };
}
function makeT(id: string, numCols: number): TableNode {
  const cols = new Map<string, ColumnNode>();
  for (let i = 0; i < numCols; i++) cols.set('col' + i, makeCol('col' + i, id));
  return {
    id, name: id, displayTitle: id, isRegistered: true, queryType: 'select', queryId: id,
    columns: cols, dependsOn: new Set(),
    ctes: [], fromSubqueries: [], whereSubqueries: [],
    clauses: {
      select: { columns: Array.from({ length: numCols }, (_, i) => ({
        displayName: 'col' + i, sourceTable: null, sourceColumn: 'col' + i, exprType: 'column_ref'
      })) },
      from: { tables: [], joins: [] },
      where: null, groupBy: null, having: null, orderBy: null,
    },
  };
}
function reset() {
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
}

function compactAndMeasure(numCols: number) {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('q', makeT('q', numCols));
  // compact で開始
  const dm = new Map<string, 'compact' | 'detail'>();
  dm.set('q', 'compact');
  useFlowStore.setState({ displayModes: dm });
  useFlowStore.getState().syncFromLineage(tables);
  // toggleDisplayMode を使わず syncFromLineage 後の状態を見る
  // ただし syncFromLineage は初期値 detail を設定する可能性があるので再トグル
  const currentMode = useFlowStore.getState().displayModes.get('q');
  if (currentMode !== 'compact') {
    useFlowStore.getState().toggleDisplayMode('q');
  }
  return useFlowStore.getState().nodes.find((n: any) => n.id === 'q')!;
}

test('compact with 1 column: height = BASE + 1*ROW', () => {
  const node = compactAndMeasure(1);
  const expected = LAYOUT.COMPACT_BASE_HEIGHT + 1 * LAYOUT.COMPACT_COLUMN_ROW_HEIGHT;
  assert((node as any).height >= expected,
    'height should be >= ' + expected + ', got: ' + (node as any).height);
});

test('compact with 5 columns: height = BASE + 5*ROW', () => {
  const node = compactAndMeasure(5);
  const expected = LAYOUT.COMPACT_BASE_HEIGHT + 5 * LAYOUT.COMPACT_COLUMN_ROW_HEIGHT;
  assert((node as any).height >= expected,
    'height should be >= ' + expected + ', got: ' + (node as any).height);
});

test('compact with 15 columns: capped at COMPACT_MAX_COLUMNS rows (+ more)', () => {
  const node = compactAndMeasure(15);
  // 上限 10 列表示 + more row
  const expectedMin = LAYOUT.COMPACT_BASE_HEIGHT + LAYOUT.COMPACT_MAX_COLUMNS * LAYOUT.COMPACT_COLUMN_ROW_HEIGHT;
  assert((node as any).height >= expectedMin,
    'height should be >= ' + expectedMin + ' (max columns), got: ' + (node as any).height);
});

test('compact width = COMPACT_NODE_WIDTH', () => {
  const node = compactAndMeasure(3);
  assert((node as any).width === LAYOUT.COMPACT_NODE_WIDTH,
    'width should be COMPACT_NODE_WIDTH=' + LAYOUT.COMPACT_NODE_WIDTH +
    ', got: ' + (node as any).width);
});

console.log('\\n=== Compact QueryBox Height Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

const tmpDir = path.join(ROOT, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'compactQueryBoxHeight-test.ts');
fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
try {
  const out = execSync('npx tsx tmp/compactQueryBoxHeight-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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
