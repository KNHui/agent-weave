# Installation and compatibility

Agent Weave runs locally over MCP stdio. The coding client launches `node` and the bundled `server.cjs`; no always-on cloud deployment is required. Node.js 22+ must be available to the client process. On remote development hosts, the server and the assets must exist on that host.

## Claude Code and Codex

Both marketplace and plugin are named `agent-weave`.

Claude Code session:

```text
/plugin marketplace add KNHui/agent-weave
/plugin install agent-weave@agent-weave
```

Codex terminal:

```sh
codex plugin marketplace add KNHui/agent-weave
codex plugin add agent-weave@agent-weave
```

Use a new session after installation. Claude's native skill is `/agent-weave:inspect-assets`; in Codex select `inspect-assets` or request Agent Weave by name. MCP tool names may include client-specific namespace prefixes.

Claude's `.mcp.json` uses `CLAUDE_PLUGIN_ROOT` substitution. Codex's manifest declares its MCP configuration inline, using a plugin-relative `cwd` and a relative server argument. These adapters resolve the bundled server from the installed plugin, never from the target project. Every tool requires an explicit absolute `project_root`.

## Cursor

Clone the public repository and run `node scripts/mcp-config.mjs cursor` from the clone. Merge the printed server entry into project `.cursor/mcp.json` or user `~/.cursor/mcp.json`, preserving existing servers. The generated configuration uses absolute executable and server paths so spaces and different working directories are handled.

Open the client's MCP tools panel, enable the server if necessary, and confirm it exposes `discover_assets`, `search`, and `read`. Ask the agent to call discovery for your project's absolute path.

Cursor catalogs/manifests are prepared, but the plugin is not submitted or approved in Cursor's public marketplace. No `/add-plugin agent-weave` availability is claimed. The Cursor plugin manifest currently carries the skill; use direct configuration for the MCP server.

## VS Code and generic clients

Use `node scripts/mcp-config.mjs vscode` for VS Code's `servers` configuration shape. Merge into `.vscode/mcp.json` or run **MCP: Open User Configuration** to locate the user configuration. Trust/start the configured server through VS Code's MCP controls.

Use `node scripts/mcp-config.mjs generic` for clients accepting `mcpServers` with a `command` and `args`. Other clients may require different configuration envelopes. The underlying process is always Node plus the absolute bundled `server.cjs` path. Direct MCP registration installs tools, not native skill activation. Do not assume a web-only client can launch a local stdio process.

## Scope and data

- Project defaults: `.agents`, `.claude/skills`, `.claude/commands`, `.cursor/rules`, `docs/specs`, `AGENTS.md`, and `CLAUDE.md`.
- Optional user defaults: `.agents/skills`, `.codex/skills`, `.claude/skills`, `.claude/commands`, `.cursor/skills`, and `.cursor/rules` beneath the user's home.
- Explicit additional roots support machine-wide or custom locations. The server does not enumerate all drives or the entire home directory.
- Nested monorepo applications are separate roots; pass their paths explicitly.
- Local output includes filesystem paths and document contents. Keep it out of public issues and commits. The server makes no network requests, but retrieved text is provided to your coding client.
- Limits: 10,000 visited entries, 2,000 documents, depth 32, and 256 KiB per text file. Truncation and skipped entries are reported.

## Troubleshooting

- **Unknown marketplace/plugin:** confirm the repository URL and update your client if it lacks plugin commands.
- **`node` not found:** install Node.js 22+ and restart the coding client so it inherits PATH. Direct MCP configurations can use an absolute Node executable path.
- **No tools after installation:** start a new session and check the client's MCP connection logs.
- **Empty inventory:** pass the target application directory as `project_root`; it must not be the plugin cache directory.
- **Skipped symlink:** add the intended target as an explicit additional root if it is in scope.
- **Import requested:** the current preview can inspect assets only. Import and configuration migration remain on the backlog.

## Verification scope

Automated tests exercise bundled-server startup outside the repository, the MCP handshake and three tools, scope rejection, duplicate handling, bounded files, symlink boundaries, and manifest source paths. These tests do not establish identical model behavior across clients. Native CLI installation and GUI checks are recorded separately as they are performed.

Local verification on Windows: Claude Code 2.1.268 and Codex CLI 0.154.0 both installed the repository marketplace and plugin. Claude reported the bundled MCP server connected; Codex resolved its server working directory to the installed plugin cache. Both adapter configurations passed independent SDK handshake and tool-call tests. Cursor and VS Code configuration output is tested, but their graphical clients have not been exercised.

## Primary references

- [Claude marketplace distribution](https://code.claude.com/docs/en/plugin-marketplaces)
- [Claude plugin MCP configuration](https://code.claude.com/docs/en/plugins-reference)
- [Codex plugins](https://learn.chatgpt.com/docs/plugins)
- [Cursor MCP configuration](https://cursor.com/docs/mcp)
- [Cursor plugin reference and submission](https://cursor.com/docs/reference/plugins)
- [VS Code MCP configuration](https://code.visualstudio.com/docs/agent-customization/mcp-servers)
