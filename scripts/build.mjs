/**
 * Build: ESM + CJS + type declarations + stylesheet + optional auto-inject entry.
 * No bundler is used on purpose — the output is plain tsc so it stays debuggable.
 */
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

function compile(config) {
  const result = spawnSync(process.execPath, [tsc, '-p', path.join(root, config)], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(`\n[build] ${config} failed with exit code ${result.status}`);
    process.exit(1);
  }
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

console.log('[build] esm');   compile('tsconfig.esm.json');
console.log('[build] cjs');   compile('tsconfig.cjs.json');
console.log('[build] types'); compile('tsconfig.types.json');

// Node needs to know how to treat each output folder regardless of the root "type".
await writeFile(path.join(dist, 'esm', 'package.json'), JSON.stringify({ type: 'module', sideEffects: false }, null, 2) + '\n');
await writeFile(path.join(dist, 'cjs', 'package.json'), JSON.stringify({ type: 'commonjs', sideEffects: false }, null, 2) + '\n');

// Stylesheet ships as-is so consumers can import or copy it.
await copyFile(path.join(root, 'src', 'styles.css'), path.join(dist, 'style.css'));

// Optional zero-config entry: injects the stylesheet once, no bundler needed.
const css = await readFile(path.join(root, 'src', 'styles.css'), 'utf8');
const inline = css.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const injector = `(function () {
  if (typeof document === 'undefined') return;
  var id = 'react-image-studio-style';
  if (document.getElementById(id)) return;
  var style = document.createElement('style');
  style.id = id;
  style.textContent = \`${inline}\`;
  (document.head || document.documentElement).appendChild(style);
})();
`;
await writeFile(path.join(dist, 'auto-style.mjs'), injector);
await writeFile(path.join(dist, 'auto-style.cjs'), injector);
await writeFile(path.join(dist, 'auto-style.d.ts'), 'export {};\n');

console.log('[build] done — dist/esm, dist/cjs, dist/types, dist/style.css');
