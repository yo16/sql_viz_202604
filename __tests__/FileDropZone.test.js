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

const tsxPath = path.join(ROOT, 'src', 'components', 'input', 'FileDropZone.tsx');
const cssPath = path.join(ROOT, 'src', 'components', 'input', 'FileDropZone.module.css');
const tsxContent = fs.readFileSync(tsxPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

// --- TSX structure ---
test('FileDropZone.tsx exists', () => { assert(fs.existsSync(tsxPath), 'not found'); });
test('has "use client" directive', () => { assert(tsxContent.includes('"use client"'), 'missing'); });
test('exports FileDropZone function', () => { assert(tsxContent.includes('export function FileDropZone'), 'not exported'); });
test('exports FileDropZoneProps interface', () => { assert(tsxContent.includes('export interface FileDropZoneProps'), 'no props interface'); });
test('exports FileContent interface', () => { assert(tsxContent.includes('export interface FileContent'), 'no FileContent'); });
test('imports CSS Module', () => { assert(tsxContent.includes("from './FileDropZone.module.css'"), 'missing'); });

// FileContent fields
test('FileContent has fileName', () => { assert(tsxContent.includes('fileName:'), 'no fileName'); });
test('FileContent has content', () => { assert(tsxContent.includes('content:'), 'no content'); });

// Props
test('props has onFilesLoaded', () => { assert(tsxContent.includes('onFilesLoaded:'), 'no onFilesLoaded'); });

// Drag events
test('has handleDragOver', () => { assert(tsxContent.includes('onDragOver'), 'no onDragOver'); });
test('has handleDragLeave', () => { assert(tsxContent.includes('onDragLeave'), 'no onDragLeave'); });
test('has handleDrop', () => { assert(tsxContent.includes('onDrop='), 'no onDrop'); });
test('prevents default on drag events', () => { assert(tsxContent.includes('preventDefault'), 'no preventDefault'); });

// File reading
test('uses FileReader for reading files', () => { assert(tsxContent.includes('FileReader'), 'no FileReader'); });
test('reads files as text', () => { assert(tsxContent.includes('readAsText'), 'no readAsText'); });

// Validation
test('validates .sql extension', () => { assert(tsxContent.includes("'.sql'"), 'no .sql check'); });
test('shows error for invalid files', () => { assert(tsxContent.includes('setError'), 'no error state'); });

// File input
test('has hidden file input with accept=".sql"', () => {
  assert(tsxContent.includes('type="file"'), 'no file input');
  assert(tsxContent.includes('accept=".sql"'), 'no accept');
});
test('supports multiple file selection', () => { assert(tsxContent.includes('multiple'), 'no multiple'); });

// State management
test('uses useState for files', () => { assert(tsxContent.includes('useState'), 'no useState'); });
test('uses useRef for fileInput', () => { assert(tsxContent.includes('useRef'), 'no useRef'); });

// onFilesLoaded callback
test('calls onFilesLoaded on add', () => {
  // Should appear in handleFiles
  assert(tsxContent.includes('onFilesLoaded('), 'no onFilesLoaded call');
});
test('calls onFilesLoaded on remove', () => {
  // handleRemoveFile should also call onFilesLoaded
  const removeSection = tsxContent.split('handleRemoveFile')[1]?.split('handleClickZone')[0] ?? '';
  assert(removeSection.includes('onFilesLoaded'), 'no onFilesLoaded in remove');
});

// File list & remove
test('renders file list', () => { assert(tsxContent.includes('files.map'), 'no file list'); });
test('has remove button per file', () => { assert(tsxContent.includes('handleRemoveFile'), 'no remove'); });

// Dragging state
test('tracks dragging state', () => { assert(tsxContent.includes('isDragging'), 'no isDragging'); });

// Keyboard accessibility
test('has role="button" and tabIndex', () => {
  assert(tsxContent.includes('role="button"'), 'no role');
  assert(tsxContent.includes('tabIndex={0}'), 'no tabIndex');
});
test('has onKeyDown handler', () => { assert(tsxContent.includes('onKeyDown'), 'no onKeyDown'); });
test('handles Enter and Space', () => {
  assert(tsxContent.includes("'Enter'"), 'no Enter');
  assert(tsxContent.includes("' '"), 'no Space');
});
test('has aria-label on drop zone', () => { assert(tsxContent.includes('aria-label'), 'no aria-label'); });

// No Tailwind
test('no Tailwind classes', () => { assert(!tsxContent.includes('className="'), 'possible Tailwind'); });

// --- CSS structure ---
test('FileDropZone.module.css exists', () => { assert(fs.existsSync(cssPath), 'not found'); });
test('CSS has .container class', () => { assert(cssContent.includes('.container'), 'no .container'); });
test('CSS has .dropZone class', () => { assert(cssContent.includes('.dropZone'), 'no .dropZone'); });
test('CSS has .dragging class', () => { assert(cssContent.includes('.dragging'), 'no .dragging'); });
test('CSS has .fileList class', () => { assert(cssContent.includes('.fileList'), 'no .fileList'); });
test('CSS has .fileItem class', () => { assert(cssContent.includes('.fileItem'), 'no .fileItem'); });
test('CSS has .removeButton class', () => { assert(cssContent.includes('.removeButton'), 'no .removeButton'); });
test('CSS has .error class', () => { assert(cssContent.includes('.error'), 'no .error'); });
test('CSS uses CSS Custom Properties', () => { assert(cssContent.includes('var(--'), 'no custom props'); });
test('CSS has dashed border for dropZone', () => { assert(cssContent.includes('dashed'), 'no dashed border'); });
test('CSS has hover/focus styles', () => {
  assert(cssContent.includes(':hover'), 'no hover');
  assert(cssContent.includes(':focus-visible'), 'no focus-visible');
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
console.log('\n=== FileDropZone Tests ===\n');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' - ' + r.error : ''}`);
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);
process.exit(failed ? 1 : 0);
