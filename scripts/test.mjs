/**
 * Compile the test suite with tsc and run it with the built-in node:test runner.
 * (No vitest/jest dependency, no native modules.)
 */
import { spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.test-build');
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

await rm(out, { recursive: true, force: true });
const compiled = spawnSync(process.execPath, [tsc, '-p', path.join(root, 'tsconfig.test.json')], {
  cwd: root,
  stdio: 'inherit',
});
if (compiled.status !== 0) {
  console.error('[test] compilation failed');
  process.exit(compiled.status ?? 1);
}

const run = spawnSync(process.execPath, ['--test', path.join(out, 'tests')], { cwd: root, stdio: 'inherit' });
process.exit(run.status ?? 1);
