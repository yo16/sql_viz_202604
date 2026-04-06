const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Required directories from architecture.md
const requiredDirs = [
  'app/api/parse',
  'components/visualizer/nodes',
  'components/visualizer/edges',
  'components/input',
  'components/ui',
  'layout',
  'lib/parser',
  'lib/lineage',
  'lib/validators',
  'hooks',
  'stores',
  'types',
];

// Test each required directory exists
for (const dir of requiredDirs) {
  test(`src/${dir}/ directory exists`, () => {
    const dirPath = path.join(SRC, dir);
    assert(fs.existsSync(dirPath), `Directory not found: src/${dir}/`);
    assert(fs.statSync(dirPath).isDirectory(), `Not a directory: src/${dir}/`);
  });
}

// Test that directories with no other files have .gitkeep
const dirsNeedingGitkeep = [
  'app/api/parse',
  'components/visualizer/nodes',
  'components/visualizer/edges',
  'components/input',
  'components/ui',
  'layout',
  'lib/parser',
  'lib/lineage',
  'lib/validators',
  'hooks',
  'stores',
  'types',
];

for (const dir of dirsNeedingGitkeep) {
  test(`src/${dir}/ has .gitkeep for git tracking`, () => {
    const gitkeepPath = path.join(SRC, dir, '.gitkeep');
    assert(fs.existsSync(gitkeepPath), `.gitkeep not found in src/${dir}/`);
  });
}

// Test existing files are preserved
test('src/app/layout.tsx is preserved', () => {
  assert(fs.existsSync(path.join(SRC, 'app', 'layout.tsx')), 'layout.tsx was deleted');
});

test('src/app/page.tsx is preserved', () => {
  assert(fs.existsSync(path.join(SRC, 'app', 'page.tsx')), 'page.tsx was deleted');
});

test('src/app/globals.css is preserved', () => {
  assert(fs.existsSync(path.join(SRC, 'app', 'globals.css')), 'globals.css was deleted');
});

// Output results
console.log('\n=== Test Results ===\n');
for (const r of results) {
  if (r.status === 'PASS') {
    console.log(`  PASS: ${r.name}`);
  } else {
    console.log(`  FAIL: ${r.name} - ${r.error}`);
  }
}
const passCount = results.filter(r => r.status === 'PASS').length;
console.log(`\n  ${passCount}/${results.length} tests passed\n`);

process.exit(failed ? 1 : 0);
