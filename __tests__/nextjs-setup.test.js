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

// --- package.json tests ---

test('package.json exists', () => {
  const p = path.join(ROOT, 'package.json');
  assert(fs.existsSync(p), 'package.json not found');
});

const pkgPath = path.join(ROOT, 'package.json');
const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) : null;

test('next is in dependencies', () => {
  assert(pkg, 'package.json could not be parsed');
  assert(pkg.dependencies && pkg.dependencies.next, 'next not found in dependencies');
});

test('react is in dependencies', () => {
  assert(pkg, 'package.json could not be parsed');
  assert(pkg.dependencies && pkg.dependencies.react, 'react not found in dependencies');
});

test('react-dom is in dependencies', () => {
  assert(pkg, 'package.json could not be parsed');
  assert(pkg.dependencies && pkg.dependencies['react-dom'], 'react-dom not found in dependencies');
});

test('typescript is in devDependencies', () => {
  assert(pkg, 'package.json could not be parsed');
  assert(pkg.devDependencies && pkg.devDependencies.typescript, 'typescript not found in devDependencies');
});

test('tailwindcss is NOT in dependencies or devDependencies', () => {
  assert(pkg, 'package.json could not be parsed');
  const deps = pkg.dependencies || {};
  const devDeps = pkg.devDependencies || {};
  assert(!deps.tailwindcss, 'tailwindcss found in dependencies');
  assert(!devDeps.tailwindcss, 'tailwindcss found in devDependencies');
});

test('npm scripts include dev, build, start, lint', () => {
  assert(pkg, 'package.json could not be parsed');
  const scripts = pkg.scripts || {};
  assert(scripts.dev, 'dev script missing');
  assert(scripts.build, 'build script missing');
  assert(scripts.start, 'start script missing');
  assert(scripts.lint, 'lint script missing');
});

// --- tsconfig.json tests ---

test('tsconfig.json exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'tsconfig.json')), 'tsconfig.json not found');
});

const tsconfigPath = path.join(ROOT, 'tsconfig.json');
const tsconfig = fs.existsSync(tsconfigPath) ? JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8')) : null;

test('tsconfig has @/* path alias pointing to ./src/*', () => {
  assert(tsconfig, 'tsconfig.json could not be parsed');
  const paths = tsconfig.compilerOptions && tsconfig.compilerOptions.paths;
  assert(paths, 'paths not found in compilerOptions');
  assert(paths['@/*'], '@/* path alias not found');
  assert(
    Array.isArray(paths['@/*']) && paths['@/*'].includes('./src/*'),
    '@/* does not point to ./src/*'
  );
});

test('tsconfig has strict mode enabled', () => {
  assert(tsconfig, 'tsconfig.json could not be parsed');
  assert(tsconfig.compilerOptions && tsconfig.compilerOptions.strict === true, 'strict mode not enabled');
});

// --- next.config tests ---

test('next.config.ts exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'next.config.ts')), 'next.config.ts not found');
});

// --- Directory structure tests ---

test('src/app/ directory exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'src', 'app')), 'src/app/ directory not found');
});

test('src/app/layout.tsx exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'src', 'app', 'layout.tsx')), 'src/app/layout.tsx not found');
});

test('src/app/page.tsx exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'src', 'app', 'page.tsx')), 'src/app/page.tsx not found');
});

test('src/app/globals.css exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'src', 'app', 'globals.css')), 'src/app/globals.css not found');
});

// --- No Tailwind tests ---

test('tailwind.config.* does not exist', () => {
  const files = fs.readdirSync(ROOT);
  const tailwindConfigs = files.filter(f => f.startsWith('tailwind.config'));
  assert(tailwindConfigs.length === 0, 'tailwind.config.* found: ' + tailwindConfigs.join(', '));
});

test('globals.css does not contain @tailwind directives', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src', 'app', 'globals.css'), 'utf-8');
  assert(!css.includes('@tailwind'), '@tailwind directive found in globals.css');
});

// --- CSS Modules test ---

test('page.tsx uses CSS Modules (imports .module.css)', () => {
  const pageTsx = fs.readFileSync(path.join(ROOT, 'src', 'app', 'page.tsx'), 'utf-8');
  assert(pageTsx.includes('.module.css'), 'page.tsx does not import a .module.css file');
});

test('page.module.css exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'src', 'app', 'page.module.css')), 'page.module.css not found');
});

// --- layout.tsx is Server Component ---

test('layout.tsx does not have "use client" directive', () => {
  const layout = fs.readFileSync(path.join(ROOT, 'src', 'app', 'layout.tsx'), 'utf-8');
  assert(!layout.includes('"use client"') && !layout.includes("'use client'"), 'layout.tsx has "use client" directive');
});

// --- node_modules ---

test('node_modules/ directory exists (dependencies installed)', () => {
  assert(fs.existsSync(path.join(ROOT, 'node_modules')), 'node_modules/ not found');
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
