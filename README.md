# Agent Weave

Gather scattered agent skills, rules, commands, docs, and specs into a shared, Git-backed source of truth.

Agent Weave is a planned MCP server and companion CLI for teams using multiple AI coding tools. It discovers agent assets across user, machine, and project scopes, prepares a reviewable import into a Git project's `.agents` directory, and connects the shared source to supported clients.

**Status:** Project initialization and MVP design. No server or CLI is implemented yet. API names below are proposals.

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
