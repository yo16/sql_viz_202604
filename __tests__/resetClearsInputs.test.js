/**
 * リセットボタンで SqlInputPanel / FileDropZone の local state も
 * クリアされることを検証する。
 *
 * 対応Beadsタスク: sql_viz_202604_2-5zc
 *
 * 実装方針: lineageStore に resetCounter を追加し、resetAll で+1する。
 * SqlInputPanel / FileDropZone は resetCounter を購読して useEffect で
 * local state をクリアする。
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
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// --- Structure tests (source content) ---
const lineageStorePath = path.join(ROOT, 'src', 'stores', 'lineageStore.ts');
const sqlInputPath = path.join(ROOT, 'src', 'components', 'input', 'SqlInputPanel.tsx');
const fileDropPath = path.join(ROOT, 'src', 'components', 'input', 'FileDropZone.tsx');
const lineageSrc = fs.readFileSync(lineageStorePath, 'utf-8');
const sqlInputSrc = fs.readFileSync(sqlInputPath, 'utf-8');
const fileDropSrc = fs.readFileSync(fileDropPath, 'utf-8');

test('lineageStore declares resetCounter in state', () => {
  assert(/resetCounter\s*:\s*number/.test(lineageSrc), 'resetCounter: number not declared');
});
test('lineageStore resetAll increments resetCounter', () => {
  // resetAll の body に resetCounter が含まれていること
  const resetAllMatch = lineageSrc.match(/resetAll\s*:\s*\(\)\s*=>\s*\{[\s\S]*?\n\s{0,4}\},/);
  assert(resetAllMatch !== null, 'resetAll body not found');
  assert(resetAllMatch[0].includes('resetCounter'), 'resetAll does not mention resetCounter');
});
test('SqlInputPanel subscribes to resetCounter', () => {
  assert(sqlInputSrc.includes('resetCounter'), 'SqlInputPanel does not reference resetCounter');
  assert(sqlInputSrc.includes('useLineageStore'), 'SqlInputPanel does not import useLineageStore');
  assert(/useEffect/.test(sqlInputSrc), 'SqlInputPanel does not have useEffect');
});
test('FileDropZone subscribes to resetCounter', () => {
  assert(fileDropSrc.includes('resetCounter'), 'FileDropZone does not reference resetCounter');
  assert(fileDropSrc.includes('useLineageStore'), 'FileDropZone does not import useLineageStore');
  assert(/useEffect/.test(fileDropSrc), 'FileDropZone does not have useEffect');
});

// --- Functional test: resetAll increments counter ---
const FUNCTIONAL_TEST = `
import { useLineageStore } from '../src/stores/lineageStore';

const results: Array<{ name: string; status: string; error?: string }> = [];
let failed = false;
function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (e: any) { results.push({ name, status: 'FAIL', error: e.message }); failed = true; }
}
function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }

test('resetCounter starts at 0', () => {
  const c = (useLineageStore.getState() as any).resetCounter;
  assert(typeof c === 'number', 'resetCounter is not a number, got ' + typeof c);
  assert(c === 0, 'initial resetCounter should be 0, got ' + c);
});

test('resetAll increments resetCounter', () => {
  const before = (useLineageStore.getState() as any).resetCounter;
  useLineageStore.getState().resetAll();
  const after = (useLineageStore.getState() as any).resetCounter;
  assert(after === before + 1, 'resetCounter should increment by 1, before=' + before + ' after=' + after);
});

test('resetAll twice increments twice', () => {
  const before = (useLineageStore.getState() as any).resetCounter;
  useLineageStore.getState().resetAll();
  useLineageStore.getState().resetAll();
  const after = (useLineageStore.getState() as any).resetCounter;
  assert(after === before + 2, 'resetCounter should increment by 2, before=' + before + ' after=' + after);
});

console.log('\\n=== resetCounter Functional Tests ===\\n');
for (const r of results) {
  console.log('  ' + (r.status === 'PASS' ? 'PASS' : 'FAIL') + ': ' + r.name + (r.error ? ' - ' + r.error : ''));
}
const pc = results.filter(r => r.status === 'PASS').length;
console.log('\\n  ' + pc + '/' + results.length + ' tests passed\\n');
process.exit(failed ? 1 : 0);
`;

test('functional: resetCounter behavior (via tsx)', () => {
  const tmpDir = path.join(ROOT, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, 'resetCounter-test.ts');
  fs.writeFileSync(tmpFile, FUNCTIONAL_TEST);
  try {
    const out = execSync('npx tsx tmp/resetCounter-test.ts', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    const stdout = out.toString();
    console.log(stdout);
    if (stdout.includes('FAIL:')) throw new Error('functional test failed');
  } catch (e) {
    const stdout = e.stdout ? e.stdout.toString() : '';
    if (stdout) console.log(stdout);
    const stderr = e.stderr ? e.stderr.toString() : '';
    throw new Error('Failed: ' + (stderr.slice(0, 600) || e.message));
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
});

console.log('\n=== resetClearsInputs Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const pass = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${pass}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
