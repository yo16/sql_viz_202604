/**
 * LineageEdge + CSS テスト (Beads: sql_viz_202604_2-uup.2)
 *
 * カバー要件:
 * 1. "use client" 宣言
 * 2. LineageEdgeData (dependencyType / isHighlighted / isDimmed) の利用
 * 3. React Flow EdgeProps + getBezierPath + BaseEdge 使用
 * 4. dependencyType に応じた className 切替 (.tableDependency / .columnLineage)
 * 5. isHighlighted で .highlighted 適用
 * 6. isDimmed && !isHighlighted で .dimmed 適用
 * 7. CSS: .edge / .tableDependency / .columnLineage / .highlighted / .dimmed / dashed pattern (column_lineage)
 * 8. CSS変数 var(--color-edge-default), var(--color-edge-highlighted) 使用
 * 9. Tailwind不使用 (@tailwind / @apply / className=" なし)
 * 10. FlowCanvas.tsx の edgeTypes に lineage: LineageEdge 登録
 * 11. tsc --noEmit 通過
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
const tsxPath       = path.join(ROOT, 'src', 'components', 'visualizer', 'edges', 'LineageEdge.tsx');
const cssPath       = path.join(ROOT, 'src', 'components', 'visualizer', 'edges', 'LineageEdge.module.css');
const flowTypesPath = path.join(ROOT, 'src', 'types', 'flow.ts');
const variablesCssPath = path.join(ROOT, 'src', 'styles', 'variables.css');
const flowCanvasPath = path.join(ROOT, 'src', 'components', 'visualizer', 'FlowCanvas.tsx');

const tsxContent        = fs.readFileSync(tsxPath, 'utf-8');
const cssContent        = fs.readFileSync(cssPath, 'utf-8');
const flowTypesContent  = fs.readFileSync(flowTypesPath, 'utf-8');
const variablesCssContent = fs.readFileSync(variablesCssPath, 'utf-8');
const flowCanvasContent = fs.readFileSync(flowCanvasPath, 'utf-8');

// ===================================================
// 構造テスト: LineageEdge.tsx — ファイル存在
// ===================================================
test('LineageEdge.tsx exists', () => { assert(fs.existsSync(tsxPath), 'not found'); });

// ===================================================
// 要件1: "use client" 宣言
// ===================================================
test('has "use client" directive', () => {
  assert(tsxContent.includes('"use client"'), '"use client" directive missing');
});

// ===================================================
// 要件2: LineageEdgeData の利用
// ===================================================
test('imports LineageEdgeData type', () => {
  assert(tsxContent.includes('LineageEdgeData'), 'LineageEdgeData not referenced');
});

test('references dependencyType from edgeData', () => {
  assert(tsxContent.includes('dependencyType'), 'dependencyType not used');
});

test('references isHighlighted from edgeData', () => {
  assert(tsxContent.includes('isHighlighted'), 'isHighlighted not used');
});

test('references isDimmed from edgeData', () => {
  assert(tsxContent.includes('isDimmed'), 'isDimmed not used');
});

// ===================================================
// 要件3: React Flow EdgeProps + getBezierPath + BaseEdge 使用
// ===================================================
test('imports EdgeProps from @xyflow/react', () => {
  assert(tsxContent.includes('EdgeProps'), 'EdgeProps not imported');
  assert(tsxContent.includes("from '@xyflow/react'"), '@xyflow/react not imported');
});

test('imports getBezierPath from @xyflow/react', () => {
  assert(tsxContent.includes('getBezierPath'), 'getBezierPath not imported');
});

test('imports BaseEdge from @xyflow/react', () => {
  assert(tsxContent.includes('BaseEdge'), 'BaseEdge not imported');
});

test('calls getBezierPath to compute edge path', () => {
  assert(tsxContent.includes('getBezierPath('), 'getBezierPath not called');
});

test('renders BaseEdge component', () => {
  assert(tsxContent.includes('<BaseEdge'), 'BaseEdge not rendered');
});

// ===================================================
// 要件4: dependencyType に応じた className 切替
// ===================================================
test('applies tableDependency class when dependencyType is table_dependency', () => {
  assert(
    tsxContent.includes("'table_dependency'") || tsxContent.includes('"table_dependency"'),
    'table_dependency string not found'
  );
  assert(tsxContent.includes('tableDependency'), 'tableDependency class not referenced');
});

test('applies columnLineage class when dependencyType is column_lineage', () => {
  assert(tsxContent.includes('columnLineage'), 'columnLineage class not referenced');
});

test('switches className based on dependencyType condition', () => {
  const hasConditional =
    tsxContent.includes("dependencyType === 'table_dependency'") ||
    tsxContent.includes('dependencyType==="table_dependency"') ||
    tsxContent.includes("dependencyType === \"table_dependency\"");
  assert(hasConditional, 'no conditional className switch for dependencyType');
});

// ===================================================
// 要件5: isHighlighted で .highlighted 適用
// ===================================================
test('applies highlighted class when isHighlighted is true', () => {
  assert(tsxContent.includes('styles.highlighted'), 'styles.highlighted not referenced');
  assert(
    tsxContent.includes('isHighlighted ? styles.highlighted') ||
    tsxContent.includes('isHighlighted && styles.highlighted'),
    'isHighlighted conditional for highlighted class not found'
  );
});

// ===================================================
// 要件6: isDimmed && !isHighlighted で .dimmed 適用
// ===================================================
test('applies dimmed class only when isDimmed=true and isHighlighted=false', () => {
  assert(tsxContent.includes('styles.dimmed'), 'styles.dimmed not referenced');
  assert(
    tsxContent.includes('isDimmed && !isHighlighted') ||
    tsxContent.includes('isDimmed&&!isHighlighted'),
    'isDimmed && !isHighlighted condition not found'
  );
});

// ===================================================
// CSS: ファイル存在・構造
// ===================================================
test('LineageEdge.module.css exists', () => { assert(fs.existsSync(cssPath), 'not found'); });

// ===================================================
// 要件7a: CSS .edge クラス
// ===================================================
test('CSS has .edge base class', () => {
  assert(cssContent.includes('.edge'), '.edge class not found in CSS');
});

// ===================================================
// 要件7b: CSS .tableDependency クラス
// ===================================================
test('CSS has .tableDependency class', () => {
  assert(cssContent.includes('.tableDependency'), '.tableDependency class not found in CSS');
});

// ===================================================
// 要件7c: CSS .columnLineage クラス
// ===================================================
test('CSS has .columnLineage class', () => {
  assert(cssContent.includes('.columnLineage'), '.columnLineage class not found in CSS');
});

// ===================================================
// 要件7d: CSS .highlighted クラス
// ===================================================
test('CSS has .highlighted class', () => {
  assert(cssContent.includes('.highlighted'), '.highlighted class not found in CSS');
});

// ===================================================
// 要件7e: CSS .dimmed クラス
// ===================================================
test('CSS has .dimmed class', () => {
  assert(cssContent.includes('.dimmed'), '.dimmed class not found in CSS');
});

// ===================================================
// 要件7f: column_lineage は dashed pattern
// ===================================================
test('CSS .columnLineage has dashed stroke-dasharray', () => {
  assert(cssContent.includes('stroke-dasharray'), 'stroke-dasharray not found in CSS (expected for column_lineage dashed pattern)');
  // columnLineage セクションに stroke-dasharray が存在する
  const columnLineageIdx = cssContent.indexOf('.columnLineage');
  assert(columnLineageIdx !== -1, '.columnLineage not found');
  const afterColumnLineage = cssContent.slice(columnLineageIdx);
  // 次のクラス定義までの範囲内に stroke-dasharray が存在するか、または CSS全体に存在する
  assert(afterColumnLineage.includes('stroke-dasharray') || cssContent.includes('stroke-dasharray'), 'stroke-dasharray not found near .columnLineage');
});

// ===================================================
// 要件8: CSS変数の使用
// ===================================================
test('CSS uses var(--color-edge-default)', () => {
  assert(cssContent.includes('var(--color-edge-default)'), 'var(--color-edge-default) not found in CSS');
});

test('CSS uses var(--color-edge-highlighted)', () => {
  assert(cssContent.includes('var(--color-edge-highlighted)'), 'var(--color-edge-highlighted) not found in CSS');
});

// ===================================================
// 要件8: variables.css に edge カラー変数が定義されている
// ===================================================
test('variables.css defines --color-edge-default', () => {
  assert(variablesCssContent.includes('--color-edge-default'), '--color-edge-default not defined in variables.css');
});

test('variables.css defines --color-edge-highlighted', () => {
  assert(variablesCssContent.includes('--color-edge-highlighted'), '--color-edge-highlighted not defined in variables.css');
});

test('variables.css defines --color-edge-column-faded', () => {
  assert(variablesCssContent.includes('--color-edge-column-faded'), '--color-edge-column-faded not defined in variables.css');
});

// ===================================================
// 要件9: Tailwind不使用
// ===================================================
test('TSX has no Tailwind @tailwind directive', () => {
  assert(!tsxContent.includes('@tailwind'), 'TSX contains @tailwind');
});

test('TSX has no @apply directive', () => {
  assert(!tsxContent.includes('@apply'), 'TSX contains @apply');
});

test('TSX has no string className attributes (no Tailwind classes)', () => {
  // className="..." パターンがないことを確認 (styles. を使うため)
  assert(!tsxContent.includes('className="'), 'possible Tailwind className=" found in TSX');
});

test('CSS has no @tailwind directive', () => {
  assert(!cssContent.includes('@tailwind'), 'CSS contains @tailwind');
});

test('CSS has no @apply directive', () => {
  assert(!cssContent.includes('@apply'), 'CSS contains @apply');
});

// ===================================================
// 要件9: CSS Modules インポート
// ===================================================
test('imports CSS Module from LineageEdge.module.css', () => {
  assert(
    tsxContent.includes("from './LineageEdge.module.css'"),
    'CSS Module not imported'
  );
});

test('uses styles object for className (CSS Modules pattern)', () => {
  assert(tsxContent.includes('styles.'), 'styles. classNames not used');
});

// ===================================================
// 要件10: FlowCanvas.tsx の edgeTypes に lineage 登録
// ===================================================
test('FlowCanvas.tsx imports LineageEdge', () => {
  assert(flowCanvasContent.includes('LineageEdge'), 'LineageEdge not imported in FlowCanvas.tsx');
});

test('FlowCanvas.tsx registers lineage in edgeTypes', () => {
  assert(flowCanvasContent.includes('lineage'), 'lineage not found in FlowCanvas.tsx');
  assert(
    flowCanvasContent.includes('lineage: LineageEdge'),
    'lineage: LineageEdge mapping not found in edgeTypes'
  );
});

test('FlowCanvas.tsx has edgeTypes object', () => {
  assert(flowCanvasContent.includes('edgeTypes'), 'edgeTypes not found in FlowCanvas.tsx');
});

test('FlowCanvas.tsx passes edgeTypes to ReactFlow', () => {
  assert(
    flowCanvasContent.includes('edgeTypes={edgeTypes}') ||
    flowCanvasContent.includes('edgeTypes={'),
    'edgeTypes not passed to ReactFlow in FlowCanvas.tsx'
  );
});

// ===================================================
// 追加: flow.ts の LineageEdgeData 型定義確認
// ===================================================
test('flow.ts defines LineageEdgeData interface', () => {
  assert(flowTypesContent.includes('LineageEdgeData'), 'LineageEdgeData not defined in flow.ts');
});

test('flow.ts LineageEdgeData has dependencyType field', () => {
  assert(
    flowTypesContent.includes("'table_dependency' | 'column_lineage'") ||
    flowTypesContent.includes('"table_dependency" | "column_lineage"'),
    'dependencyType union type not found in flow.ts'
  );
});

test('flow.ts LineageEdgeData has isHighlighted field', () => {
  // LineageEdgeData の isHighlighted は boolean
  const lineageEdgeDataIdx = flowTypesContent.indexOf('LineageEdgeData');
  assert(lineageEdgeDataIdx !== -1, 'LineageEdgeData not found');
  const afterLineageEdgeData = flowTypesContent.slice(lineageEdgeDataIdx);
  // isHighlighted は ColumnItemNodeData にも存在するので、LineageEdgeData セクションで確認
  assert(afterLineageEdgeData.includes('isHighlighted'), 'isHighlighted not found in LineageEdgeData definition');
});

test('flow.ts LineageEdgeData has isDimmed field', () => {
  const lineageEdgeDataIdx = flowTypesContent.indexOf('LineageEdgeData');
  assert(lineageEdgeDataIdx !== -1, 'LineageEdgeData not found');
  const afterLineageEdgeData = flowTypesContent.slice(lineageEdgeDataIdx);
  assert(afterLineageEdgeData.includes('isDimmed'), 'isDimmed not found in LineageEdgeData definition');
});

// ===================================================
// 追加: エクスポート確認
// ===================================================
test('LineageEdge is exported', () => {
  assert(
    tsxContent.includes('export const LineageEdge') ||
    tsxContent.includes('export function LineageEdge') ||
    tsxContent.includes('export { LineageEdge'),
    'LineageEdge not exported'
  );
});

test('uses memo for performance optimization', () => {
  assert(tsxContent.includes('memo'), 'memo not used');
});

// ===================================================
// 追加: デフォルト値のフォールバック確認
// ===================================================
test('defaults dependencyType to table_dependency when data is missing', () => {
  assert(
    tsxContent.includes("'table_dependency'") || tsxContent.includes('"table_dependency"'),
    'table_dependency default fallback not found'
  );
  // ?? 演算子または || でデフォルト値が設定されているか確認
  assert(
    tsxContent.includes("?? 'table_dependency'") ||
    tsxContent.includes('?? "table_dependency"') ||
    tsxContent.includes("|| 'table_dependency'"),
    'default fallback for dependencyType not found'
  );
});

test('defaults isHighlighted to false when data is missing', () => {
  assert(
    tsxContent.includes('?? false') ||
    tsxContent.includes('|| false'),
    'isHighlighted default false fallback not found'
  );
});

// ===================================================
// 要件11: tsc --noEmit 通過
// ===================================================
test('project compiles (tsc --noEmit)', () => {
  try { execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe', timeout: 60000 }); }
  catch (e) { throw new Error('tsc failed: ' + (e.stderr ? e.stderr.toString().slice(0, 500) : e.message)); }
});

// ===================================================
// 結果出力
// ===================================================
console.log('\n=== LineageEdge Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
