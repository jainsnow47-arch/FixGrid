import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { transform } from 'esbuild';

const rootDir = process.cwd();
const scanDirs = ['server', 'src', 'scripts'];
const allFiles = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full);
    } else {
      allFiles.push(full);
    }
  }
}

walk(rootDir);

// Collect files only in root and scanDirs
const targets = [path.join(rootDir, 'server.js')].filter((p) => fs.existsSync(p));
for (const d of scanDirs) {
  const list = [];
  function walkSub(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkSub(full);
      else list.push(full);
    }
  }
  walkSub(path.join(rootDir, d));
  targets.push(...list);
}

let errors = 0;

for (const file of targets) {
  if (file.endsWith('.ts') || file.endsWith('.tsx')) {
    console.error(`Disallowed TypeScript file found: ${path.relative(rootDir, file)}`);
    errors += 1;
    continue;
  }

  if (file.endsWith('.js')) {
    const rel = path.relative(rootDir, file);
    if (rel === 'server.js' || rel.startsWith(`server${path.sep}`) || rel.startsWith(`scripts${path.sep}`)) {
      try {
        execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
      } catch (err) {
        console.error(`Syntax error in ${rel}:`, err.stderr?.toString() || err.message);
        errors += 1;
      }
    } else if (rel.startsWith(`src${path.sep}`)) {
      const code = fs.readFileSync(file, 'utf8');
      try {
        await transform(code, { loader: 'js', sourcefile: rel });
      } catch (err) {
        console.error(`JS parse error in ${rel}:`, err.message);
        errors += 1;
      }
    }
  } else if (file.endsWith('.jsx')) {
    const rel = path.relative(rootDir, file);
    const code = fs.readFileSync(file, 'utf8');
    try {
      await transform(code, { loader: 'jsx', sourcefile: rel });
    } catch (err) {
      console.error(`JSX parse error in ${rel}:`, err.message);
      errors += 1;
    }
  }
}

if (errors > 0) {
  console.error(`JavaScript check failed with ${errors} error(s).`);
  process.exit(1);
}

console.log(`Verified ${targets.filter((f) => f.endsWith('.js') || f.endsWith('.jsx')).length} pure JavaScript/JSX files with 0 errors.`);
