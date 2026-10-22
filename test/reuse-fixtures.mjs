import { chmod, lstat, mkdir, mkdtemp, readdir, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const canSymlinkFiles = process.platform !== 'win32';

async function write(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(root, ...rel.split('/'));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
}

// Synthetic source (TypeScript/pnpm) and destination (Python/uv) projects.
export async function reuseFixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'agent-weave-reuse-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source project');
  const destination = path.join(root, 'destination');
  await write(source, {
    'package.json': JSON.stringify({ name: 'example-web', scripts: { build: 'tsc', test: 'vitest' } }),
    'pnpm-lock.yaml': 'lockfileVersion: 9\n',
    '.claude/skills/release-notes/SKILL.md': [
      '---', 'name: release-notes', 'description: Draft release notes from merged changes.', 'allowed-tools: Bash(git log:*)', '---',
      '# Release notes', '',
      'Follow the [writing policy](../../../docs/release-policy.md).',
      'Use the [template](templates/notes.md) and run `scripts/collect.sh`.',
      'Categories live in [config](config/categories.json).', '',
      'Verify with `pnpm test` before drafting.',
      'Post the draft with `mcp__chat__send_message` when asked.',
      'Cached output: /Users/example/cache/release.txt', '',
      '```sh', 'pnpm build', '```', '',
    ].join('\n'),
    '.claude/skills/release-notes/templates/notes.md': '## Highlights\n\n- \n',
    '.claude/skills/release-notes/scripts/collect.sh': '#!/bin/sh\ngit log --oneline "$1..HEAD"\n',
    '.claude/skills/release-notes/config/categories.json': '{"feat":"Features","fix":"Fixes"}\n',
    'docs/release-policy.md': '# Release policy\n\nUse terms from the [glossary](glossary.md#terms).\n',
    'docs/glossary.md': '# Glossary\n\n## Terms\n',
    'docs/unrelated.md': '# Not referenced\n',
    '.claude/skills/unrelated/SKILL.md': '---\nname: unrelated\ndescription: Not selected.\n---\n# Unrelated\n',
    '.claude/commands/deploy.md': '# Deploy\n\nRun `pnpm deploy`.\n',
  });
  await chmod(path.join(source, '.claude/skills/release-notes/scripts/collect.sh'), 0o755);
  if (canSymlinkFiles) await symlink('templates/notes.md', path.join(source, '.claude/skills/release-notes/notes-alias.md'));
  await write(destination, {
    'pyproject.toml': '[project]\nname = "example-api"\n',
    'uv.lock': 'version = 1\n',
    'AGENTS.md': '# Team rules\n\nAuthored by the destination team.\n',
    '.agents/docs/existing.md': '# Existing authoritative document\n',
    'docs/release-policy.md': '# Release policy\n\nDestination-owned policy.\n',
  });
  return { root, source, destination };
}

// Paths, types, modes, link targets, and hashes; used to prove read-only behavior.
export async function snapshot(root) {
  const result = {};
  async function walk(dir) {
    for (const name of (await readdir(dir)).sort()) {
      const file = path.join(dir, name);
      const info = await lstat(file);
      const rel = path.relative(root, file).split(path.sep).join('/');
      if (info.isSymbolicLink()) result[rel] = `link:${await readlink(file)}`;
      else if (info.isDirectory()) { result[rel] = 'dir'; await walk(file); }
      else result[rel] = `${info.mode.toString(8)}:${createHash('sha256').update(await readFile(file)).digest('hex')}`;
    }
  }
  await walk(root);
  return result;
}
