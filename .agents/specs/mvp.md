# MVP specification

## Outcome

A developer selects useful agent knowledge from an existing project, adapts it to a new project's stack and policies, and brings over the required files. Another developer clones the destination and uses the shared procedure without Agent Weave or the source machine.

The source does not need a pack descriptor. The first adoption workflow targets Claude Code and Codex. Existing direct MCP configuration for Cursor and VS Code remains supported; new adoption adapters for them are deferred. Deployment remains a bundled local stdio MCP server using Node.js 22+ and the official JavaScript/TypeScript MCP SDK.

See [the project reuse design](2026-10-22-project-packs-design.md) for the first scope and the later pack/update direction.

## Current preview

Version 0.1 implements `discover_assets`, `search`, and `read`, with an `inspect-assets` skill. The current preview adds read-only `list_import_candidates` and `plan_import` with a `plan-import` skill; see [the implementation plan](2026-10-22-import-implementation-plan.md). Applying imports, client entry points, synchronization, context routing, and doctor are not implemented. Discovery recognizes text documents, bounds traversal and document size, skips local bindings and caches, and reports out-of-root links. It does not yet inventory every supporting file or rewrite references. A discovery result without diagnostics is not proof of a complete dependency bundle. The requirements below are proposed work, not completed functionality.

## Assets and sources

Accept explicitly selected local source and destination projects, including existing Git checkouts. Support skills, commands, rules, docs, specs, and selected support files. Built-in remote Git acquisition and pack packaging are deferred.

Do not scan the entire home directory by default. Bound discovery to configured roots, handle symlink cycles, retain alias relationships, and report unreadable locations. References outside those roots need explicit inclusion before import. Discovery does not execute scripts or instructions found in assets.

Prefer the destination's existing layout, with `.agents/` as a default shared location where appropriate. Existing authoritative documents such as domain docs, ADRs, and nested instructions may remain in place. No manifest filename, lock format, or baseline directory is required at this stage; define minimal adoption records during implementation.

## Import behavior

Expose one guided selection, adaptation, preview, and apply journey. Keep deterministic engine checks separate from model-generated recommendations.

1. Inventory relevant source knowledge and destination conventions within explicit roots. Recommend candidates with evidence and let the user select assets.
2. Collect selected dependencies, including support scripts and configuration files. Report unresolved dynamic references and external capabilities. Exact-content duplicates are supporting evidence, not proof of suitability.
3. Propose adaptations to commands, paths, templates, and policies. Ask about unresolved team decisions. Show structural conflicts separately from advisory natural-language contradictions.
4. Build a complete plan with destination paths, supporting files, reference changes, provenance, exclusions, client bindings, and unresolved conflicts.
5. Keep machine-specific values local and out of shared generated files and records. Flag likely secrets for exclusion; detection is not a guarantee. Preserve attribution and applicable license notices.
6. Apply only selected, resolved changes. Check source and destination snapshots, configuration, bindings, and expected absence of new files. Reject stale plans, unsafe paths, or unresolved collisions before writes.
7. Preserve source files and produce reviewable changes. Do not automatically commit, push, publish, or change global client configuration.

Retain relative layouts where practical and preserve required file metadata within the supported platform scope. Copy scripts as data without executing them. Hook and automatic execution activation is excluded from the first scope. Report an unsupported mandatory capability rather than presenting a partial adoption as successful.

Use staged writes and detectable failure state. Define bounded recovery and safe retry without overwriting subsequent edits; a general transaction/rollback engine is deferred. Do not report partial application as success.

Shared provenance records logical source identity, revision when available, source file hashes, destination mappings, and reviewed adaptations. Machine paths and credentials remain local. Source file hashes must account for uncommitted changes even when a Git revision is available. Private source content must not enter public fixtures or documentation.

## Ownership and updates

Adopted files are directly editable and owned by the destination project. Client wrappers are thin references. Repeating an import must not duplicate assets or silently overwrite edits.

Hybrid ownership remains the longer-term direction: configurable common procedures, explicit forks where needed, and reviewable updates preserving project changes. Pack contracts, baseline storage, three-way updates, explicit fork tracking, and removal/rollback management are deferred; none is required for first adoption.

## MCP and client adapters

Retain `discover_assets`, `search`, and `read`. Planning and application operations are proposed; their exact interfaces belong in the implementation plan. Do not expose one MCP tool per imported skill. Dedicated context routing and a standalone doctor are deferred; include essential dependency and binding diagnostics in the import flow.

Adapters create minimal native entry points and explicit invocation bindings. Preserve user-authored entry files and preview changes. Report unsupported client-specific syntax and execution semantics. MCP availability does not enforce rule loading or native skill activation.

Separate generated-file checks from native invocation and observed behavior. Record client versions, OS, working directory, and relevant settings for representative manual checks. Installed procedures must not require Agent Weave at runtime; disclose any separate external-service requirements.

## Acceptance criteria

- An ordinary local source project can supply selected knowledge without packaging it first.
- Discovery and planning leave sources and destinations unchanged.
- A skill and its required documents, scripts, templates, and bindings survive import with valid references.
- Different destination conventions produce visible adaptations; unresolved policies are surfaced rather than invented.
- Cyclic or out-of-root references are bounded and reported; missing mandatory dependencies and collisions block the affected import.
- Applying a stale plan leaves destination files unchanged.
- Interrupted operations are detectable; retry cannot overwrite subsequent edits or claim partial completion as success.
- Reapplying a completed import does not duplicate assets or overwrite edits.
- Shared records contain no source-machine absolute paths or credentials; local bindings stay out of Git.
- Existing authoritative documents and user-authored entry points are preserved.
- A second checkout uses the procedure without Agent Weave or the original source directory.
- Claude Code and Codex native invocation is verified with representative versions and observed outcomes; fixture tests alone do not establish it.

## Deferred

Pack authoring/distribution and catalogs, built-in Git acquisition, multi-pack settings and dependency solving, baselines, upstream updates and explicit fork tracking, automatic rollback, dedicated context routing/doctor, hosted registries, web administration, automatic synchronization or publishing, session mining, broad model evaluation, execution of imported workflows, hook activation, and support claims for untested clients.
