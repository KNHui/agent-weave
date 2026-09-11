import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, 'plugins/agent-weave');
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const base = {
  name: 'agent-weave', version: metadata.version,
  description: 'Discover, search, and read agent assets across local projects and user directories.',
  author: { name: 'KNHui' },
  homepage: 'https://github.com/KNHui/agent-weave',
  repository: 'https://github.com/KNHui/agent-weave',
};
async function json(relative, content) {
  const dest = path.join(root, relative);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, JSON.stringify(content, null, 2) + '\n');
}
await cp(path.join(root, '.agents/skills'), path.join(target, 'skills'), { recursive: true });
await json('plugins/agent-weave/.claude-plugin/plugin.json', base);
await json('plugins/agent-weave/.codex-plugin/plugin.json', {
  ...base, skills: './skills/',
  mcpServers: { 'agent-weave': { command: 'node', args: ['server.cjs'], cwd: '.' } },
  interface: {
    displayName: 'Agent Weave', shortDescription: 'Find your scattered agent knowledge.',
    longDescription: base.description, developerName: 'KNHui', category: 'Productivity',
    capabilities: [], defaultPrompt: ['Inspect this project with Agent Weave.'],
  },
});
await json('plugins/agent-weave/.mcp.json', {
  mcpServers: { 'agent-weave': { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/server.cjs'] } },
});
await json('.claude-plugin/marketplace.json', {
  name: 'agent-weave', owner: { name: 'KNHui' },
  metadata: { description: base.description },
  plugins: [{ name: 'agent-weave', source: './plugins/agent-weave', description: base.description }],
});
// Cursor catalog currently distributes the skill. Local MCP registration is documented separately.
await json('plugins/agent-weave/.cursor-plugin/plugin.json', { ...base, skills: './skills/' });
await json('.cursor-plugin/marketplace.json', {
  name: 'agent-weave', owner: { name: 'KNHui' },
  plugins: [{ name: 'agent-weave', source: './plugins/agent-weave', description: base.description }],
});
const result = await build({
  absWorkingDir: root, entryPoints: ['src/server.mjs'], outfile: path.join(target, 'server.cjs'),
  bundle: true, platform: 'node', target: 'node22', format: 'cjs', minify: true,
  legalComments: 'eof', sourcemap: false, metafile: true,
});
// Retain third-party license texts for the bundled runtime.
const notices = [];
const bundledPackages = new Set(Object.keys(result.metafile.inputs).filter((file) => file.startsWith('node_modules/')).map((file) => {
  const parts = file.slice('node_modules/'.length).split('/');
  return parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}));
for (const dependency of [...bundledPackages].sort()) {
  const location = path.join(root, 'node_modules', dependency);
  const pkg = JSON.parse(await readFile(path.join(location, 'package.json'), 'utf8'));
  let license;
  for (const filename of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md']) {
    try { license = await readFile(path.join(location, filename), 'utf8'); break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!license) throw new Error(`Missing license text for bundled dependency ${dependency}`);
  notices.push(`${dependency} ${pkg.version}\n${license}`);
}
await writeFile(path.join(target, 'THIRD_PARTY_NOTICES.txt'), notices.join('\n\n'));
console.log('Built self-contained Agent Weave plugin. Node.js 22+ is required at runtime.');
