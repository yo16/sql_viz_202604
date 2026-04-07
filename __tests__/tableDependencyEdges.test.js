/**
 * テーブル依存関係の自動検出・エッジ生成テスト (Beads: sql_viz_202604_2-uup.3)
 *
 * カバー要件 (F2-1):
 * 1. FROM/JOIN から dependsOn が構築される
 * 2. 未登録テーブルは Unresolved として tables マップに自動追加される
 * 3. syncFromLineage で dependsOn から type:'lineage' のエッジが生成される
 * 4. エッジ data.dependencyType === 'table_dependency', isHighlighted: false
 * 5. エッジの source=依存先(上流), target=依存元(下流) の向き
 * 6. エイリアスは実テーブル名に解決される (dependsOn には実名が入る)
 * 7. 重複エッジが生成されない (edgeIdSet による dedupe)
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
const buildLineageGraphPath = path.join(ROOT, 'src', 'lib', 'lineage', 'buildLineageGraph.ts');
const flowStorePath = path.join(ROOT, 'src', 'stores', 'flowStore.ts');
const lineageStorePath = path.join(ROOT, 'src', 'stores', 'lineageStore.ts');

const buildLineageGraphContent = fs.readFileSync(buildLineageGraphPath, 'utf-8');
const flowStoreContent = fs.readFileSync(flowStorePath, 'utf-8');
const lineageStoreContent = fs.readFileSync(lineageStorePath, 'utf-8');

// ===================================================
// 構造テスト: buildLineageGraph.ts
// ===================================================

test('buildLineageGraph.ts: dependsOn を FROM テーブルから構築する処理がある', () => {
  assert(buildLineageGraphContent.includes('dependsOn'), 'dependsOn not referenced');
  assert(buildLineageGraphContent.includes('fromTable.name'), 'from.tables not iterated');
});

test('buildLineageGraph.ts: dependsOn を JOIN テーブルから構築する処理がある', () => {
  assert(buildLineageGraphContent.includes('join.table'), 'join.table not referenced in dependsOn');
});

test('buildLineageGraph.ts: createUnresolvedTableNode が定義されている', () => {
  assert(
    buildLineageGraphContent.includes('export function createUnresolvedTableNode'),
    'createUnresolvedTableNode not exported'
  );
});

test('buildLineageGraph.ts: 未登録テーブルを tables に追加する処理がある', () => {
  assert(
    buildLineageGraphContent.includes('createUnresolvedTableNode') &&
    buildLineageGraphContent.includes('tables.set'),
    'unresolved table registration not found'
  );
});

test('buildLineageGraph.ts: buildAliasMap がエイリアス → 実テーブル名を返す処理がある', () => {
  assert(
    buildLineageGraphContent.includes('export function buildAliasMap'),
    'buildAliasMap not exported'
  );
  assert(
    buildLineageGraphContent.includes('table.alias') &&
    buildLineageGraphContent.includes('map.set'),
    'alias mapping not found'
  );
});

// ===================================================
// 構造テスト: flowStore.ts
// ===================================================

test('flowStore.ts: dependsOn からエッジを生成する処理がある', () => {
  assert(flowStoreContent.includes('table.dependsOn'), 'table.dependsOn not referenced');
});

test('flowStore.ts: エッジ type が "lineage" に設定されている', () => {
  assert(
    flowStoreContent.includes("type: 'lineage'") || flowStoreContent.includes('type:"lineage"'),
    "type: 'lineage' not found in flowStore.ts"
  );
});

test('flowStore.ts: dependencyType: "table_dependency" が設定されている', () => {
  assert(
    flowStoreContent.includes("dependencyType: 'table_dependency'") ||
    flowStoreContent.includes('dependencyType:"table_dependency"'),
    "dependencyType: 'table_dependency' not found"
  );
});

test('flowStore.ts: isHighlighted: false が設定されている', () => {
  assert(
    flowStoreContent.includes('isHighlighted: false'),
    'isHighlighted: false not found in flowStore.ts'
  );
});

test('flowStore.ts: edgeIdSet による重複エッジ防止がある', () => {
  assert(
    flowStoreContent.includes('edgeIdSet'),
    'edgeIdSet not found in flowStore.ts'
  );
  assert(
    flowStoreContent.includes('edgeIdSet.has') || flowStoreContent.includes('edgeIdSet.add'),
    'edgeIdSet usage not found'
  );
});

test('flowStore.ts: source=上流(依存先) target=下流(依存元) の向きでエッジを生成している', () => {
  // source: depTableId (依存先), target: tableId (依存元) のパターン
  assert(
    flowStoreContent.includes('source: depTableId') ||
    (flowStoreContent.includes('source:') && flowStoreContent.includes('depTableId')),
    'edge source direction (depTableId as source) not found'
  );
  assert(
    flowStoreContent.includes('target: tableId') ||
    (flowStoreContent.includes('target:') && flowStoreContent.includes('tableId')),
    'edge target direction (tableId as target) not found'
  );
});

// ===================================================
// 構造テスト: lineageStore.ts
// ===================================================

test('lineageStore.ts: addQuery が buildLineageGraph を呼び出している', () => {
  assert(
    lineageStoreContent.includes('buildLineageGraph'),
    'buildLineageGraph not called in lineageStore.ts'
  );
});

test('lineageStore.ts: addQuery が inferUnregisteredColumns を呼び出している', () => {
  assert(
    lineageStoreContent.includes('inferUnregisteredColumns'),
    'inferUnregisteredColumns not called in lineageStore.ts'
  );
});

test('lineageStore.ts: addQuery が propagateSelectStar を呼び出している', () => {
  assert(
    lineageStoreContent.includes('propagateSelectStar'),
    'propagateSelectStar not called in lineageStore.ts'
  );
});

// ===================================================
// 機能テスト (tsx で実行)
// ===================================================
const FUNCTIONAL_TEST = `
import {
  buildLineageGraph,
  registerTables,
  buildAliasMap,
  createUnresolvedTableNode,
} from '../src/lib/lineage/buildLineageGraph';
import { useFlowStore } from '../src/stores/flowStore';
import type { ParsedQuery, FromClause } from '../src/types/api';
import type { TableNode } from '../src/types/lineage';

const results: Array<{name: string; status: string; error?: string}> = [];
let failed = false;

function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e: any) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

// ヘルパー: ParsedQuery を最小限のフィールドで生成
function makeParsedQuery(overrides: Partial<ParsedQuery> = {}): ParsedQuery {
  return {
    queryId: 'q1', rawSql: 'SELECT 1', targetTable: null, queryType: 'select',
    select: { columns: [] },
    from: { tables: [], joins: [], subqueries: [] },
    where: null, groupBy: null, having: null, orderBy: null, ctes: [],
    ...overrides,
  };
}

// ヘルパー: TableNode を最小限のフィールドで生成
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

function reset() {
  useFlowStore.setState({ nodes: [], edges: [], displayModes: new Map(), highlightPath: null });
}

// =====================================================================
// F2-1-1: FROM/JOIN から dependsOn が構築される
// =====================================================================

test('F2-1-1a: FROM テーブルが dependsOn に追加される', () => {
  const q = makeParsedQuery({
    queryId: 'q1', targetTable: 'output', queryType: 'ctas',
    from: {
      tables: [{ name: 'source_table', alias: null }],
      joins: [],
      subqueries: [],
    },
  });
  const tables = buildLineageGraph([q]);
  const output = tables.get('output')!;
  assert(output !== undefined, 'output table should exist');
  assert(output.dependsOn.has('source_table'), 'dependsOn should contain source_table');
});

test('F2-1-1b: JOIN テーブルが dependsOn に追加される', () => {
  const q = makeParsedQuery({
    queryId: 'q1', targetTable: 'output', queryType: 'ctas',
    from: {
      tables: [{ name: 'orders', alias: null }],
      joins: [
        {
          joinType: 'LEFT',
          table: 'customers',
          alias: null,
          onConditionRefs: [],
          onConditionText: 'orders.customer_id = customers.id',
        },
      ],
      subqueries: [],
    },
  });
  const tables = buildLineageGraph([q]);
  const output = tables.get('output')!;
  assert(output.dependsOn.has('orders'), 'dependsOn should contain orders');
  assert(output.dependsOn.has('customers'), 'dependsOn should contain customers');
  assert(output.dependsOn.size === 2, \`dependsOn size should be 2, got \${output.dependsOn.size}\`);
});

test('F2-1-1c: FROM + JOIN の複数テーブルが dependsOn に全て追加される', () => {
  const q = makeParsedQuery({
    queryId: 'q1', targetTable: 'report', queryType: 'ctas',
    from: {
      tables: [{ name: 'fact_sales', alias: 'fs' }],
      joins: [
        { joinType: 'INNER', table: 'dim_product', alias: 'dp', onConditionRefs: [], onConditionText: '' },
        { joinType: 'LEFT', table: 'dim_date', alias: 'dd', onConditionRefs: [], onConditionText: '' },
      ],
      subqueries: [],
    },
  });
  const tables = buildLineageGraph([q]);
  const report = tables.get('report')!;
  assert(report.dependsOn.has('fact_sales'), 'fact_sales in dependsOn');
  assert(report.dependsOn.has('dim_product'), 'dim_product in dependsOn');
  assert(report.dependsOn.has('dim_date'), 'dim_date in dependsOn');
  assert(report.dependsOn.size === 3, \`dependsOn size should be 3, got \${report.dependsOn.size}\`);
});

// =====================================================================
// F2-1-2: 未登録テーブルは Unresolved として tables マップに自動追加される
// =====================================================================

test('F2-1-2a: FROM で参照した未登録テーブルが Unresolved として追加される', () => {
  const q = makeParsedQuery({
    queryId: 'q1', targetTable: 'output', queryType: 'ctas',
    from: { tables: [{ name: 'raw_data', alias: null }], joins: [], subqueries: [] },
  });
  const tables = buildLineageGraph([q]);
  assert(tables.has('raw_data'), 'raw_data should be in tables');
  const raw = tables.get('raw_data')!;
  assert(raw.isRegistered === false, 'raw_data should be unregistered');
  assert(raw.queryType === 'unresolved', \`queryType should be 'unresolved', got '\${raw.queryType}'\`);
});

test('F2-1-2b: JOIN で参照した未登録テーブルが Unresolved として追加される', () => {
  const q = makeParsedQuery({
    queryId: 'q1', targetTable: 'output', queryType: 'ctas',
    from: {
      tables: [],
      joins: [{ joinType: 'INNER', table: 'lookup_table', alias: null, onConditionRefs: [], onConditionText: '' }],
      subqueries: [],
    },
  });
  const tables = buildLineageGraph([q]);
  assert(tables.has('lookup_table'), 'lookup_table should be in tables');
  const lookup = tables.get('lookup_table')!;
  assert(lookup.isRegistered === false, 'lookup_table should be unregistered');
  assert(lookup.queryType === 'unresolved', 'queryType should be unresolved');
});

test('F2-1-2c: createUnresolvedTableNode の displayTitle が [未登録] プレフィックスを持つ', () => {
  const node = createUnresolvedTableNode('my_table');
  assert(node.displayTitle === '[未登録] my_table', \`displayTitle should be '[未登録] my_table', got '\${node.displayTitle}'\`);
  assert(node.isRegistered === false, 'isRegistered should be false');
  assert(node.queryType === 'unresolved', 'queryType should be unresolved');
  assert(node.dependsOn.size === 0, 'dependsOn should be empty');
});

test('F2-1-2d: 既に登録済みのテーブルは Unresolved で上書きされない', () => {
  const q1 = makeParsedQuery({
    queryId: 'q1', targetTable: 'mid', queryType: 'ctas',
    from: { tables: [{ name: 'raw', alias: null }], joins: [], subqueries: [] },
  });
  const q2 = makeParsedQuery({
    queryId: 'q2', targetTable: 'output', queryType: 'ctas',
    from: { tables: [{ name: 'mid', alias: null }], joins: [], subqueries: [] },
  });
  const tables = buildLineageGraph([q1, q2]);
  // 'mid' は q1 で登録済み → q2 から参照されても Unresolved にならない
  const mid = tables.get('mid')!;
  assert(mid !== undefined, 'mid should exist');
  assert(mid.isRegistered === true, \`mid should remain registered, got isRegistered=\${mid.isRegistered}\`);
});

// =====================================================================
// F2-1-3/4/5: syncFromLineage でエッジが生成される (type, data, 向き)
// =====================================================================

test('F2-1-3: syncFromLineage で dependsOn から lineage タイプのエッジが生成される', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('source', makeTable('source'));
  tables.set('output', makeTable('output', { dependsOn: new Set(['source']) }));
  useFlowStore.getState().syncFromLineage(tables);
  const edges = useFlowStore.getState().edges;
  const lineageEdges = edges.filter(e => e.type === 'lineage');
  assert(lineageEdges.length === 1, \`should have 1 lineage edge, got \${lineageEdges.length}\`);
});

test('F2-1-4a: エッジの data.dependencyType === "table_dependency"', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('upstream', makeTable('upstream'));
  tables.set('downstream', makeTable('downstream', { dependsOn: new Set(['upstream']) }));
  useFlowStore.getState().syncFromLineage(tables);
  const edges = useFlowStore.getState().edges;
  assert(edges.length === 1, \`should have 1 edge, got \${edges.length}\`);
  const edge = edges[0];
  assert(
    (edge.data as any).dependencyType === 'table_dependency',
    \`data.dependencyType should be 'table_dependency', got '\${(edge.data as any).dependencyType}'\`
  );
});

test('F2-1-4b: エッジの data.isHighlighted === false', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('a', makeTable('a'));
  tables.set('b', makeTable('b', { dependsOn: new Set(['a']) }));
  useFlowStore.getState().syncFromLineage(tables);
  const edges = useFlowStore.getState().edges;
  const edge = edges[0];
  assert(
    (edge.data as any).isHighlighted === false,
    \`data.isHighlighted should be false, got \${(edge.data as any).isHighlighted}\`
  );
});

test('F2-1-5: エッジの source=依存先(上流), target=依存元(下流) の向き', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('raw', makeTable('raw'));
  tables.set('mart', makeTable('mart', { dependsOn: new Set(['raw']) }));
  useFlowStore.getState().syncFromLineage(tables);
  const edges = useFlowStore.getState().edges;
  assert(edges.length === 1, \`should have 1 edge, got \${edges.length}\`);
  const edge = edges[0];
  assert(edge.source === 'raw', \`source should be 'raw' (upstream), got '\${edge.source}'\`);
  assert(edge.target === 'mart', \`target should be 'mart' (downstream), got '\${edge.target}'\`);
});

test('F2-1-5b: 複数の上流テーブルが存在する場合、各エッジの向きが正しい', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('table_a', makeTable('table_a'));
  tables.set('table_b', makeTable('table_b'));
  tables.set('result', makeTable('result', { dependsOn: new Set(['table_a', 'table_b']) }));
  useFlowStore.getState().syncFromLineage(tables);
  const edges = useFlowStore.getState().edges;
  assert(edges.length === 2, \`should have 2 edges, got \${edges.length}\`);
  const edgeA = edges.find(e => e.source === 'table_a')!;
  const edgeB = edges.find(e => e.source === 'table_b')!;
  assert(edgeA !== undefined, 'edge from table_a should exist');
  assert(edgeA.target === 'result', \`table_a edge target should be 'result', got '\${edgeA.target}'\`);
  assert(edgeB !== undefined, 'edge from table_b should exist');
  assert(edgeB.target === 'result', \`table_b edge target should be 'result', got '\${edgeB.target}'\`);
});

// =====================================================================
// F2-1-6: エイリアスは実テーブル名に解決される
// =====================================================================

test('F2-1-6a: buildAliasMap でエイリアス → 実テーブル名が解決される', () => {
  const from: FromClause = {
    tables: [{ name: 'users', alias: 'u' }],
    joins: [
      { joinType: 'INNER', table: 'orders', alias: 'o', onConditionRefs: [], onConditionText: '' },
    ],
    subqueries: [],
  };
  const aliasMap = buildAliasMap(from);
  assert(aliasMap.get('u') === 'users', \`alias 'u' should map to 'users', got '\${aliasMap.get('u')}'\`);
  assert(aliasMap.get('o') === 'orders', \`alias 'o' should map to 'orders', got '\${aliasMap.get('o')}'\`);
});

test('F2-1-6b: dependsOn に含まれるテーブル名はエイリアスではなく実名である', () => {
  const q = makeParsedQuery({
    queryId: 'q1', targetTable: 'output', queryType: 'ctas',
    from: {
      tables: [{ name: 'users_table', alias: 'u' }],
      joins: [
        { joinType: 'LEFT', table: 'orders_table', alias: 'o', onConditionRefs: [], onConditionText: '' },
      ],
      subqueries: [],
    },
  });
  const tables = buildLineageGraph([q]);
  const output = tables.get('output')!;
  // dependsOn はエイリアス 'u', 'o' ではなく実名を持つ
  assert(output.dependsOn.has('users_table'), \`dependsOn should contain 'users_table' (not alias 'u')\`);
  assert(output.dependsOn.has('orders_table'), \`dependsOn should contain 'orders_table' (not alias 'o')\`);
  assert(!output.dependsOn.has('u'), "dependsOn should NOT contain alias 'u'");
  assert(!output.dependsOn.has('o'), "dependsOn should NOT contain alias 'o'");
});

// =====================================================================
// F2-1-7: 重複エッジが生成されない (edgeIdSet による dedupe)
// =====================================================================

test('F2-1-7a: 同一 source-target ペアのエッジは1つだけ生成される', () => {
  reset();
  // 同じ dependsOn を持つ2つの呼び出しで重複エッジが生じないことを確認
  const tables = new Map<string, TableNode>();
  tables.set('src', makeTable('src'));
  tables.set('dst', makeTable('dst', { dependsOn: new Set(['src']) }));
  useFlowStore.getState().syncFromLineage(tables);
  const firstCallEdges = useFlowStore.getState().edges.length;

  // 同一データで再度 syncFromLineage を呼ぶ
  useFlowStore.getState().syncFromLineage(tables);
  const secondCallEdges = useFlowStore.getState().edges.length;

  assert(firstCallEdges === 1, \`first call should produce 1 edge, got \${firstCallEdges}\`);
  assert(secondCallEdges === 1, \`second call should still produce 1 edge (no dup), got \${secondCallEdges}\`);
});

test('F2-1-7b: 複数テーブルが同じ上流に依存してもエッジIDは一意である', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('base', makeTable('base'));
  tables.set('derived_a', makeTable('derived_a', { dependsOn: new Set(['base']) }));
  tables.set('derived_b', makeTable('derived_b', { dependsOn: new Set(['base']) }));
  useFlowStore.getState().syncFromLineage(tables);
  const edges = useFlowStore.getState().edges;
  // base→derived_a と base→derived_b の2エッジが生成される
  assert(edges.length === 2, \`should have 2 edges (not duplicated), got \${edges.length}\`);
  const edgeIds = edges.map(e => e.id);
  const uniqueIds = new Set(edgeIds);
  assert(uniqueIds.size === edgeIds.length, \`all edge IDs should be unique. IDs: \${edgeIds.join(', ')}\`);
});

test('F2-1-7c: テーブルが tables マップに存在しない依存先へのエッジは生成されない', () => {
  reset();
  const tables = new Map<string, TableNode>();
  tables.set('output', makeTable('output', { dependsOn: new Set(['nonexistent_table']) }));
  useFlowStore.getState().syncFromLineage(tables);
  const edges = useFlowStore.getState().edges;
  assert(edges.length === 0, \`edge to nonexistent table should NOT be created, got \${edges.length} edges\`);
});

// =====================================================================
// 統合テスト: buildLineageGraph → syncFromLineage パイプライン
// =====================================================================

test('統合: registerTables → syncFromLineage のパイプラインでエッジが正しく生成される', () => {
  reset();
  const q1 = makeParsedQuery({
    queryId: 'q1', targetTable: 'intermediate', queryType: 'ctas',
    from: { tables: [{ name: 'source_raw', alias: 'sr' }], joins: [], subqueries: [] },
  });
  const q2 = makeParsedQuery({
    queryId: 'q2', targetTable: 'final_output', queryType: 'ctas',
    from: {
      tables: [{ name: 'intermediate', alias: 'i' }],
      joins: [{ joinType: 'LEFT', table: 'dim_lookup', alias: 'dl', onConditionRefs: [], onConditionText: '' }],
      subqueries: [],
    },
  });
  const tables = buildLineageGraph([q1, q2]);

  // intermediate は source_raw に依存
  const intermediate = tables.get('intermediate')!;
  assert(intermediate.dependsOn.has('source_raw'), 'intermediate depends on source_raw');
  // final_output は intermediate と dim_lookup に依存
  const finalOutput = tables.get('final_output')!;
  assert(finalOutput.dependsOn.has('intermediate'), 'final_output depends on intermediate');
  assert(finalOutput.dependsOn.has('dim_lookup'), 'final_output depends on dim_lookup');

  // syncFromLineage でエッジ生成を検証
  useFlowStore.getState().syncFromLineage(tables);
  const edges = useFlowStore.getState().edges;

  // source_raw→intermediate, intermediate→final_output, dim_lookup→final_output の3エッジ
  assert(edges.length === 3, \`should have 3 edges, got \${edges.length}: \${edges.map(e=>e.id).join(', ')}\`);

  const edgeSrcToMid = edges.find(e => e.source === 'source_raw' && e.target === 'intermediate');
  assert(edgeSrcToMid !== undefined, 'edge source_raw→intermediate should exist');
  assert((edgeSrcToMid!.data as any).dependencyType === 'table_dependency', 'edge should be table_dependency');

  const edgeMidToFinal = edges.find(e => e.source === 'intermediate' && e.target === 'final_output');
  assert(edgeMidToFinal !== undefined, 'edge intermediate→final_output should exist');

  const edgeDimToFinal = edges.find(e => e.source === 'dim_lookup' && e.target === 'final_output');
  assert(edgeDimToFinal !== undefined, 'edge dim_lookup→final_output should exist');
});

test('統合: Unresolved テーブルへのエッジも生成される', () => {
  reset();
  const q = makeParsedQuery({
    queryId: 'q1', targetTable: 'output_table', queryType: 'ctas',
    from: { tables: [{ name: 'unregistered_src', alias: null }], joins: [], subqueries: [] },
  });
  const tables = buildLineageGraph([q]);

  // unregistered_src は Unresolved として登録されている
  const unresolved = tables.get('unregistered_src')!;
  assert(unresolved !== undefined, 'unregistered_src should exist in tables');
  assert(unresolved.isRegistered === false, 'should be unregistered');

  useFlowStore.getState().syncFromLineage(tables);
  const edges = useFlowStore.getState().edges;

  // Unresolved テーブルが tables マップに存在するためエッジが生成される
  assert(edges.length === 1, \`should have 1 edge (including unresolved), got \${edges.length}\`);
  const edge = edges[0];
  assert(edge.source === 'unregistered_src', \`source should be 'unregistered_src', got '\${edge.source}'\`);
  assert(edge.target === 'output_table', \`target should be 'output_table', got '\${edge.target}'\`);
});

// Output
console.log('\\n=== tableDependencyEdges Functional Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('functional tests pass (via tsx)', () => {
  const tmpFile = path.join(ROOT, 'tmp', 'tableDependencyEdges-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const output = execSync('npx tsx tmp/tableDependencyEdges-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
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

try { fs.unlinkSync(path.join(ROOT, 'tmp', 'tableDependencyEdges-test.ts')); } catch {}

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
console.log('\n=== Table Dependency Edge Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
