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

const tsxPath = path.join(ROOT, 'src', 'components', 'visualizer', 'FlowCanvas.tsx');
const cssPath = path.join(ROOT, 'src', 'components', 'visualizer', 'FlowCanvas.module.css');
const tsxContent = fs.readFileSync(tsxPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

// --- TSX structure ---
test('FlowCanvas.tsx exists', () => { assert(fs.existsSync(tsxPath), 'not found'); });
test('has "use client" directive', () => { assert(tsxContent.includes('"use client"'), 'missing'); });
test('exports FlowCanvas function', () => { assert(tsxContent.includes('export function FlowCanvas'), 'not exported'); });
test('imports from @xyflow/react', () => { assert(tsxContent.includes("from '@xyflow/react'"), 'missing'); });
test('imports ReactFlow component', () => { assert(tsxContent.includes('ReactFlow'), 'no ReactFlow'); });
test('imports Controls', () => { assert(tsxContent.includes('Controls'), 'no Controls'); });
test('imports MiniMap', () => { assert(tsxContent.includes('MiniMap'), 'no MiniMap'); });
test('imports Background', () => { assert(tsxContent.includes('Background'), 'no Background'); });
test('imports React Flow CSS', () => { assert(tsxContent.includes('@xyflow/react/dist/style.css'), 'no react flow css'); });
test('imports useFlowStore', () => { assert(tsxContent.includes('useFlowStore'), 'missing'); });
test('imports CSS Module', () => { assert(tsxContent.includes("from './FlowCanvas.module.css'"), 'missing'); });

// React Flow props
test('passes nodes to ReactFlow', () => { assert(tsxContent.includes('nodes={'), 'no nodes prop'); });
test('passes edges to ReactFlow', () => { assert(tsxContent.includes('edges={'), 'no edges prop'); });
test('has onNodesChange handler', () => { assert(tsxContent.includes('onNodesChange'), 'no onNodesChange'); });
test('has onEdgesChange handler', () => { assert(tsxContent.includes('onEdgesChange'), 'no onEdgesChange'); });
test('has fitView prop', () => { assert(tsxContent.includes('fitView'), 'no fitView'); });
test('has minZoom/maxZoom', () => {
  assert(tsxContent.includes('minZoom'), 'no minZoom');
  assert(tsxContent.includes('maxZoom'), 'no maxZoom');
});
test('has onPaneClick for clearHighlight', () => {
  assert(tsxContent.includes('onPaneClick'), 'no onPaneClick');
  assert(tsxContent.includes('clearHighlight'), 'no clearHighlight');
});

// Data flow architecture
test('uses local state for nodes (not writing back to store)', () => {
  assert(tsxContent.includes('useState'), 'no useState for local state');
  assert(tsxContent.includes('setLocalNodes'), 'no setLocalNodes');
});
test('syncs from store via useEffect', () => {
  assert(tsxContent.includes('useEffect'), 'no useEffect for sync');
});
test('does not write to flowStore in onNodesChange', () => {
  // onNodesChange should call setLocalNodes, not useFlowStore.setState for nodes
  const onNodesSection = tsxContent.split('onNodesChange')[1]?.split('onEdgesChange')[0] ?? '';
  assert(!onNodesSection.includes('useFlowStore.setState'), 'should not write to store in onNodesChange');
});

// Renders child components
test('renders Controls component', () => { assert(tsxContent.includes('<Controls'), 'no Controls render'); });
test('renders MiniMap component', () => { assert(tsxContent.includes('<MiniMap'), 'no MiniMap render'); });
test('renders Background component', () => { assert(tsxContent.includes('<Background'), 'no Background render'); });

// No Tailwind
test('no Tailwind classes', () => { assert(!tsxContent.includes('className="'), 'possible Tailwind'); });

// --- CSS structure ---
test('FlowCanvas.module.css exists', () => { assert(fs.existsSync(cssPath), 'not found'); });
test('CSS has .container class', () => { assert(cssContent.includes('.container'), 'no .container'); });
test('CSS uses CSS Custom Properties', () => { assert(cssContent.includes('var(--'), 'no custom props'); });
test('CSS has width/height 100%', () => {
  assert(cssContent.includes('width: 100%'), 'no width 100%');
  assert(cssContent.includes('height: 100%'), 'no height 100%');
});
test('CSS has no @tailwind or @apply', () => {
  assert(!cssContent.includes('@tailwind'), 'has @tailwind');
  assert(!cssContent.includes('@apply'), 'has @apply');
});

// --- tsc ---
test('project compiles (tsc --noEmit)', () => {
  try { execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe', timeout: 60000 }); }
  catch (e) { throw new Error('tsc failed: ' + (e.stderr ? e.stderr.toString().slice(0, 500) : e.message)); }
});

// --- Output ---
console.log('\n=== FlowCanvas Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
