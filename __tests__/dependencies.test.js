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

// --- package.json parsing ---

const pkgPath = path.join(ROOT, 'package.json');
let pkg = null;

test('package.json exists and is valid JSON', () => {
  assert(fs.existsSync(pkgPath), 'package.json not found');
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch (e) {
    aborted = true;
    throw new Error('package.json is not valid JSON: ' + e.message);
  }
});

if (!pkg) {
  pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) : {};
}

const deps = pkg.dependencies || {};
const devDeps = pkg.devDependencies || {};

// --- dependencies tests ---

test('@xyflow/react is in dependencies', () => {
  assert(deps['@xyflow/react'], '@xyflow/react not found in dependencies');
});

test('@xyflow/react version is ^12.x (React Flow v12)', () => {
  const ver = deps['@xyflow/react'] || '';
  assert(ver.startsWith('^12') || ver.startsWith('12'), '@xyflow/react version is not v12: ' + ver);
});

test('zustand is in dependencies', () => {
  assert(deps['zustand'], 'zustand not found in dependencies');
});

test('node-sql-parser is in dependencies', () => {
  assert(deps['node-sql-parser'], 'node-sql-parser not found in dependencies');
});

test('uuid is in dependencies', () => {
  assert(deps['uuid'], 'uuid not found in dependencies');
});

// --- devDependencies tests ---

test('@types/uuid is in devDependencies', () => {
  assert(devDeps['@types/uuid'], '@types/uuid not found in devDependencies');
});

// --- Negative tests (no unwanted packages) ---

test('tailwindcss is NOT in dependencies or devDependencies', () => {
  assert(!deps['tailwindcss'], 'tailwindcss found in dependencies');
  assert(!devDeps['tailwindcss'], 'tailwindcss found in devDependencies');
});

// --- node_modules existence tests ---

test('@xyflow/react is installed in node_modules', () => {
  assert(
    fs.existsSync(path.join(ROOT, 'node_modules', '@xyflow', 'react')),
    '@xyflow/react not found in node_modules'
  );
});

test('zustand is installed in node_modules', () => {
  assert(
    fs.existsSync(path.join(ROOT, 'node_modules', 'zustand')),
    'zustand not found in node_modules'
  );
});

test('node-sql-parser is installed in node_modules', () => {
  assert(
    fs.existsSync(path.join(ROOT, 'node_modules', 'node-sql-parser')),
    'node-sql-parser not found in node_modules'
  );
});

test('uuid is installed in node_modules', () => {
  assert(
    fs.existsSync(path.join(ROOT, 'node_modules', 'uuid')),
    'uuid not found in node_modules'
  );
});

// --- Require tests (packages can be loaded) ---

test('@xyflow/react can be required', () => {
  try {
    require('@xyflow/react');
  } catch (e) {
    // React Flow may fail to load in Node.js (needs browser env), but the module should resolve
    if (e.code === 'MODULE_NOT_FOUND') {
      throw new Error('@xyflow/react cannot be resolved: ' + e.message);
    }
    // Other errors (like missing DOM) are acceptable for a browser-only lib
  }
});

test('zustand can be required', () => {
  const z = require('zustand');
  assert(z, 'zustand loaded but is falsy');
});

test('node-sql-parser can be required', () => {
  const Parser = require('node-sql-parser');
  assert(Parser, 'node-sql-parser loaded but is falsy');
});

test('uuid can be required', () => {
  const uuid = require('uuid');
  assert(typeof uuid.v4 === 'function', 'uuid.v4 is not a function');
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
