# Project packs and hybrid ownership

Status: proposed design for review; no product behavior implemented.

## Intent

Help a new project adopt useful agent skills, commands, and rules with its own conventions. Serve organizations beyond the original team. The user selected hybrid ownership: reusable upstream procedures with project-specific configuration, plus the ability to fork individual assets when their procedure must diverge.

Success means a developer unfamiliar with the source projects can apply one pack to a new project, inspect the generated changes, and use its procedure with that project's commands and policies. A second developer must be able to use the committed result without the first developer's machine or an Agent Weave connection.

This extends the MVP's safe import and project ownership model. Existing discovery/search/read remain supported. The implementation milestones below are proposed work, not current capabilities.

## Product boundaries

Separate three responsibilities:

- Agent Weave engine: inventory, configuration validation, dependency resolution, change planning, safe application, client bindings, diagnostics, and update comparison.
- Knowledge packs: versioned skills, commands, rules, reference documents, and supporting files. Public and private Git repositories use the same format. The engine contains no company-specific workflow.
- Project configuration: selected packs/assets, team conventions, tool choices, paths, commands, and explicit customizations.

The coding client may suggest packs and infer configuration from project evidence. The engine validates explicit inputs and computes deterministic changes. Suggestions are not installed until selected. Retrieved instructions do not authorize external writes or execution.

## Onboarding flow

1. Read the selected project and its existing agent assets within bounded roots.
2. Recommend packs from explicitly supplied local/Git sources, explaining relevance and requirements. No global catalog or home-directory crawl is required.
3. Infer candidate settings from project files, recording evidence. Ask about unresolved requirements and team policy; do not invent approval policies or choose arbitrary commands when several are plausible.
4. Select a pack or a subset of its entry assets. Include their required support dependencies; report incompatible or unresolved requirements.
5. Produce a plan with file diffs, project bindings, client entry-point changes, collisions, exclusions, and compatibility limits.
6. Apply the reviewed plan only while source and destination snapshots still match. Preserve original sources and existing user-authored instructions.
7. Diagnose the installed result and show how to invoke the representative procedure. Installation verification never executes bundled scripts or publishes a PR.

An existing project follows the same flow. Existing files are candidates for reuse or conflicts, not permission to replace them.

## Pack contract

Use a versioned, validated JSON pack descriptor for the first implementation. JSON avoids adding a YAML runtime solely for this feature; YAML files belonging to packs remain ordinary support files. The exact field-level schema belongs in the implementation plan.

The descriptor declares:

- Stable pack ID, release version, description, license, and entry assets.
- Pack-relative asset IDs, kinds, paths, required dependencies, and intended client bindings.
- Configuration fields with types, required/default values, descriptions, and whether they are shared project settings or local values.
- Optional procedure components selected explicitly by configuration, with finite allowed choices.
- External requirements such as another tool or remote knowledge source. These are distinct from files included in the pack.

Asset kinds include skill, command, rule, document, spec, agent definition, setting, and support file. Hooks and agents retain client-specific semantics; they are not converted into supposedly universal procedures.

Pack payloads preserve relative layouts. Required local dependencies must be declared; discovered Markdown links provide additional diagnostics, not a claim that all executable dependencies can be inferred. Script imports and dynamic references require author declarations. Cross-pack dependencies and dependency version solving are deferred; v1 packs are self-contained except for explicitly declared external capabilities.

A pack is a distributable source format, not necessarily a client plugin. The engine consumes it and produces project-owned files and native entry points.

## Sources and reproducibility

Accept an explicit local pack directory or Git repository plus pack subdirectory and revision. Resolve Git revisions to immutable commits before planning. Public/private access uses the developer's existing Git authentication; no credentials enter shared metadata. Never execute repository hooks, installers, or pack scripts during acquisition and planning.

Shared provenance records logical source identity, immutable revision when available, license, and hashes. Local directory paths and authentication-bearing URLs must not enter shared files. Locally sourced packs can be installed offline; checking their future updates requires the user to reconnect the source on that machine.

No private source content is copied into the public Agent Weave repository. Tests and example packs are synthetic. A distributable example pack includes an explicit license; third-party content requires compatible rights and attribution.

## Project storage and customization

Extend the MVP's proposed structure rather than introducing another ownership root:

```text
.agents/
  manifest.yaml             # selected assets, bindings, project settings
  sources.lock              # immutable provenance and file hashes
  .weave/baselines/          # committed installation baselines for updates
  skills/ commands/ rules/  # editable installed content
  docs/ specs/ scripts/     # installed references and support files
  local/                    # ignored machine-specific values and plans
```

The existing manifest filename is retained; its parser/schema are implementation work. Pack descriptors and lock/baseline metadata use JSON. Baselines are managed comparison data, not a second instruction source: exclude them from discovery and client loading. Commit them so update comparison works from a fresh checkout without the old source. Store only installed assets and rendered, shareable bindings; never local secrets.

Register authoritative project documents in place, including custom domain/ADR directories and nested entry points. Do not move them merely to fit `.agents/`.

Use project bindings for ordinary variation: commands, relative paths, tracker choice, template, and selected optional stages. Generic procedures explicitly refer to the installed binding. Rendering is limited to declared scalar placeholders in known text files and finite optional components. Do not introduce arbitrary expressions, executable templates, or shell interpolation of configuration values.

Installed files remain directly editable. Unexpected local edits are preserved and detected through baseline comparison; they do not have to be declared before editing. An explicit fork marks an asset as project-owned and excludes it from routine upstream update proposals while retaining provenance. Dependencies still used by non-forked assets remain tracked; shared dependency changes are shown with all affected assets.

## Client behavior

Initially target Claude Code and Codex. Each adapter describes content access separately from native invocation and behavior verification. Do not assume a command file, hook, or agent definition has equivalent support across clients.

Prefer the existing project layout and generate thin entry points referencing shared content. Preserve user-authored AGENTS.md/CLAUDE.md; proposed additions must be visible in the plan. Treat existing symlinks as bindings to their canonical content, not duplicates to copy. Report collisions and unsupported bindings instead of silently dropping them.

Installed procedures must not require Agent Weave at execution time. Some packs may explicitly require external services; show that requirement and any supported fallback before installation. Agent Weave itself does not execute their workflows.

## Safe application and updates

Planning records hashes of source files, destination files, configuration, and relevant bindings, including expected absence of new destinations. Changes to any required input invalidate the plan. Preflight all destinations before mutation; refuse unresolved collisions and unsafe paths. Apply with staged writes and recovery metadata so an interrupted operation is detectable and recoverable rather than reported as success.

Update comparison uses three inputs: the installed rendered baseline, current project files, and the new pack rendered with the proposed project configuration. Show upstream-only, project-only, identical concurrent, and conflicting changes. Initial updates need not automatically merge concurrent edits: propose the diff and require a resolved choice before application.

Handle additions, deletions, changed dependencies, and changed configuration requirements explicitly. Missing new required settings block the affected update. Upstream deletion cannot silently delete a locally edited file. Renames may initially be represented as delete/add with collision checks. Reapplying the same resolved state is a no-op. Forked assets are excluded unless explicitly selected for comparison.

## Diagnostics

Deterministic checks cover missing required bindings, broken local references, missing support files, path escapes, cycles, destination conflicts, broken client bindings, unsupported client features, and changes from recorded baselines. An unavailable optional external source is distinguishable from a broken required dependency.

Natural-language contradictions, relevance recommendations, and suggested generalization of existing project knowledge are advisory. Report evidence and uncertainty separately from deterministic failures.

## Delivery sequence

1. **Pack contract and synthetic example:** define schemas and validation; build a small PR drafting pack with configurable validation commands and template, plus an optional publication stage. No Jira or company service is required for drafting.
2. **Read-only onboarding plan:** inventory dependency bundles and aliases; accept sources, project settings, and selected assets; produce deterministic installation diffs and actionable unresolved questions.
3. **Safe install and client bindings:** install complete bundles, preserve existing files, validate references, and prove that a second checkout can use installed content without Agent Weave.
4. **Hybrid updates and forks:** persist baselines, detect project edits, support explicit forks, and produce safe update plans covering deletions and new requirements.
5. **Pilot and generalize:** validate against structurally different projects using local/private fixtures; publish only synthetic examples and generic improvements.

Each milestone has an independently testable result. Implement milestone 1 first; write its detailed implementation plan after review of this design. Later milestones receive their own plans rather than speculative function-level designs now.

## Acceptance scenarios

- A pack can install without company-specific services; unresolved project policy produces a focused question.
- A selected skill brings its nested docs, scripts, and binding file; unselected independent skills are omitted.
- Existing authoritative docs remain in place and client aliases resolve to one source.
- Unsafe paths, missing dependencies, and unsupported mandatory client bindings prevent a misleading successful plan.
- Stale sources/destinations invalidate an apply before any destination changes.
- A write failure is reported with recoverable state; retry cannot silently overwrite project edits.
- A fresh clone uses the installed procedure and can compare an update without the original machine path.
- A local edit survives an upstream update proposal; a fork stays excluded from routine updates.
- Shared metadata and baselines contain no local absolute paths or credentials.
- Claude Code and Codex native invocation is claimed only after a representative manual smoke test with recorded versions/outcomes. Fixture tests alone establish only generated-file correctness.

## Deferred

Hosted marketplace, web UI, telemetry, automatic upstream publishing, automatic bidirectional sync, workflow execution by the server, broad semantic context routing, arbitrary template languages, cross-pack version solving, and automatic conversion of client-specific hooks.

## Review decisions

Hybrid ownership and use outside one company are agreed. Proposed defaults needing review are the PR drafting example, local/Git sources, committed baselines, and the five-milestone sequence. None require copying internal content or enabling external writes.
