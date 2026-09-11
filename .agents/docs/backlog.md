# Initial backlog

Each milestone should produce a reviewable result before the next expands its scope.

## Delivered in 0.1

- Read-only text-asset inventory, exact-content duplicate groups, search, and read.
- Bundled local stdio MCP server with no install-time npm/build requirement.
- Claude Code and Codex Git marketplace catalogs and an inspection skill.
- Configuration printer for Cursor, VS Code, and compatible MCP clients.
- Package relocation/protocol tests and cross-platform CI.

## Remaining MVP work

1. **Core schema and fixtures**: choose runtime and MCP SDK using current primary documentation; define asset IDs, source scopes, manifest, lock metadata, and synthetic fixtures.
2. **Discovery**: implement configurable roots, first two client adapters, hashes, and bounded dependency traversal.
3. **Import planning**: classify duplicates and conflicts; generate proposed changes and local binding requirements.
4. **Import application**: implement stale-plan checks, collision protection, recoverable writes, reference preservation, and idempotency.
5. **MCP access**: expose the core operations, bounded search, retrieval, and path-based context selection.
6. **Client binding**: generate reviewable Claude Code and Codex entry points and report unsupported semantics.
7. **Doctor**: validate references, source drift, and adapter compatibility.
8. **End-to-end demonstration**: import from synthetic scattered sources, clone into a second workspace, and verify a shared procedure in both clients.

Before public package distribution, choose a license and package names, and document supported client versions and installation steps.
