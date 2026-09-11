# MVP specification

## Outcome

Developer A gathers scattered agent assets into a project and shares them through Git. Developer B clones the project and uses the shared procedure from a different supported coding client.

Initial client targets: Claude Code and Codex. Initial deployment: a local MCP server with shared core operations available to a companion CLI. Runtime and SDK selection remain open.

## Assets and sources

Support skills, commands, rules, docs, specs, and their referenced support files. Discover supported client locations and explicitly configured additional paths. Record actual source location and scope rather than assuming that all clients define global scope identically.

Do not scan the entire home directory by default. Bound discovery to configured roots, handle symlink cycles, and report unreadable locations. References outside those roots need explicit inclusion before import. Discovery does not execute scripts or instructions found in assets.

Existing authoritative paths such as `docs/specs` may remain in place and be registered as project sources.

## Proposed project structure

```text
.agents/
  manifest.yaml   # asset IDs, project-relative paths, scope, bindings
  sources.lock    # shareable provenance and content hashes
  skills/
  commands/
  rules/
  docs/
  specs/
  local/          # ignored machine-specific locations and values
```

The manifest schema will be defined during implementation. This repository does not yet depend on a parser or generate these metadata files.

## Import behavior

1. Inventory source assets, types, hashes, and references.
2. Match identical content independently of filenames. Same-name, different-content assets remain conflict candidates.
3. Build a plan with destination paths, supporting files, reference rewrites, unresolved conflicts, and proposed changes.
4. Separate machine-specific values into local bindings with shareable examples. Flag likely secrets for exclusion; detection is not a guarantee that all sensitive content was found.
5. Apply only selected, resolved entries. Check source and destination hashes again before writing. Reject changed inputs or destination collisions.
6. Preserve source files and produce a reviewable Git diff. Do not automatically commit, push, or change global client configuration.

Retain relative directory layouts where possible. Copy referenced scripts and assets as data; do not execute imported scripts during planning or import. Report references that cannot be resolved safely.

Local absolute paths belong in ignored local metadata. Shared provenance uses a repository URL and revision when available, or a logical source ID and hash for local assets.

## Ownership and updates

After adoption, the project's `.agents` content is the editable source. Client wrappers are generated references, not independently maintained copies. Upstream changes become reviewable update proposals. Bidirectional automatic synchronization is outside the MVP.

## MCP and client adapters

Proposed operations: `discover_assets`, `plan_import`, `apply_import`, `search`, `read`, `resolve_context`, and `doctor`.

Provide bounded search and retrieval tools. Resources and prompts may supplement these where clients support them. Do not expose one MCP tool per imported skill.

Adapters create minimal native entry points and explicit invocation bindings. Preserve existing user-authored entry files; preview additions and detect collisions. Report unsupported client-specific variables, hooks, and execution semantics rather than claiming equivalent behavior.

MCP availability does not enforce rule loading. Essential project instructions need native entry points. Behavioral guarantees require separate validation.

## Context and diagnostics

Start context selection with explicit scope, paths, tags, and reference relationships. Return source versions and selection reasons. Semantic ranking is optional future work.

Doctor checks broken references, unreachable assets, name collisions, source drift, and known unsupported syntax. Natural-language contradictions are advisory findings, separate from deterministic errors.

## Acceptance criteria

- Synthetic user, machine, and project sources can be inventoried without modification.
- Identical content is identified; different same-name content is never silently merged.
- A skill and its nested references survive import with valid relative links.
- Cyclic or out-of-root references are bounded and reported.
- Applying a stale plan leaves destination files unchanged.
- Reapplying a completed import does not create duplicate assets or overwrite edits.
- Shared metadata contains no source-machine absolute paths; local bindings are ignored by Git.
- Existing external spec directories can be registered without copying them.
- A second checkout resolves shared assets without the first developer's home directory.
- Claude Code and Codex can retrieve and explicitly invoke one representative shared procedure, with versions and observed outcomes recorded.
- Doctor identifies an intentionally broken reference and an upstream content change.

## Deferred

Hosted registries, web administration, automatic bidirectional synchronization, session mining, broad model evaluation, execution of imported workflows by the MCP server, and support claims for untested clients.
