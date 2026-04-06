const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const results = [];
let failed = false;
let aborted = false;

function test(name, fn) {
  if (aborted) {
    results.push({ name, status: 'SKIP', error: 'skipped due to prior critical failure' });
    return;
  }
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

// --- File existence ---

const variablesPath = path.join(ROOT, 'src', 'styles', 'variables.css');

test('src/styles/variables.css exists', () => {
  if (!fs.existsSync(variablesPath)) {
    aborted = true;
    throw new Error('variables.css not found');
  }
});

const content = fs.existsSync(variablesPath) ? fs.readFileSync(variablesPath, 'utf-8') : '';

// --- :root selector ---

test('variables.css contains :root selector', () => {
  assert(content.includes(':root'), ':root selector not found');
});

// --- Color palette variables ---

const colorVars = [
  ['--color-bg-primary', '#ffffff'],
  ['--color-bg-secondary', '#f8f9fa'],
  ['--color-bg-node', '#ffffff'],
  ['--color-bg-unresolved', '#f0f0f0'],
  ['--color-border-node', '#d0d5dd'],
  ['--color-border-unresolved', '#98a2b3'],
  ['--color-border-clause', '#e4e7ec'],
  ['--color-text-primary', '#101828'],
  ['--color-text-secondary', '#475467'],
  ['--color-text-inferred', '#667085'],
  ['--color-accent', '#2563eb'],
  ['--color-highlight', '#f59e0b'],
];

for (const [varName, expectedValue] of colorVars) {
  test(`variables.css defines ${varName}: ${expectedValue}`, () => {
    assert(content.includes(varName), `${varName} not found`);
    const regex = new RegExp(`${varName.replace(/[-/]/g, '\\$&')}\\s*:\\s*${expectedValue.replace('#', '\\#')}`);
    assert(regex.test(content), `${varName} value does not match ${expectedValue}`);
  });
}

// --- Spacing variables ---

const spacingVars = [
  ['--spacing-xs', '4px'],
  ['--spacing-sm', '8px'],
  ['--spacing-md', '12px'],
  ['--spacing-lg', '16px'],
  ['--spacing-xl', '24px'],
];

for (const [varName, expectedValue] of spacingVars) {
  test(`variables.css defines ${varName}: ${expectedValue}`, () => {
    assert(content.includes(varName), `${varName} not found`);
    const regex = new RegExp(`${varName.replace(/[-/]/g, '\\$&')}\\s*:\\s*${expectedValue}`);
    assert(regex.test(content), `${varName} value does not match ${expectedValue}`);
  });
}

// --- Node size variables ---

const nodeVars = [
  ['--node-title-height', '32px'],
  ['--node-border-radius', '8px'],
  ['--node-min-width', '180px'],
];

for (const [varName, expectedValue] of nodeVars) {
  test(`variables.css defines ${varName}: ${expectedValue}`, () => {
    assert(content.includes(varName), `${varName} not found`);
    const regex = new RegExp(`${varName.replace(/[-/]/g, '\\$&')}\\s*:\\s*${expectedValue}`);
    assert(regex.test(content), `${varName} value does not match ${expectedValue}`);
  });
}

// --- globals.css imports variables.css ---

test('globals.css imports variables.css', () => {
  const globalsPath = path.join(ROOT, 'src', 'app', 'globals.css');
  assert(fs.existsSync(globalsPath), 'globals.css not found');
  const globalsContent = fs.readFileSync(globalsPath, 'utf-8');
  assert(
    globalsContent.includes("@import '../styles/variables.css'") ||
    globalsContent.includes("@import \"../styles/variables.css\""),
    'globals.css does not import variables.css'
  );
});

// --- No Tailwind ---

test('variables.css does not contain @tailwind', () => {
  assert(!content.includes('@tailwind'), '@tailwind found in variables.css');
});

test('variables.css does not contain @apply', () => {
  assert(!content.includes('@apply'), '@apply found in variables.css');
});

// --- Output results ---
console.log('\n=== Test Results ===\n');
for (const r of results) {
  if (r.status === 'PASS') {
    console.log(`  PASS: ${r.name}`);
  } else if (r.status === 'SKIP') {
    console.log(`  SKIP: ${r.name}`);
  } else {
    console.log(`  FAIL: ${r.name} - ${r.error}`);
  }
}
const passCount = results.filter(r => r.status === 'PASS').length;
const skipCount = results.filter(r => r.status === 'SKIP').length;
console.log(`\n  ${passCount}/${results.length} tests passed` + (skipCount > 0 ? `, ${skipCount} skipped` : '') + '\n');

process.exit(failed ? 1 : 0);
