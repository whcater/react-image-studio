#!/usr/bin/env node
/**
 * Publish the working tree to GitHub through the REST API.
 *
 * This exists because the build machine has no `git` binary. It creates the
 * repository when it does not exist yet, then writes a single commit that
 * contains every tracked file.
 *
 * Usage:
 *   GH_TOKEN=ghp_xxx GH_REPO=owner/name [GH_BRANCH=main] [GH_PRIVATE=true] \
 *     node scripts/push-to-github.mjs [--dry-run]
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const token = process.env.GH_TOKEN;
const repo = process.env.GH_REPO;
const branch = process.env.GH_BRANCH || 'main';
const isPrivate = (process.env.GH_PRIVATE || 'false') === 'true';
const dryRun = process.argv.includes('--dry-run');
const message = process.env.GH_MESSAGE || 'feat: react-image-studio 1.0.0';

if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
  console.error('GH_REPO is required, e.g. GH_REPO=octocat/react-image-studio');
  process.exit(1);
}

const IGNORED = new Set(['node_modules', 'dist', '.test-build', '.git', 'coverage', '.turbo']);
const IGNORED_EXT = ['.tgz'];

const api = async (method, urlPath, body) => {
  const response = await fetch(`https://api.github.com${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'react-image-studio-release',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${urlPath} -> ${response.status}: ${data?.message ?? text}`);
  }
  return data;
};

async function walk(dir, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (IGNORED.has(entry.name)) continue;
      await walk(full, files);
    } else if (entry.isFile()) {
      if (IGNORED_EXT.some((ext) => entry.name.endsWith(ext))) continue;
      if (entry.name === '.DS_Store') continue;
      files.push(rel);
    }
  }
  return files;
}

const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf']);

const files = (await walk(root)).sort();
console.log(`[push] ${files.length} files -> ${repo}#${branch}`);

if (dryRun) {
  for (const file of files) console.log('  ·', file);
  process.exit(0);
}

if (!token) {
  console.error('GH_TOKEN is required to push (needs the "repo" scope).');
  process.exit(1);
}

const [owner, name] = repo.split('/');

// 1. Make sure the repository exists.
let repoInfo = null;
try {
  repoInfo = await api('GET', `/repos/${owner}/${name}`);
  console.log(`[push] using existing repository (default branch: ${repoInfo.default_branch})`);
} catch (error) {
  if (!/ 404:/.test(String(error))) throw error;
  const me = await api('GET', '/user');
  repoInfo = await api('POST', me.login === owner ? '/user/repos' : `/orgs/${owner}/repos`, {
    name,
    description: 'Feature-rich non-destructive image editor component for React (TypeScript).',
    private: isPrivate,
    auto_init: false,
    has_issues: true,
    has_wiki: false,
  });
  console.log(`[push] created repository ${owner}/${name}`);
}

// 2. Resolve the branch head. GitHub refuses Git Data API writes on a
//    repository with zero commits, so an empty repository gets one bootstrap
//    commit through the Contents API; our commit then replaces it as the root.
let parent = null;
let refExists = false;
try {
  const ref = await api('GET', `/repos/${owner}/${name}/git/ref/heads/${branch}`);
  parent = ref.object.sha;
  refExists = true;
} catch {
  refExists = false;
}

if (!refExists) {
  await api('PUT', `/repos/${owner}/${name}/contents/README.md`, {
    message: 'chore: bootstrap repository',
    content: Buffer.from('# react-image-studio\n\nBootstrapped before the first release commit.\n').toString('base64'),
  });
  console.log('[push] bootstrapped empty repository (blob writes require an existing commit)');
  parent = null;
  refExists = true;
}

// 3. Upload blobs.
const tree = [];
for (const file of files) {
  const absolute = path.join(root, file);
  const info = await stat(absolute);
  if (info.size > 40 * 1024 * 1024) {
    console.warn(`\n[push] skipping large file ${file} (${info.size} bytes)`);
    continue;
  }
  const ext = path.extname(file).toLowerCase();
  const buffer = await readFile(absolute);
  const blob = await api('POST', `/repos/${owner}/${name}/git/blobs`, {
    content: BINARY_EXT.has(ext) ? buffer.toString('base64') : buffer.toString('utf8'),
    encoding: BINARY_EXT.has(ext) ? 'base64' : 'utf-8',
  });
  tree.push({ path: file, mode: '100644', type: 'blob', sha: blob.sha });
  process.stdout.write('.');
}
console.log(`\n[push] uploaded ${tree.length} blobs`);

// 4. Create the tree and the commit.
const newTree = await api('POST', `/repos/${owner}/${name}/git/trees`, { tree });
const commit = await api('POST', `/repos/${owner}/${name}/git/commits`, {
  message,
  tree: newTree.sha,
  ...(parent ? { parents: [parent] } : {}),
});

// 5. Point the branch at the new commit.
if (refExists) {
  await api('PATCH', `/repos/${owner}/${name}/git/refs/heads/${branch}`, { sha: commit.sha, force: true });
} else {
  await api('POST', `/repos/${owner}/${name}/git/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha });
}

if (repoInfo?.default_branch && repoInfo.default_branch !== branch) {
  await api('PATCH', `/repos/${owner}/${name}`, { default_branch: branch }).catch(() => undefined);
}

console.log(`[push] done: ${repoInfo?.html_url ?? `https://github.com/${repo}`} · commit ${commit.sha.slice(0, 7)}`);
