import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { discover, readAsset, searchAssets, sourceRoots } from '../src/assets.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'agent-weave-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = path.join(root, 'project with spaces');
  await mkdir(path.join(project, '.agents/skills/example'), { recursive: true });
  await mkdir(path.join(project, '.agents/local'), { recursive: true });
  await writeFile(path.join(project, '.agents/skills/example/SKILL.md'), '# Fixture\nUnique procedure');
  await writeFile(path.join(project, '.agents/local/private.md'), 'Excluded');
  return { root, project, options: { project_root: project } };
}

test('inventory is read-only, excludes local bindings, and distinguishes duplicates from same-name conflicts', async (t) => {
  const { project, options } = await fixture(t);
  await mkdir(path.join(project, '.claude/skills/example'), { recursive: true });
  await writeFile(path.join(project, '.claude/skills/example/SKILL.md'), '# Different');
  await writeFile(path.join(project, '.agents/copy.md'), '# Fixture\nUnique procedure');
  const inventory = await discover(options);
  assert.equal(inventory.assets.length, 3);
  assert.equal(inventory.duplicates.length, 1);
  assert.equal(inventory.duplicates[0].length, 2);
  const result = await searchAssets(options, 'unique procedure');
  assert.equal(result.matches.length, 2);
  assert.equal((await readAsset(options, result.matches[0].id)).content, '# Fixture\nUnique procedure');
  await assert.rejects(readAsset(options, '0'.repeat(64)), /not found/);
  assert.equal(await readFile(path.join(project, '.agents/local/private.md'), 'utf8'), 'Excluded');
});

test('out-of-root links are reported, explicit source-root links work, cycles terminate', async (t) => {
  const { root, project, options } = await fixture(t);
  const outside = path.join(root, 'outside');
  await mkdir(outside);
  await writeFile(path.join(outside, 'external.md'), 'External');
  const kind = process.platform === 'win32' ? 'junction' : 'dir';
  await symlink(outside, path.join(project, '.agents/escape'), kind);
  await symlink(path.join(project, '.agents'), path.join(project, '.agents/cycle'), kind);
  const inventory = await discover(options);
  assert.equal(inventory.assets.length, 1);
  assert.ok(inventory.diagnostics.some((item) => item.reason.includes('leaves source root')));
  assert.equal((await discover({ ...options, additional_roots: [outside] })).assets.length, 2);
});

test('scope defaults do not include home; relative roots and oversized files are rejected', async (t) => {
  const { project, options } = await fixture(t);
  assert.ok(sourceRoots(options).every((root) => root.scope === 'project'));
  assert.ok(sourceRoots({ ...options, include_user: true }).some((root) => root.scope === 'user'));
  assert.throws(() => sourceRoots({ project_root: 'relative' }), /absolute/);
  await writeFile(path.join(project, '.agents/large.md'), 'x'.repeat(256 * 1024 + 1));
  const result = await discover(options);
  assert.equal(result.assets.length, 1);
  assert.ok(result.diagnostics.some((item) => item.reason.includes('256 KiB')));
});
