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

function containsPattern(lines, pattern) {
  return lines.some(line => line.includes(pattern));
}

// Test 1: .git directory exists
test('.git directory exists (git initialized)', () => {
  const gitDir = path.join(ROOT, '.git');
  assert(fs.existsSync(gitDir), '.git directory not found');
  assert(fs.statSync(gitDir).isDirectory(), '.git is not a directory');
});

// Test 2: .gitignore file exists (critical - skip remaining if fails)
test('.gitignore file exists', () => {
  const gitignore = path.join(ROOT, '.gitignore');
  if (!fs.existsSync(gitignore)) {
    aborted = true;
    throw new Error('.gitignore file not found - skipping content tests');
  }
  assert(fs.statSync(gitignore).isFile(), '.gitignore is not a file');
});

// Read .gitignore content for remaining tests
const gitignorePath = path.join(ROOT, '.gitignore');
const content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';
const lines = content.split('\n').map(l => l.trim());

// Test 3: node_modules pattern
test('.gitignore contains node_modules exclusion', () => {
  assert(containsPattern(lines, 'node_modules'), 'node_modules pattern not found');
});

// Test 4: .next pattern
test('.gitignore contains .next exclusion', () => {
  assert(containsPattern(lines, '.next'), '.next pattern not found');
});

// Test 5: .env.local pattern
test('.gitignore contains .env.local', () => {
  assert(containsPattern(lines, '.env.local'), '.env.local pattern not found');
});

// Test 6: .env.development.local pattern
test('.gitignore contains .env.development.local', () => {
  assert(containsPattern(lines, '.env.development.local'), '.env.development.local pattern not found');
});

// Test 7: .env.test.local pattern
test('.gitignore contains .env.test.local', () => {
  assert(containsPattern(lines, '.env.test.local'), '.env.test.local pattern not found');
});

// Test 8: .env.production.local pattern
test('.gitignore contains .env.production.local', () => {
  assert(containsPattern(lines, '.env.production.local'), '.env.production.local pattern not found');
});

// Test 9: .vercel pattern
test('.gitignore contains .vercel exclusion', () => {
  assert(containsPattern(lines, '.vercel'), '.vercel pattern not found');
});

// Test 10: tmp/ pattern
test('.gitignore contains tmp/ exclusion', () => {
  assert(containsPattern(lines, 'tmp/'), 'tmp/ pattern not found');
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
