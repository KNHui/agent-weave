import { createHash } from 'node:crypto';
import { opendir, realpath, stat, open } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

const MAX_BYTES = 256 * 1024;
const MAX_ENTRIES = 10000;
const MAX_ASSETS = 2000;
const excluded = new Set(['node_modules', '.git', 'local', 'cache', 'dist']);
const extensions = new Set(['.md', '.mdc', '.markdown', '.txt']);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const inside = (root, file) => {
  const rel = path.relative(root, file);
  return rel === '' || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`));
};

export function sourceRoots({ project_root, include_user = false, additional_roots = [] }, userHome = homedir()) {
  if (!path.isAbsolute(project_root)) throw new Error('project_root must be absolute');
  const projectDirs = ['.agents', '.claude/skills', '.claude/commands', '.cursor/rules', 'docs/specs', 'AGENTS.md', 'CLAUDE.md'];
  const roots = projectDirs.map((part) => ({ path: path.join(project_root, part), scope: 'project' }));
  if (include_user) {
    for (const part of ['.agents/skills', '.codex/skills', '.claude/skills', '.claude/commands', '.cursor/skills', '.cursor/rules']) {
      roots.push({ path: path.join(userHome, part), scope: 'user' });
    }
  }
  for (const root of additional_roots) {
    if (!path.isAbsolute(root)) throw new Error('additional_roots must be absolute');
    roots.push({ path: root, scope: 'additional' });
  }
  return roots;
}

// Read a bounded snapshot; never return partial oversized documents.
async function readText(file) {
  const handle = await open(file, 'r');
  try {
    if (!(await handle.stat()).isFile()) throw new Error('Not a regular file');
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, null);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size > MAX_BYTES) throw new Error('File exceeds 256 KiB');
    const bytes = buffer.subarray(0, size);
    if (bytes.includes(0)) throw new Error('Binary content is not supported');
    return bytes.toString('utf8');
  } finally {
    await handle.close();
  }
}

export async function discover(options) {
  const assets = [];
  const diagnostics = [];
  const visited = new Set();
  const roots = sourceRoots(options);
  let entries = 0;
  let truncated = false;
  async function walk(file, root, scope, depth = 0) {
    if (++entries > MAX_ENTRIES || assets.length >= MAX_ASSETS) { truncated = true; return; }
    if (depth > 32) { diagnostics.push({ path: file, reason: 'Depth limit reached' }); return; }
    try {
      const canonical = await realpath(file);
      if (!inside(root, canonical)) {
        diagnostics.push({ path: file, reason: 'Link leaves source root; add its target explicitly to include it' });
        return;
      }
      if (visited.has(canonical)) return;
      visited.add(canonical);
      const info = await stat(canonical);
      if (info.isDirectory()) {
        const directory = await opendir(canonical);
        for await (const entry of directory) {
          if (!excluded.has(entry.name)) await walk(path.join(canonical, entry.name), root, scope, depth + 1);
          if (truncated) break;
        }
      } else if (info.isFile() && extensions.has(path.extname(file).toLowerCase())) {
        const content = await readText(canonical);
        assets.push({ id: digest(canonical), path: canonical, scope, name: path.basename(file), hash: digest(content), bytes: Buffer.byteLength(content) });
      }
    } catch (error) {
      diagnostics.push({ path: file, reason: error instanceof Error ? error.message : 'Unreadable asset' });
    }
  }
  for (const source of roots) {
    try {
      const canonical = await realpath(source.path);
      await walk(canonical, canonical, source.scope);
    } catch (error) {
      if (error?.code !== 'ENOENT') diagnostics.push({ path: source.path, reason: 'Source unavailable' });
    }
    if (truncated) break;
  }
  assets.sort((a, b) => a.path.localeCompare(b.path));
  const groups = new Map();
  for (const asset of assets) {
    const group = groups.get(asset.hash) ?? [];
    group.push(asset.id);
    groups.set(asset.hash, group);
  }
  return { assets, duplicates: [...groups.values()].filter((group) => group.length > 1), diagnostics, truncated };
}

export async function readAsset(options, id) {
  const inventory = await discover(options);
  const asset = inventory.assets.find((item) => item.id === id);
  if (!asset) throw new Error('Asset not found in the selected scope');
  const canonical = await realpath(asset.path);
  if (canonical !== asset.path) throw new Error('Asset changed during read; discover again');
  const content = await readText(canonical);
  if (digest(content) !== asset.hash) throw new Error('Asset changed during read; discover again');
  return { ...asset, content };
}

export async function searchAssets(options, query, limit = 20) {
  const inventory = await discover(options);
  const matches = [];
  const needle = query.toLowerCase();
  for (const asset of inventory.assets) {
    try {
      if (await realpath(asset.path) !== asset.path) continue;
      const content = await readText(asset.path);
      if (asset.path.toLowerCase().includes(needle) || content.toLowerCase().includes(needle)) matches.push(asset);
    } catch { /* Discovery diagnostics cover unavailable assets; concurrent edits may disappear. */ }
    if (matches.length >= limit) break;
  }
  return { matches, truncated: inventory.truncated || matches.length >= limit, diagnostics: inventory.diagnostics };
}
