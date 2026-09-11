import { fileURLToPath } from 'node:url';

export function configuration(client) {
  const server = { command: process.execPath, args: [fileURLToPath(new URL('../plugins/agent-weave/server.cjs', import.meta.url))] };
  if (client === 'vscode') return { servers: { 'agent-weave': { type: 'stdio', ...server } } };
  if (['cursor', 'generic'].includes(client)) return { mcpServers: { 'agent-weave': server } };
  throw new Error('Usage: node scripts/mcp-config.mjs cursor|vscode|generic');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { console.log(JSON.stringify(configuration(process.argv[2]), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
