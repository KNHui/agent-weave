# Agent Weave

Gather scattered agent skills, rules, commands, docs, and specs into a shared, Git-backed source of truth.

Agent Weave is a local MCP server and plugin for teams using multiple AI coding tools. Version 0.1 discovers, searches, and reads agent documents across project and optional user scopes. It identifies exact-content duplicates and reports skipped paths. Consolidating assets into a Git project's `.agents` directory is the next milestone.

**Status:** Early preview. Read-only discovery, search, and read are implemented. Import planning/application, synchronization, context routing, and doctor are not implemented yet.

## Install

Requires **Node.js 22+** on your PATH and Git. The repository contains a bundled server, so plugin users do not need to install npm dependencies or build. No cloud server, service account, or API key is required for Agent Weave. Your coding client runs the local server for its session.

### Claude Code

Run inside a Claude Code session:

```text
/plugin marketplace add KNHui/agent-weave
/plugin install agent-weave@agent-weave
```

Start a new session in your target project, then run `/agent-weave:inspect-assets` or ask Agent Weave to inspect your project. The plugin includes the skill and local MCP server.

### Codex

Run in your terminal:

```sh
codex plugin marketplace add KNHui/agent-weave
codex plugin add agent-weave@agent-weave
```

Start a new Codex session in your target project and ask: "Use Agent Weave to inventory this project's agent assets." You can also select `inspect-assets` from the skills picker. The plugin includes the skill and local MCP server.

### Cursor, VS Code, and other MCP clients

Clone once, then print the configuration for your client:

```sh
git clone https://github.com/KNHui/agent-weave.git
cd agent-weave
node scripts/mcp-config.mjs cursor
```

Merge the printed `agent-weave` server entry into Cursor's project `.cursor/mcp.json` or user `~/.cursor/mcp.json`. Keep existing server entries. For VS Code use `node scripts/mcp-config.mjs vscode` and merge into `.vscode/mcp.json` or the configuration opened by **MCP: Open User Configuration**. For compatible clients using `mcpServers`, use `node scripts/mcp-config.mjs generic`.

These commands print local Node/server paths and do not modify your settings. Do not commit machine-specific output as a portable team configuration. Restart or refresh the client's MCP connection, then check for `discover_assets`, `search`, and `read`.

The direct MCP route provides tools; it does not automatically install a native skill. Cursor plugin manifests are included for future marketplace submission, but Agent Weave is **not listed in the Cursor marketplace**. Use the direct MCP route now.

See [installation details, troubleshooting, and compatibility](.agents/docs/installation.md).

## Try it

In your target project, ask:

> Use Agent Weave to inventory this project's skills, rules, commands, docs, and specs. Show duplicate content and skipped paths. Do not change files.

To include your personal skills, explicitly ask to include user-level sources. For a monorepo, identify each application root or add its agent directories as additional roots. The server never assumes its installation directory is your target project.

Returned documents enter your coding client's context and follow that client's data handling. Agent Weave itself has no network requests, telemetry, or file-writing tools.

## Development

```sh
npm ci --ignore-scripts
npm run check
```

Edit `.agents/skills` for skill content, `src` for server behavior, and `scripts/build.mjs` for plugin adapters. `npm run build` generates the self-contained `plugins/agent-weave` distribution and Claude/Cursor catalogs. Commit generated files so Git-based installs work without a build step. Codex's catalog lives in `.agents/plugins/marketplace.json`.

## The workflow

1. Discover assets in supported tool locations and explicitly configured paths.
2. Review duplicates, conflicts, dependencies, and machine-specific values.
3. Import selected assets and their supporting files into `.agents`.
4. Review and share the resulting changes through Git.
5. Generate thin client adapters for Claude Code and Codex.
6. Diagnose broken references, unsupported features, and source drift.

Existing authoritative directories such as `docs/specs` can be registered without moving their contents. Original files remain intact during import; switching a project's client bindings to the shared source is a separate operation.

## Design principles

- Keep Markdown and Git as the editable source of truth.
- Preserve provenance and content hashes without publishing local absolute paths or secrets.
- Treat matching names as potential conflicts, not proof of identical content.
- Keep machine-specific bindings in ignored local configuration.
- Separate content access, client invocation compatibility, and behavioral verification.
- Use MCP for discovery and retrieval; use client adapters for native entry points.
- Make changes reviewable and avoid silently overwriting existing user files.
- Start with local operation and two clients; add broader support through adapters.

## Proposed interfaces

| Operation | Purpose |
| --- | --- |
| `discover_assets` | Inventory assets from configured sources |
| `plan_import` | Produce an import plan and proposed diff |
| `apply_import` | Apply a selected, unchanged plan |
| `search` / `read` | Find and retrieve shared assets |
| `resolve_context` | Select assets by task and project path |
| `doctor` | Diagnose reference, compatibility, and drift issues |

See the [MVP specification](.agents/specs/mvp.md), [initial backlog](.agents/docs/backlog.md), and [contribution guide](CONTRIBUTING.md).

## Background

The project was inspired by the discussion [How do you manage skills files?](https://news.hada.io/topic?id=33338) and the need to share team-specific agent knowledge across tools.
