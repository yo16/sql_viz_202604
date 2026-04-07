/**
 * CTE/サブクエリのネスト表示テスト (Beads: sql_viz_202604_2-b0p.6)
 *
 * カバー要件:
 * 1. CTE がネストノードとして生成される (parentId 設定, extent: 'parent')
 * 2. FROM サブクエリがネストノードとして生成される
 * 3. WHERE サブクエリがネストノードとして生成される
 * 4. ネスト深度が MAX_NEST_DEPTH (5) を超えると isOmitted=true プレースホルダーになる
 * 5. sortNodesParentFirst が親→子の順序に整列する
 * 6. QueryBoxNode が isOmitted=true 時に omitMessage を含む省略UIを描画
 * 7. CSS .omitted, .omittedBody, .omittedMessage クラス存在
 * 8. tsc --noEmit が通る
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const results = [];
let failed = false;

function test(name, fn) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(condition, message) { if (!condition) throw new Error(message); }

// ===================================================
// ファイルパス定義
// ===================================================
const flowTypesPath    = path.join(ROOT, 'src', 'types', 'flow.ts');
const flowStorePath    = path.join(ROOT, 'src', 'stores', 'flowStore.ts');
const queryBoxTsxPath  = path.join(ROOT, 'src', 'components', 'visualizer', 'nodes', 'QueryBoxNode.tsx');
const queryBoxCssPath  = path.join(ROOT, 'src', 'components', 'visualizer', 'nodes', 'QueryBoxNode.module.css');

const flowTypesContent   = fs.readFileSync(flowTypesPath,   'utf-8');
const flowStoreContent   = fs.readFileSync(flowStorePath,   'utf-8');
const queryBoxTsxContent = fs.readFileSync(queryBoxTsxPath, 'utf-8');
const queryBoxCssContent = fs.readFileSync(queryBoxCssPath, 'utf-8');

// ===================================================
// 構造テスト: src/types/flow.ts
// ===================================================
test('flow.ts: QueryBoxNodeData に isOmitted フィールドが存在する', () => {
  assert(flowTypesContent.includes('isOmitted'), 'isOmitted not found in flow.ts');
});

test('flow.ts: QueryBoxNodeData に omitMessage フィールドが存在する', () => {
  assert(flowTypesContent.includes('omitMessage'), 'omitMessage not found in flow.ts');
});

test('flow.ts: QueryBoxNodeData に nestDepth フィールドが存在する', () => {
  assert(flowTypesContent.includes('nestDepth'), 'nestDepth not found in flow.ts');
});

// ===================================================
// 構造テスト: src/stores/flowStore.ts
// ===================================================
test('flowStore.ts: MAX_NEST_DEPTH 定数が定義されている', () => {
  assert(flowStoreContent.includes('MAX_NEST_DEPTH'), 'MAX_NEST_DEPTH not found in flowStore.ts');
});

test('layoutConstants.ts: MAX_NEST_DEPTH が 5 に設定されている', () => {
  const layoutConstantsContent = fs.readFileSync(
    path.join(ROOT, 'src', 'layout', 'layoutConstants.ts'),
    'utf-8'
  );
  assert(
    /MAX_NEST_DEPTH\s*:\s*5/.test(layoutConstantsContent),
    'MAX_NEST_DEPTH: 5 not found in layoutConstants.ts'
  );
});

test('flowStore.ts: buildQueryBoxNodes 関数が定義されている', () => {
  assert(flowStoreContent.includes('buildQueryBoxNodes'), 'buildQueryBoxNodes not found in flowStore.ts');
});

test('flowStore.ts: sortNodesParentFirst 関数が定義されている', () => {
  assert(flowStoreContent.includes('sortNodesParentFirst'), 'sortNodesParentFirst not found in flowStore.ts');
});

test('flowStore.ts: parentId が設定される処理がある', () => {
  assert(flowStoreContent.includes('parentId'), 'parentId not found in flowStore.ts');
});

test('flowStore.ts: extent: parent が設定される処理がある', () => {
  assert(
    flowStoreContent.includes("extent: 'parent'") || flowStoreContent.includes('extent:"parent"'),
    "extent: 'parent' not found in flowStore.ts"
  );
});

test('flowStore.ts: isOmitted が設定される処理がある', () => {
  assert(flowStoreContent.includes('isOmitted'), 'isOmitted not found in flowStore.ts');
});

test('flowStore.ts: ctes を処理するループがある', () => {
  assert(flowStoreContent.includes('ctes'), 'ctes not referenced in flowStore.ts');
});

test('flowStore.ts: fromSubqueries を処理するループがある', () => {
  assert(flowStoreContent.includes('fromSubqueries'), 'fromSubqueries not referenced in flowStore.ts');
});

test('flowStore.ts: whereSubqueries を処理するループがある', () => {
  assert(flowStoreContent.includes('whereSubqueries'), 'whereSubqueries not referenced in flowStore.ts');
});

// ===================================================
// 構造テスト: QueryBoxNode.tsx
// ===================================================
test('QueryBoxNode.tsx: isOmitted を参照している', () => {
  assert(queryBoxTsxContent.includes('isOmitted'), 'isOmitted not found in QueryBoxNode.tsx');
});

test('QueryBoxNode.tsx: omitMessage を参照している', () => {
  assert(queryBoxTsxContent.includes('omitMessage'), 'omitMessage not found in QueryBoxNode.tsx');
});

test('QueryBoxNode.tsx: isOmitted=true 時の条件分岐がある', () => {
  assert(
    queryBoxTsxContent.includes('isOmitted') &&
    (queryBoxTsxContent.includes('styles.omitted') || queryBoxTsxContent.includes('omittedBody') || queryBoxTsxContent.includes('omittedMessage')),
    'isOmitted branch rendering not found in QueryBoxNode.tsx'
  );
});

// ===================================================
// 構造テスト: QueryBoxNode.module.css
// ===================================================
test('QueryBoxNode.module.css: .omitted クラスが存在する', () => {
  assert(queryBoxCssContent.includes('.omitted'), '.omitted class not found in QueryBoxNode.module.css');
});

test('QueryBoxNode.module.css: .omittedBody クラスが存在する', () => {
  assert(queryBoxCssContent.includes('.omittedBody'), '.omittedBody class not found in QueryBoxNode.module.css');
});

test('QueryBoxNode.module.css: .omittedMessage クラスが存在する', () => {
  assert(queryBoxCssContent.includes('.omittedMessage'), '.omittedMessage class not found in QueryBoxNode.module.css');
});

// ===================================================
// 機能テスト (tsx で実行)
// ===================================================
const FUNCTIONAL_TEST = `
import { useFlowStore } from '../src/stores/flowStore';
import type { TableNode, CteNode, SubqueryNode } from '../src/types/lineage';
import type { Node } from '@xyflow/react';

const results: Array<{name: string; status: string; error?: string}> = [];
let failed = false;

function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e: any) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

function reset() {
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
}

function makeTable(id: string, overrides: Partial<TableNode> = {}): TableNode {
  return {
    id, name: id, displayTitle: id, isRegistered: true, queryType: 'ctas',
    queryId: id, columns: new Map(), dependsOn: new Set(),
    ctes: [], fromSubqueries: [], whereSubqueries: [],
    clauses: {
      select: { columns: [] },
      from: { tables: [], joins: [] },
      where: null, groupBy: null, having: null, orderBy: null,
    },
    ...overrides,
  };
}

// =====================
// sortNodesParentFirst
// =====================

test('sortNodesParentFirst: 親→子の順序に整列する', () => {
  reset();
  // 子→親の逆順で設定した場合でも正しく並び替えられることを確認
  const childNode: Node = { id: 'child', parentId: 'parent', position: { x: 0, y: 0 }, data: {} };
  const parentNode: Node = { id: 'parent', position: { x: 0, y: 0 }, data: {} };
  // 子が先に来る状態で setState
  useFlowStore.setState({ nodes: [childNode as any, parentNode as any], edges: [], displayModes: new Map(), highlightPath: null });

  // syncFromLineage を呼んで sortNodesParentFirst が適用された結果を取得
  // 親を持つテーブル（CTE）を含む tables を用意
  const cteTable = makeTable('cte-q1', { displayTitle: 'cte1', queryType: 'select' });
  const parentTable = makeTable('outer', {
    displayTitle: 'outer',
    queryType: 'ctas',
    ctes: [{ name: 'cte1', tableNode: cteTable }],
  });

  const tables = new Map<string, TableNode>();
  tables.set('outer', parentTable);

  useFlowStore.getState().syncFromLineage(tables);

  const nodes = useFlowStore.getState().nodes;
  // 親ノード 'outer' が子ノード (CTE) より前にくることを検証
  const outerIdx = nodes.findIndex(n => n.id === 'outer');
  const cteIdx   = nodes.findIndex(n => n.parentId === 'outer');
  if (cteIdx !== -1) {
    assert(outerIdx < cteIdx, \`親(outer)はCTE子より前にくるべき。outerIdx=\${outerIdx}, cteIdx=\${cteIdx}\`);
  }
  // CTE が存在しない場合でも outer は存在する
  assert(outerIdx !== -1, 'outer node should exist');
});

// =====================
// CTE ネストノード生成
// =====================

test('CTE: ctes[] を持つテーブルの syncFromLineage で CTE ノードが生成される', () => {
  reset();
  const cteTable = makeTable('cte-inner', { displayTitle: 'cte1', queryType: 'select' });
  const outerTable = makeTable('outer-cte', {
    displayTitle: 'outer',
    queryType: 'ctas',
    ctes: [{ name: 'cte1', tableNode: cteTable }],
  });

  const tables = new Map<string, TableNode>();
  tables.set('outer-cte', outerTable);

  useFlowStore.getState().syncFromLineage(tables);
  const nodes = useFlowStore.getState().nodes;

  // CTE 子ノードが存在するか
  const cteNode = nodes.find(n => n.parentId === 'outer-cte');
  assert(cteNode !== undefined, 'CTE child node with parentId should exist');
});

test('CTE: CTE ノードは parentId が親テーブルの ID に設定される', () => {
  reset();
  const cteTable = makeTable('cte-inner2', { displayTitle: 'cte2', queryType: 'select' });
  const outerTable = makeTable('outer-cte2', {
    displayTitle: 'outer2',
    queryType: 'ctas',
    ctes: [{ name: 'cte2', tableNode: cteTable }],
  });

  const tables = new Map<string, TableNode>();
  tables.set('outer-cte2', outerTable);

  useFlowStore.getState().syncFromLineage(tables);
  const nodes = useFlowStore.getState().nodes;
  const cteNode = nodes.find(n => n.parentId === 'outer-cte2');

  assert(cteNode !== undefined, 'CTE node with parentId=outer-cte2 should exist');
  assert(cteNode!.parentId === 'outer-cte2', \`parentId should be 'outer-cte2', got '\${cteNode!.parentId}'\`);
});

test('CTE: CTE ノードは extent: parent が設定される', () => {
  reset();
  const cteTable = makeTable('cte-inner3', { displayTitle: 'cte3', queryType: 'select' });
  const outerTable = makeTable('outer-cte3', {
    displayTitle: 'outer3',
    queryType: 'ctas',
    ctes: [{ name: 'cte3', tableNode: cteTable }],
  });

  const tables = new Map<string, TableNode>();
  tables.set('outer-cte3', outerTable);

  useFlowStore.getState().syncFromLineage(tables);
  const nodes = useFlowStore.getState().nodes;
  const cteNode = nodes.find(n => n.parentId === 'outer-cte3');

  assert(cteNode !== undefined, 'CTE node should exist');
  assert((cteNode as any).extent === 'parent', \`extent should be 'parent', got '\${(cteNode as any).extent}'\`);
});

// =====================
// FROM サブクエリ ネストノード生成
// =====================

test('FROMサブクエリ: fromSubqueries[] を持つテーブルの syncFromLineage でサブクエリノードが生成される', () => {
  reset();
  const subTable = makeTable('from-sub-inner', { displayTitle: '[サブクエリ]', queryType: 'select' });
  const outerTable = makeTable('outer-from', {
    displayTitle: 'outer-from',
    queryType: 'ctas',
    fromSubqueries: [{ alias: 'sub1', tableNode: subTable }],
  });

  const tables = new Map<string, TableNode>();
  tables.set('outer-from', outerTable);

  useFlowStore.getState().syncFromLineage(tables);
  const nodes = useFlowStore.getState().nodes;

  const subNode = nodes.find(n => n.parentId === 'outer-from');
  assert(subNode !== undefined, 'FROM subquery child node with parentId should exist');
});

test('FROMサブクエリ: サブクエリノードは extent: parent が設定される', () => {
  reset();
  const subTable = makeTable('from-sub-inner2', { displayTitle: '[サブクエリ]', queryType: 'select' });
  const outerTable = makeTable('outer-from2', {
    displayTitle: 'outer-from2',
    queryType: 'ctas',
    fromSubqueries: [{ alias: 'sub2', tableNode: subTable }],
  });

  const tables = new Map<string, TableNode>();
  tables.set('outer-from2', outerTable);

  useFlowStore.getState().syncFromLineage(tables);
  const nodes = useFlowStore.getState().nodes;
  const subNode = nodes.find(n => n.parentId === 'outer-from2');

  assert(subNode !== undefined, 'FROM subquery node should exist');
  assert((subNode as any).extent === 'parent', \`extent should be 'parent', got '\${(subNode as any).extent}'\`);
});

// =====================
// WHERE サブクエリ ネストノード生成
// =====================

test('WHEREサブクエリ: whereSubqueries[] を持つテーブルの syncFromLineage でサブクエリノードが生成される', () => {
  reset();
  const subTable = makeTable('where-sub-inner', { displayTitle: '[WHERE サブクエリ]', queryType: 'select' });
  const outerTable = makeTable('outer-where', {
    displayTitle: 'outer-where',
    queryType: 'ctas',
    whereSubqueries: [{ alias: '[サブクエリ]', tableNode: subTable }],
  });

  const tables = new Map<string, TableNode>();
  tables.set('outer-where', outerTable);

  useFlowStore.getState().syncFromLineage(tables);
  const nodes = useFlowStore.getState().nodes;

  const subNode = nodes.find(n => n.parentId === 'outer-where');
  assert(subNode !== undefined, 'WHERE subquery child node with parentId should exist');
});

test('WHEREサブクエリ: サブクエリノードは extent: parent が設定される', () => {
  reset();
  const subTable = makeTable('where-sub-inner2', { displayTitle: '[WHERE サブクエリ]', queryType: 'select' });
  const outerTable = makeTable('outer-where2', {
    displayTitle: 'outer-where2',
    queryType: 'ctas',
    whereSubqueries: [{ alias: '[サブクエリ]', tableNode: subTable }],
  });

  const tables = new Map<string, TableNode>();
  tables.set('outer-where2', outerTable);

  useFlowStore.getState().syncFromLineage(tables);
  const nodes = useFlowStore.getState().nodes;
  const subNode = nodes.find(n => n.parentId === 'outer-where2');

  assert(subNode !== undefined, 'WHERE subquery node should exist');
  assert((subNode as any).extent === 'parent', \`extent should be 'parent', got '\${(subNode as any).extent}'\`);
});

// =====================
// MAX_NEST_DEPTH による isOmitted プレースホルダー
// =====================

test('MAX_NEST_DEPTH超過: nestDepth > 5 のネストノードは isOmitted=true になる', () => {
  reset();

  // 深さ 6 のネストを作る: outer -> depth1 -> depth2 -> depth3 -> depth4 -> depth5 -> depth6(omitted)
  function makeNestedTable(id: string, depth: number): TableNode {
    if (depth <= 0) return makeTable(id, { displayTitle: id, queryType: 'select' });
    const innerTable = makeNestedTable(id + '-inner', depth - 1);
    return makeTable(id, {
      displayTitle: id,
      queryType: depth > 1 ? 'select' : 'ctas',
      ctes: [{ name: 'cte-depth-' + depth, tableNode: innerTable }],
    });
  }

  // 6層のネストを持つテーブル
  const deepTable = makeNestedTable('deep-outer', 6);
  const tables = new Map<string, TableNode>();
  tables.set('deep-outer', deepTable);

  useFlowStore.getState().syncFromLineage(tables);
  const nodes = useFlowStore.getState().nodes;

  // MAX_NEST_DEPTH (5) を超えたノードが isOmitted=true であることを確認
  const omittedNodes = nodes.filter(n => (n.data as any).isOmitted === true);
  assert(omittedNodes.length > 0, \`MAX_NEST_DEPTH超過ノードは isOmitted=true になるべき。全ノード数: \${nodes.length}\`);
});

test('MAX_NEST_DEPTH超過: isOmitted=true のノードは omitMessage を持つ', () => {
  reset();

  function makeNestedTable(id: string, depth: number): TableNode {
    if (depth <= 0) return makeTable(id, { displayTitle: id, queryType: 'select' });
    const innerTable = makeNestedTable(id + '-inner', depth - 1);
    return makeTable(id, {
      displayTitle: id,
      queryType: 'select',
      ctes: [{ name: 'cte-d-' + depth, tableNode: innerTable }],
    });
  }

  const deepTable = makeNestedTable('omit-outer', 6);
  const tables = new Map<string, TableNode>();
  tables.set('omit-outer', deepTable);

  useFlowStore.getState().syncFromLineage(tables);
  const nodes = useFlowStore.getState().nodes;

  const omittedNodes = nodes.filter(n => (n.data as any).isOmitted === true);
  assert(omittedNodes.length > 0, 'omitted node should exist');

  for (const n of omittedNodes) {
    const msg = (n.data as any).omitMessage;
    assert(typeof msg === 'string' && msg.length > 0, \`omitMessage should be non-empty string, got: \${JSON.stringify(msg)}\`);
  }
});

test('nestDepth<=5 のノードは isOmitted にならない', () => {
  reset();
  // 3層のネスト (1+3=4 < 5) はプレースホルダーにならない
  function makeNestedTable(id: string, depth: number): TableNode {
    if (depth <= 0) return makeTable(id, { displayTitle: id, queryType: 'select' });
    const innerTable = makeNestedTable(id + '-inner', depth - 1);
    return makeTable(id, {
      displayTitle: id,
      queryType: 'select',
      ctes: [{ name: 'cte-d-' + depth, tableNode: innerTable }],
    });
  }

  const shallowTable = makeNestedTable('shallow-outer', 3);
  const tables = new Map<string, TableNode>();
  tables.set('shallow-outer', shallowTable);

  useFlowStore.getState().syncFromLineage(tables);
  const nodes = useFlowStore.getState().nodes;

  const omittedNodes = nodes.filter(n => (n.data as any).isOmitted === true);
  assert(omittedNodes.length === 0, \`nestDepth<=5 の場合は isOmitted=true ノードが存在してはいけない。omittedNodes.length=\${omittedNodes.length}\`);
});

// Output
console.log('\\n=== CTE Nesting Functional Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('functional tests pass (via tsx)', () => {
  const tmpFile = path.join(ROOT, 'tmp', 'cteNesting-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const output = execSync('npx tsx tmp/cteNesting-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    const stdout = output.toString();
    console.log(stdout);
    assert(!stdout.includes('FAIL:'), 'Some functional tests failed');
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : '';
    const stdout = e.stdout ? e.stdout.toString() : '';
    if (stdout) console.log(stdout);
    throw new Error('Failed: ' + stderr.slice(0, 500));
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
});

try { fs.unlinkSync(path.join(ROOT, 'tmp', 'cteNesting-test.ts')); } catch {}

// ===================================================
// tsc コンパイルチェック
// ===================================================
test('project compiles (tsc --noEmit)', () => {
  try { execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe', timeout: 60000 }); }
  catch (e) { throw new Error('tsc failed: ' + (e.stderr ? e.stderr.toString().slice(0, 500) : e.message)); }
});

// ===================================================
// 結果出力
// ===================================================
console.log('\n=== CTE Nesting Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
