# Project knowledge reuse backlog

Prioritize bringing useful knowledge from an existing project into a new project. A distributable pack is not a prerequisite. See the [MVP](../specs/mvp.md) and [reuse design](../specs/2026-10-22-project-packs-design.md). Each milestone should produce a reviewable result.

## Delivered in 0.1

- Read-only text-asset inventory, exact-content duplicate groups, search, and read.
- Bundled local stdio MCP server with no install-time npm/build requirement.
- Claude Code and Codex Git marketplace catalogs and an inspection skill.
- Configuration printer for Cursor, VS Code, and compatible MCP clients.
- Package relocation/protocol tests and cross-platform CI.

These capabilities do not implement import, complete support-file inventory, native adoption bindings, updates, context routing, or doctor.

## Delivered after 0.1

- Read-only `list_import_candidates` and `plan_import` with a `plan-import` skill: selected bundles with support files and transitive Markdown references, destination mapping, collision and path-safety checks, heuristic machine-path and secret findings, adaptation sites, reviewed adaptations, reference rewrites, diff preview, and a plan ID. See the [implementation plan](../specs/2026-10-22-import-implementation-plan.md).
- Synthetic TypeScript/pnpm source and Python/uv destination fixtures.

Remaining items 1–3 below are covered by this preview except out-of-root inclusion and script dependency analysis.

## Remaining first-adoption work

1. **Reuse fixtures and contract:** model an ordinary source project and structurally different destinations with a representative skill, references, scripts, and project-specific values. Define minimal file/dependency, plan, and provenance records. Preserve the existing runtime and MCP SDK choices; do not require a pack format or predetermined manifest filenames.
2. **Complete selected bundles:** extend existing discovery for import planning with support-file inventory, alias relationships, bounded dependency inspection, explicit dependency additions, and actionable missing/unsupported-file diagnostics. Text search remains distinct from bundle completeness.
3. **Guided adaptation plan:** connect selection, destination evidence, proposed command/path/policy adaptations, unresolved questions, file diffs, and client binding previews. Separate model suggestions from deterministic conflicts; preserve authoritative destination documents.
4. **Safe application:** implement stale-input and expected-absence checks, collision/path protection, source preservation, staged writes, detectable failure state, bounded recovery, reference preservation, and safe repeat application. Do not execute scripts or activate hooks.
5. **Independent client use:** generate thin Claude Code and Codex bindings and check references. Verify a second checkout without Agent Weave or the source machine, recording versions, OS, working directory, settings, and compatibility limits.

Consult structurally different real projects privately from the fixture and planning stages onward. Commit only synthetic fixtures and generic findings. A PR-drafting procedure is an optional example; publication is not an acceptance requirement. Add focused file-operation, dependency, and adapter tests as each feature is implemented.

## Later work

- Reusable pack authoring, descriptors, licensing metadata, engine compatibility, and distribution.
- Built-in local/remote Git acquisition and pack catalogs.
- Shared settings ownership and cross-pack dependency resolution.
- Hybrid update proposals preserving project edits: decide baselines, comparison inputs, fork dependency ownership, removal, and rollback before implementation.
- Dedicated context routing and standalone doctor beyond essential import diagnostics.
- Additional adoption adapters; retain existing Cursor and VS Code MCP configuration support.

Hosted marketplaces, automatic publishing/synchronization, arbitrary executable templates, and automatic conversion or activation of hooks remain outside the first scope.

Before public package distribution, choose a license and package names, and document supported client versions and installation steps.
