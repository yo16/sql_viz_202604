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

const tsxPath = path.join(ROOT, 'src', 'components', 'visualizer', 'nodes', 'ClauseBoxNode.tsx');
const cssPath = path.join(ROOT, 'src', 'components', 'visualizer', 'nodes', 'ClauseBoxNode.module.css');
const tsxContent = fs.readFileSync(tsxPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

// --- TSX structure ---
test('ClauseBoxNode.tsx exists', () => { assert(fs.existsSync(tsxPath), 'not found'); });
test('has "use client" directive', () => { assert(tsxContent.includes('"use client"'), 'missing'); });
test('exports ClauseBoxNode (memo)', () => { assert(tsxContent.includes('export const ClauseBoxNode = memo'), 'not exported with memo'); });
test('imports ClauseBoxNodeData from @/types/flow', () => { assert(tsxContent.includes('ClauseBoxNodeData'), 'missing'); });
test('imports CSS Module', () => { assert(tsxContent.includes("from './ClauseBoxNode.module.css'"), 'missing'); });
test('renders clauseType', () => { assert(tsxContent.includes('{clauseType}'), 'no clauseType render'); });
test('renders label conditionally', () => { assert(tsxContent.includes('{label}') || tsxContent.includes('label &&'), 'no label render'); });

// JOIN icons
test('has JOIN_ICONS mapping', () => { assert(tsxContent.includes('JOIN_ICONS'), 'no JOIN_ICONS'); });
test('has all 5 JOIN icons (INNER/LEFT/RIGHT/FULL/CROSS)', () => {
  assert(tsxContent.includes('INNER'), 'no INNER');
  assert(tsxContent.includes('LEFT'), 'no LEFT');
  assert(tsxContent.includes('RIGHT'), 'no RIGHT');
  assert(tsxContent.includes('FULL'), 'no FULL');
  assert(tsxContent.includes('CROSS'), 'no CROSS');
});
test('has JOIN icon symbols', () => {
  assert(tsxContent.includes('⋈'), 'no ⋈');
  assert(tsxContent.includes('⟕'), 'no ⟕');
  assert(tsxContent.includes('⟖'), 'no ⟖');
  assert(tsxContent.includes('⟗'), 'no ⟗');
  assert(tsxContent.includes('×'), 'no ×');
});
test('has detectJoinIcon function', () => { assert(tsxContent.includes('detectJoinIcon'), 'no detectJoinIcon'); });
test('only shows JOIN icon for FROM clause', () => { assert(tsxContent.includes("clauseType === 'FROM'"), 'no FROM check'); });
test('renders joinIcon conditionally', () => { assert(tsxContent.includes('joinIcon &&') || tsxContent.includes('{joinIcon &&'), 'no conditional icon'); });

// No Tailwind
test('no Tailwind classes', () => { assert(!tsxContent.includes('className="'), 'possible Tailwind'); });

// --- CSS structure ---
test('ClauseBoxNode.module.css exists', () => { assert(fs.existsSync(cssPath), 'not found'); });
test('CSS has .container class', () => { assert(cssContent.includes('.container'), 'no .container'); });
test('CSS has .header class', () => { assert(cssContent.includes('.header'), 'no .header'); });
test('CSS has .clauseType class', () => { assert(cssContent.includes('.clauseType'), 'no .clauseType'); });
test('CSS has .joinIcon class', () => { assert(cssContent.includes('.joinIcon'), 'no .joinIcon'); });
test('CSS has .label class', () => { assert(cssContent.includes('.label'), 'no .label'); });
test('CSS uses CSS Custom Properties', () => { assert(cssContent.includes('var(--'), 'no custom props'); });
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
console.log('\n=== ClauseBoxNode Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
