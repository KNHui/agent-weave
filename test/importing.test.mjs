import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { listCandidates, planImport, sanitizeRemote, unifiedDiff } from '../src/importing.mjs';
import { canSymlinkFiles, reuseFixture, snapshot } from './reuse-fixtures.mjs';

const codes = (plan, severity) => plan.findings.filter((item) => !severity || item.severity === severity).map((item) => item.code);
const skill = '.claude/skills/release-notes';
const resolved = {
  mappings: { docs: '.agents/docs' },
  adaptations: [
    { file: `${skill}/SKILL.md`, find: '`pnpm test`', replace: '`uv run pytest`', reason: 'Destination uses uv (uv.lock)' },
    { file: `${skill}/SKILL.md`, find: 'Cached output: /Users/example/cache/release.txt\n', replace: '', reason: 'Machine-local path' },
    { file: `${skill}/SKILL.md`, find: 'pnpm build', replace: 'uv build', reason: 'Destination uses uv (uv.lock)' },
  ],
};

test('candidates classify source knowledge and report both stacks without changing files', async (t) => {
  const { source, destination } = await reuseFixture(t);
  const before = [await snapshot(source), await snapshot(destination)];
  const result = await listCandidates({ source_root: source, destination_root: destination });
  const byPath = Object.fromEntries(result.candidates.map((item) => [item.path, item]));
  assert.equal(byPath[skill].kind, 'skill');
  assert.equal(byPath[skill].description, 'Draft release notes from merged changes.');
  assert.equal(byPath[skill].files, canSymlinkFiles ? 5 : 4);
  assert.equal(byPath['.claude/commands/deploy.md'].kind, 'command');
  assert.equal(byPath['.claude/skills/unrelated'].kind, 'skill');
  assert.deepEqual(result.evidence.source.tools, ['node', 'pnpm']);
  assert.deepEqual(result.evidence.destination.tools, ['python', 'uv']);
  assert.ok(result.evidence.destination.agent_locations.includes('AGENTS.md'));
  assert.ok(!JSON.stringify(result).includes(source));
  assert.deepEqual([await snapshot(source), await snapshot(destination)], before);
});

test('plan collects the selected bundle and blocks on conflicts, machine paths, and pending decisions', async (t) => {
  const { source, destination } = await reuseFixture(t);
  const before = [await snapshot(source), await snapshot(destination)];
  const plan = await planImport({ source_root: source, destination_root: destination, select: [skill] });
  const files = Object.fromEntries(plan.files.map((item) => [item.source, item]));
  assert.equal(plan.ready, false);
  assert.equal(files[`${skill}/SKILL.md`].destination, '.agents/skills/release-notes/SKILL.md');
  assert.equal(files[`${skill}/SKILL.md`].role, 'entry');
  assert.equal(files[`${skill}/scripts/collect.sh`].role, 'support');
  assert.equal(files['docs/glossary.md'].role, 'reference', 'references are followed transitively');
  assert.equal(files['docs/release-policy.md'].action, 'conflict');
  assert.ok(!files['docs/unrelated.md'] && !Object.keys(files).some((rel) => rel.includes('unrelated')));
  if (canSymlinkFiles) assert.equal(files[`${skill}/notes-alias.md`].alias_of, `${skill}/templates/notes.md`);
  if (process.platform !== 'win32') assert.equal(files[`${skill}/scripts/collect.sh`].executable, true);
  for (const code of ['destination_conflict', 'machine_path']) assert.ok(codes(plan, 'blocking').includes(code), code);
  for (const code of ['dynamic_dependency', 'external_capability', 'client_binding_pending']) assert.ok(codes(plan, 'advisory').includes(code), code);
  assert.ok(plan.findings.some((item) => item.path === 'mcp__chat__send_message'));
  const commands = plan.adaptation_sites.filter((site) => site.kind === 'command');
  assert.deepEqual(commands.map((site) => [site.line, site.tool]), [[12, 'pnpm'], [17, 'pnpm']]);
  assert.ok(!JSON.stringify(plan).includes(source) && !JSON.stringify(plan).includes(destination));
  assert.deepEqual([await snapshot(source), await snapshot(destination)], before);
});

test('reviewed adaptations and mappings produce a ready plan with rewritten references and a stable ID', async (t) => {
  const { source, destination } = await reuseFixture(t);
  const request = { source_root: source, destination_root: destination, select: [skill], ...resolved };
  const plan = await planImport(request);
  assert.deepEqual(codes(plan, 'blocking'), []);
  assert.equal(plan.ready, true);
  assert.ok(plan.adaptations.every((item) => item.status === 'applied'));
  const entry = plan.files.find((item) => item.source === `${skill}/SKILL.md`);
  assert.deepEqual(entry.rewrites, [{ from: '../../../docs/release-policy.md', to: '../../docs/release-policy.md' }]);
  const diff = plan.preview.find((item) => item.destination === entry.destination).diff;
  assert.ok(diff.includes('+Follow the [writing policy](../../docs/release-policy.md).'));
  assert.ok(diff.includes('+Verify with `uv run pytest` before drafting.'));
  assert.ok(!diff.some((line) => line.includes('/Users/')));
  assert.equal(plan.files.find((item) => item.source === 'docs/glossary.md').destination, '.agents/docs/glossary.md');
  assert.equal((await planImport(request)).plan_id, plan.plan_id);

  // A destination created after planning changes the expected-absence input and the plan ID.
  await mkdir(path.join(destination, '.agents/skills/release-notes/templates'), { recursive: true });
  await writeFile(path.join(destination, '.agents/skills/release-notes/templates/notes.md'), 'edited\n');
  const drifted = await planImport(request);
  assert.notEqual(drifted.plan_id, plan.plan_id);
  assert.equal(drifted.ready, false);
  const kept = await planImport({ ...request, resolutions: { '.agents/skills/release-notes/templates/notes.md': 'keep_destination' } });
  assert.equal(kept.files.find((item) => item.destination.endsWith('templates/notes.md')).action, 'skip');
  assert.equal(kept.ready, true);

  // Identical existing content is unchanged, supporting safe reapplication.
  await writeFile(path.join(destination, '.agents/skills/release-notes/templates/notes.md'), '## Highlights\n\n- \n');
  assert.equal((await planImport(request)).files.find((item) => item.destination.endsWith('templates/notes.md')).action, 'unchanged');
});

test('missing and out-of-root references block until excluded', async (t) => {
  const { root, source, destination } = await reuseFixture(t);
  await writeFile(path.join(root, 'outside.md'), 'outside');
  await writeFile(path.join(source, 'docs/glossary.md'), '[gone](missing.md) [outside](../../outside.md)\n');
  const request = { source_root: source, destination_root: destination, select: [skill], ...resolved };
  const blocked = await planImport(request);
  assert.deepEqual(blocked.findings.filter((item) => item.severity === 'blocking').map((item) => [item.code, item.path]), [
    ['missing_reference', 'docs/missing.md'], ['outside_root', '../outside.md'],
  ]);
  const excluded = await planImport({ ...request, exclude: ['docs/missing.md', '../outside.md'] });
  assert.equal(excluded.ready, true);
  assert.deepEqual(excluded.excluded, ['../outside.md', 'docs/missing.md']);
});

test('unsafe destinations, entry files, duplicates, secrets, and ambiguous adaptations block the plan', async (t) => {
  const { root, source, destination } = await reuseFixture(t);
  const base = { source_root: source, destination_root: destination };
  const unsafe = async (mapping) => codes(await planImport({ ...base, select: ['docs/glossary.md'], mappings: { docs: mapping } }), 'blocking');
  assert.ok((await unsafe('../escape')).includes('unsafe_destination'));
  assert.ok((await unsafe('.git/hooks')).includes('unsafe_destination'));
  assert.ok((await unsafe('.agents/local')).includes('unsafe_destination'));
  await mkdir(path.join(root, 'elsewhere'));
  await symlink(path.join(root, 'elsewhere'), path.join(destination, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.ok((await unsafe('linked')).includes('unsafe_destination'));

  await writeFile(path.join(source, 'AGENTS.md'), '# Source rules\n');
  assert.ok(codes(await planImport({ ...base, select: ['AGENTS.md'] }), 'blocking').includes('entry_file'));
  const moved = await planImport({ ...base, select: ['AGENTS.md'], mappings: { 'AGENTS.md': '.agents/docs/source-agents.md' } });
  assert.equal(moved.ready, true);
  assert.equal(moved.files[0].destination, '.agents/docs/source-agents.md');

  const duplicate = await planImport({ ...base, select: ['docs/glossary.md', 'docs/unrelated.md'], mappings: { 'docs/glossary.md': 'notes.md', 'docs/unrelated.md': 'NOTES.md' } });
  assert.ok(codes(duplicate, 'blocking').includes('duplicate_destination'));

  await writeFile(path.join(source, 'docs/unrelated.md'), 'api_key = "abcdefghijkl"\nsee pnpm and pnpm\n');
  const secret = await planImport({ ...base, select: ['docs/unrelated.md'], adaptations: [{ file: 'docs/unrelated.md', find: 'pnpm', replace: 'uv', reason: 'test' }] });
  assert.ok(codes(secret, 'blocking').includes('possible_secret'));
  assert.ok(codes(secret, 'blocking').includes('adaptation_ambiguous'));
  assert.ok(!JSON.stringify(secret.findings).includes('abcdefghijkl'));
  await assert.rejects(planImport({ ...base, select: ['../outside.md'] }), /relative to source_root/);
  await assert.rejects(planImport({ ...base, select: ['docs'] }), /skill directory/);
  await assert.rejects(planImport({ source_root: source, destination_root: source, select: ['docs/glossary.md'] }), /must differ/);
});

test('source identity uses a sanitized remote and revision', async (t) => {
  const { source, destination } = await reuseFixture(t);
  const git = (...args) => execFileSync('git', ['-C', source, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args]);
  git('init', '-q');
  git('add', '.');
  git('commit', '-qm', 'fixture');
  git('remote', 'add', 'origin', 'https://user:secret-token@git.example.com/team/web.git');
  const plan = await planImport({ source_root: source, destination_root: destination, select: ['docs/glossary.md'] });
  assert.equal(plan.source.name, 'git.example.com/team/web');
  assert.match(plan.source.revision, /^[a-f0-9]{40,64}$/);
  assert.ok(!JSON.stringify(plan).includes('secret-token'));
  assert.equal((await planImport({ source_root: source, destination_root: destination, select: ['docs/glossary.md'], source_name: 'web' })).source.name, 'web');
});

test('remote sanitization and unified diff helpers', () => {
  assert.equal(sanitizeRemote('git@github.com:team/repo.git'), 'github.com/team/repo');
  assert.equal(sanitizeRemote('ssh://git@host.example:22/team/repo.git'), 'host.example:22/team/repo');
  assert.equal(sanitizeRemote('file:///tmp/repo'), undefined);
  assert.deepEqual(unifiedDiff(undefined, 'a\nb\n', 'x.md'), ['--- /dev/null', '+++ b/x.md', '@@ -0,0 +1,2 @@', '+a', '+b']);
  assert.deepEqual(unifiedDiff('a\nb\nc\n', 'a\nB\nc\n', 'x.md'), ['--- a/x.md', '+++ b/x.md', '@@ -1,3 +1,3 @@', ' a', '-b', '+B', ' c']);
});
