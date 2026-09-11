import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { configuration } from '../scripts/mcp-config.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const json = async (file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));

test('all catalogs resolve to packaged skills with a single editable source', async () => {
  for (const file of ['.agents/plugins/marketplace.json', '.claude-plugin/marketplace.json', '.cursor-plugin/marketplace.json']) {
    const catalog = await json(file);
    assert.equal(catalog.name, 'agent-weave');
    const entry = catalog.plugins[0];
    const source = typeof entry.source === 'string' ? entry.source : entry.source.path;
    assert.equal(entry.name, 'agent-weave');
    assert.equal(await readFile(path.join(root, source, 'skills/inspect-assets/SKILL.md'), 'utf8'), await readFile(path.join(root, '.agents/skills/inspect-assets/SKILL.md'), 'utf8'));
  }
  assert.equal(configuration('cursor').mcpServers['agent-weave'].command, process.execPath);
  assert.equal(configuration('vscode').servers['agent-weave'].type, 'stdio');
  assert.throws(() => configuration('unsupported'), /Usage/);
});

for (const clientName of ['claude', 'codex']) test(`${clientName} copied plugin starts without node_modules and supports real MCP discovery, search, read, and errors`, { timeout: 20000 }, async (t) => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'agent-weave-package-'));
  const installed = path.join(temporary, 'installed plugin');
  await cp(path.join(root, 'plugins/agent-weave'), installed, { recursive: true });
  const project = path.join(temporary, 'project');
  await mkdir(path.join(project, '.agents'), { recursive: true });
  await writeFile(path.join(project, '.agents/example.md'), '# MCP fixture');
  const filename = clientName === 'claude' ? '.mcp.json' : '.codex-plugin/plugin.json';
  const config = JSON.parse(await readFile(path.join(installed, filename), 'utf8')).mcpServers['agent-weave'];
  const transport = new StdioClientTransport({ command: process.execPath, args: config.args.map((arg) => arg.replace('${CLAUDE_PLUGIN_ROOT}', installed)), cwd: config.cwd ? path.resolve(installed, config.cwd) : project, stderr: 'pipe' });
  const client = new Client({ name: 'agent-weave-test', version: '1.0.0' });
  t.after(async () => {
    await client.close();
    await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  await client.connect(transport);
  assert.deepEqual((await client.listTools()).tools.map((tool) => tool.name).sort(), ['discover_assets', 'read', 'search']);
  const result = await client.callTool({ name: 'discover_assets', arguments: { project_root: project } });
  const inventory = JSON.parse(result.content[0].text);
  assert.equal(inventory.assets.length, 1);
  const read = await client.callTool({ name: 'read', arguments: { project_root: project, id: inventory.assets[0].id } });
  assert.equal(JSON.parse(read.content[0].text).content, '# MCP fixture');
  const search = await client.callTool({ name: 'search', arguments: { project_root: project, query: 'fixture' } });
  assert.equal(JSON.parse(search.content[0].text).matches.length, 1);
  const error = await client.callTool({ name: 'read', arguments: { project_root: project, id: '0'.repeat(64) } });
  assert.equal(error.isError, true);
});
