# Agent Weave contributor instructions

- Read `.agents/specs/mvp.md` before changing product behavior.
- Shared project instructions, documentation, and specs live in `.agents/`.
- Keep client-specific entry files thin and point them to the shared source.
- Do not import private documents, credentials, machine paths, or personal session logs into this public repository.
- Discovery must be read-only. Import must preserve source files and reject stale plans or conflicting destination writes.
- Keep deterministic checks separate from model-generated suggestions.
- Document client compatibility limits explicitly; MCP access does not imply native skill activation or identical behavior.
- Add focused tests for file operations, dependency resolution, and client adapters as those features are implemented.
- Keep changes scoped and do not claim unimplemented features are available.
