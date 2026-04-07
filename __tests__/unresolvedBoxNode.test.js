/**
 * UnresolvedBoxNode + CSS テスト (Beads: sql_viz_202604_2-uup.1)
 *
 * カバー要件:
 * 1. "use client" 宣言
 * 2. UnresolvedBoxNodeData の利用 (tableName, inferredColumns, displayMode)
 * 3. `[未登録]` プレフィックスを描画
 * 4. compact 表示時はカラム数表示、detail 表示時は inferredColumns 一覧
 * 5. compact/detail トグルが useFlowStore.toggleDisplayMode を呼ぶ
 * 6. React Flow Handle (Left/Right) を配置
 * 7. CSS: dashed border、--color-bg-unresolved背景、.inferred の italic、CSS Modules、Tailwind不使用
 * 8. FlowCanvas.tsx の nodeTypes に unresolvedBox: UnresolvedBoxNode が登録されている
 * 9. tsc --noEmit 通過
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
const tsxPath = path.join(ROOT, 'src', 'components', 'visualizer', 'nodes', 'UnresolvedBoxNode.tsx');
const cssPath = path.join(ROOT, 'src', 'components', 'visualizer', 'nodes', 'UnresolvedBoxNode.module.css');
const flowCanvasPath = path.join(ROOT, 'src', 'components', 'visualizer', 'FlowCanvas.tsx');

const tsxContent = fs.readFileSync(tsxPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');
const flowCanvasContent = fs.readFileSync(flowCanvasPath, 'utf-8');

// ===================================================
// 構造テスト: UnresolvedBoxNode.tsx — ファイル存在
// ===================================================
test('UnresolvedBoxNode.tsx exists', () => { assert(fs.existsSync(tsxPath), 'not found'); });

// ===================================================
// 要件1: "use client" 宣言
// ===================================================
test('has "use client" directive', () => {
  assert(tsxContent.includes('"use client"'), '"use client" directive missing');
});

// ===================================================
// 要件2: UnresolvedBoxNodeData の利用
// ===================================================
test('imports UnresolvedBoxNodeData type', () => {
  assert(tsxContent.includes('UnresolvedBoxNodeData'), 'UnresolvedBoxNodeData not referenced');
});

test('destructures tableName from nodeData', () => {
  assert(tsxContent.includes('tableName'), 'tableName not used');
});

test('destructures inferredColumns from nodeData', () => {
  assert(tsxContent.includes('inferredColumns'), 'inferredColumns not used');
});

test('destructures displayMode from nodeData', () => {
  assert(tsxContent.includes('displayMode'), 'displayMode not used');
});

// ===================================================
// 要件3: [未登録] プレフィックスを描画
// ===================================================
test('renders [未登録] prefix text', () => {
  assert(tsxContent.includes('[未登録]'), '[未登録] prefix not rendered');
});

// ===================================================
// 要件4a: compact 表示時はカラム数表示
// ===================================================
test('compact mode: renders column count', () => {
  assert(
    tsxContent.includes("displayMode === 'compact'") || tsxContent.includes('displayMode==="compact"'),
    'no compact mode condition'
  );
  assert(
    tsxContent.includes('inferredColumns.length'),
    'inferredColumns.length not used for count display'
  );
});

test('compact mode: shows count text with 件', () => {
  assert(tsxContent.includes('件'), 'compact count text (件) not found');
});

// ===================================================
// 要件4b: detail 表示時は inferredColumns 一覧
// ===================================================
test('detail mode: maps inferredColumns to list', () => {
  assert(tsxContent.includes('inferredColumns.map'), 'inferredColumns.map not found for detail mode');
});

// ===================================================
// 要件5: compact/detail トグルが useFlowStore.toggleDisplayMode を呼ぶ
// ===================================================
test('imports useFlowStore', () => {
  assert(tsxContent.includes('useFlowStore'), 'useFlowStore not imported');
});

test('references toggleDisplayMode from store', () => {
  assert(tsxContent.includes('toggleDisplayMode'), 'toggleDisplayMode not referenced');
});

test('calls toggleDisplayMode with node id', () => {
  assert(
    tsxContent.includes('toggleDisplayMode(id)'),
    'toggleDisplayMode not called with id'
  );
});

test('titleBar has onClick handler for toggle', () => {
  assert(tsxContent.includes('onClick'), 'onClick handler missing on titleBar');
});

// ===================================================
// 要件6: React Flow Handle (Left/Right) を配置
// ===================================================
test('imports Handle from @xyflow/react', () => {
  assert(tsxContent.includes('Handle'), 'Handle not imported');
  assert(tsxContent.includes("from '@xyflow/react'"), '@xyflow/react not imported');
});

test('imports Position from @xyflow/react', () => {
  assert(tsxContent.includes('Position'), 'Position not imported');
});

test('renders target Handle on Position.Left', () => {
  assert(
    tsxContent.includes('Position.Left'),
    'Position.Left not used (target/left Handle)'
  );
  assert(
    tsxContent.includes('type="target"'),
    'target Handle missing'
  );
});

test('renders source Handle on Position.Right', () => {
  assert(
    tsxContent.includes('Position.Right'),
    'Position.Right not used (source/right Handle)'
  );
  assert(
    tsxContent.includes('type="source"'),
    'source Handle missing'
  );
});

// ===================================================
// 要件7: CSS Modules インポート
// ===================================================
test('imports CSS Module', () => {
  assert(
    tsxContent.includes("from './UnresolvedBoxNode.module.css'"),
    'CSS Module not imported'
  );
});

test('uses styles object for className', () => {
  assert(tsxContent.includes('styles.'), 'styles. classNames not used');
});

// No Tailwind in TSX
test('no Tailwind utility classes in TSX (no className="")', () => {
  assert(!tsxContent.includes('className="'), 'possible Tailwind className found in TSX');
});

// ===================================================
// 要件7: CSS ファイル存在・構造
// ===================================================
test('UnresolvedBoxNode.module.css exists', () => { assert(fs.existsSync(cssPath), 'not found'); });

test('CSS has dashed border', () => {
  assert(cssContent.includes('dashed'), 'dashed border not found in CSS');
});

test('CSS uses --color-bg-unresolved custom property', () => {
  assert(
    cssContent.includes('--color-bg-unresolved'),
    '--color-bg-unresolved not referenced in CSS'
  );
});

test('CSS has .container class', () => {
  assert(cssContent.includes('.container'), '.container class not found');
});

test('CSS has .titleBar class', () => {
  assert(cssContent.includes('.titleBar'), '.titleBar class not found');
});

test('CSS has .prefix class', () => {
  assert(cssContent.includes('.prefix'), '.prefix class not found');
});

test('CSS has inferred column italic style', () => {
  // .inferredColumn または .compactCount 等に font-style: italic が適用されている
  assert(
    cssContent.includes('italic'),
    'font-style: italic not found for inferred column styling'
  );
});

test('CSS has .compactBody or .compactCount class', () => {
  assert(
    cssContent.includes('.compactBody') || cssContent.includes('.compactCount'),
    '.compactBody/.compactCount class not found'
  );
});

test('CSS has .detailBody or .inferredColumn class', () => {
  assert(
    cssContent.includes('.detailBody') || cssContent.includes('.inferredColumn'),
    '.detailBody/.inferredColumn class not found'
  );
});

test('CSS uses CSS Custom Properties (var(--)', () => {
  assert(cssContent.includes('var(--'), 'no CSS Custom Properties found');
});

test('CSS has hover style', () => {
  assert(cssContent.includes(':hover'), ':hover style not found');
});

test('CSS has no @tailwind or @apply', () => {
  assert(!cssContent.includes('@tailwind'), 'CSS contains @tailwind');
  assert(!cssContent.includes('@apply'), 'CSS contains @apply');
});

// ===================================================
// 要件8: FlowCanvas.tsx の nodeTypes に unresolvedBox 登録
// ===================================================
test('FlowCanvas.tsx imports UnresolvedBoxNode', () => {
  assert(
    flowCanvasContent.includes('UnresolvedBoxNode'),
    'UnresolvedBoxNode not imported in FlowCanvas.tsx'
  );
});

test('FlowCanvas.tsx registers unresolvedBox in nodeTypes', () => {
  assert(
    flowCanvasContent.includes('unresolvedBox'),
    'unresolvedBox not found in FlowCanvas.tsx nodeTypes'
  );
  assert(
    flowCanvasContent.includes('unresolvedBox: UnresolvedBoxNode'),
    'unresolvedBox: UnresolvedBoxNode mapping not found in nodeTypes'
  );
});

test('FlowCanvas.tsx has nodeTypes object passed to ReactFlow', () => {
  assert(
    flowCanvasContent.includes('nodeTypes'),
    'nodeTypes not found in FlowCanvas.tsx'
  );
});

// ===================================================
// 追加: エクスポート確認
// ===================================================
test('UnresolvedBoxNode is exported', () => {
  assert(
    tsxContent.includes('export const UnresolvedBoxNode') ||
    tsxContent.includes('export function UnresolvedBoxNode') ||
    tsxContent.includes('export { UnresolvedBoxNode'),
    'UnresolvedBoxNode not exported'
  );
});

test('uses memo for performance optimization', () => {
  assert(tsxContent.includes('memo'), 'memo not used');
});

test('uses useCallback for toggle handler', () => {
  assert(tsxContent.includes('useCallback'), 'useCallback not used for handler');
});

// ===================================================
// 要件9: tsc --noEmit 通過
// ===================================================
test('project compiles (tsc --noEmit)', () => {
  try { execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe', timeout: 60000 }); }
  catch (e) { throw new Error('tsc failed: ' + (e.stderr ? e.stderr.toString().slice(0, 500) : e.message)); }
});

// ===================================================
// 結果出力
// ===================================================
console.log('\n=== UnresolvedBoxNode Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
