# Project knowledge reuse and future packs

Status: proposed scope for review; no product behavior implemented.

## Intent

Help a new project reuse useful agent skills, commands, rules, and supporting knowledge from an existing project, adapting them to its own stack and team policies. Serve organizations beyond the original team.

Success means a developer can select knowledge from another project, review project-specific adaptations, bring over the necessary files, and use the result. A second developer must be able to use the committed result without the original machine or an Agent Weave connection.

A source project does not need to become a distributable pack first. This design prioritizes the first reuse journey; reusable packs and hybrid update management remain a later direction. Existing discovery/search/read remain supported. All import behavior below is proposed, not currently available.

## First scope

The user-facing journey is one guided import flow:

1. Specify an existing local source project and the destination project, with bounded additional roots when needed.
2. Inspect source knowledge and destination conventions. Recommend relevant assets with evidence; let the user select what to adopt.
3. Identify the selected assets' references, scripts, templates, configuration files, and external requirements. Show unresolved dependencies and exclusions.
4. Propose adaptations to paths, commands, templates, and policies using destination evidence. Ask only about unresolved product or team decisions. Preserve existing authoritative destination documents in place.
5. Preview the complete file changes, dependency bundle, client entry points, provenance, and conflicts. Apply only a selected, resolved plan whose inputs still match.
6. Validate the resulting references and client bindings, explain how to invoke the procedure, and verify the committed result in a second checkout without Agent Weave.

Start with explicitly supplied local projects, including repositories the user has already checked out. Built-in Git acquisition, pack catalogs, and separate pack-authoring workflows are not prerequisites. Existing MCP tools and plugin entry points remain the access mechanism; a separate CLI is not required for this scope. Exact new tool and skill interfaces belong in the implementation plan.

## Responsibilities

- Agent Weave engine: bounded inventory, file and reference validation, deterministic change planning, safe application, provenance, and client binding diagnostics.
- Coding client: evidence-backed relevance recommendations and proposed project-specific adaptations. These are advisory until reviewed; retrieved instructions are not authorization to execute code or publish changes.
- Destination project: owns the adopted files and team policies. Files remain directly editable after import.

Ordinary value differences can be represented as project bindings. Changes to procedure order or approval responsibilities must be shown explicitly rather than disguised as path substitution. The first import may adapt a procedure directly; it does not require a reusable template language, a pack settings registry, or an explicit fork state.

Structural conflicts such as duplicate destinations and missing files are deterministic findings. Natural-language policy contradictions are advisory findings with evidence and uncertainty. A claim that a policy is enforced requires more than successfully loading its text.

## Complete dependency bundles

Document search and import file inventory have different purposes. The current preview inventories text documents only; its successful discovery does not establish that all support files were found.

The import plan must account for selected scripts, configuration, templates, and other support files, retaining relative layouts where practical. Record symlink aliases as relationships to canonical files. Bound cycles and require explicit inclusion for references outside selected roots. Report unsupported file types or unresolved dependencies rather than silently treating a partial bundle as complete.

Markdown links can identify references but cannot prove that dynamic script imports or tool dependencies are complete. Allow explicit additions and require unresolved mandatory dependencies to be resolved before applying the affected bundle. Do not infer that an external MCP wrapper is self-contained: show the required capability and any known fallback. Credentials and machine-specific tool mappings remain local.

## Destination layout and provenance

Prefer the destination project's existing layout. `.agents/` is the default shared location where appropriate, not a requirement to move authoritative domain documents, ADRs, or nested instructions. Client entry points should remain thin and refer to the adopted content.

Record only the metadata needed to explain an adoption: logical source identity, repository revision when available, source content hashes, destination paths, and reviewed adaptations. A repository revision alone does not describe uncommitted source changes, so record file hashes as well. Metadata filenames and serialization are implementation decisions; neither `manifest.yaml` nor `sources.lock` is required merely because it appeared in an earlier proposal.

Keep source-machine absolute paths, credentials, authentication-bearing URLs, and local bindings out of shared records and generated content. Retain applicable attribution and license notices. Secret detection is a supplementary check, not proof that content is safe to share. Plans and diagnostics must follow the same data boundaries as installed files.

Internal projects may inform local structural validation. Never copy their private text, identifiers, machine paths, or personal session logs into the public repository or examples. Public fixtures are synthetic.

## Safe application

Discovery and planning are read-only. Preserve original source files. The plan includes source and destination snapshots, reviewed adaptation inputs, relevant bindings, and expected absence of new destinations. Reject stale plans, unresolved collisions, and unsafe paths before mutation; recheck relevant state before writing.

Copy scripts as data and preserve required file metadata where supported. Do not run imported scripts, installers, or procedures during import. Installing files and enabling automatic execution are distinct effects. The first scope does not activate hooks or automatic execution settings; report unsupported mandatory activation instead of claiming successful adoption.

Use staged writes and explicit failure reporting. Interrupted operations must be detectable, and retries must not overwrite subsequent user edits or mark partial application as complete. Define a bounded recovery procedure during implementation; a general transaction engine and automatic rollback service are not required. Do not promise multi-file atomicity across arbitrary filesystems.

Produce reviewable changes without automatically committing, pushing, publishing, or modifying global client configuration. Reapplying an already completed plan must not duplicate assets or overwrite edits; importing again is not an implicit upstream update.

## Client behavior

Target Claude Code and Codex for the first adoption workflow. Preserve existing user-authored entry files and preview additions. Diagnose unsupported command, agent, hook, and settings semantics; do not convert them into supposedly equivalent cross-client procedures.

Separate generated-file correctness, native discovery/invocation, and observed procedure behavior. Record client version, OS, working directory, and relevant settings for representative manual verification. Test nested instructions and symlink behavior within the declared support scope. Existing Windows plugin checks do not establish that future imported bindings work on Windows.

Installed procedures must not depend on Agent Weave at runtime. Explicit external-service requirements are allowed when disclosed and satisfied; an MCP connection alone does not establish capability compatibility. Retain existing Cursor and VS Code MCP configuration support, but expanding their adoption adapters is not a first-scope requirement.

## Delivery sequence

1. **Reuse evidence and fixtures:** select a representative skill with references, scripts, and project-specific values. Model structurally different source and destination projects using synthetic data; consult real projects privately from this stage onward.
2. **Read-only adaptation plan:** extend inventory to complete selected bundles; show proposed project adaptations, dependency gaps, provenance, collisions, and native entry-point changes through one guided flow.
3. **Safe import:** apply resolved plans with stale-input checks, source preservation, path protection, and detectable failure state. Validate installed references and direct editability.
4. **Independent use:** verify the committed result from a second checkout in Claude Code and Codex without Agent Weave or source-machine paths, recording support limits.

A PR-drafting skill is an optional example, not a required first pack or a reason to add publication stages. The acceptance target is successful cross-project reuse. Write a focused implementation plan before product code changes.

## Acceptance scenarios

- An ordinary source project can supply selected knowledge without a pack descriptor.
- A selected skill brings its required local references, scripts, templates, and bindings; unrelated assets stay unselected.
- Different destination stacks produce reviewable command and path adaptations; unresolved team policy produces a focused question.
- Existing authoritative documents and entry files are preserved; conflicts are surfaced rather than silently resolved.
- Missing required dependencies, unsafe paths, and unsupported mandatory client behavior prevent a misleading successful plan.
- Stale input rejection leaves destination files unchanged. Interrupted writes are reported, and retry preserves subsequent edits.
- Imported files are directly editable; repeating an import does not silently reset those edits.
- A second checkout can use the procedure without Agent Weave, the original source directory, or machine-specific shared metadata.
- Native invocation claims include representative client versions and observed outcomes. Fixture tests establish generated-file correctness only.

## Later direction: packs and hybrid ownership

The agreed long-term direction separates a generic engine, reusable knowledge packs, and project configuration. Common procedures can be configured; assets with divergent procedures can become explicit project-owned forks. Installed files remain editable, and upstream updates must preserve local changes through reviewable proposals.

These capabilities are not prerequisites for first adoption. Before implementing them, decide the pack contract and engine compatibility, settings ownership across packs, baseline storage, comparison inputs, fork dependency ownership, deletion/removal behavior, and rollback rules. Three-way comparison and committed baselines remain candidate mechanisms, not current requirements or implemented features.

Defer pack authoring/distribution, built-in Git source acquisition, catalogs, multi-pack dependency solving, baseline persistence, upstream update proposals, and explicit fork management. Also defer hosted marketplaces, web UI, telemetry, automatic publishing or synchronization, broad semantic context routing, arbitrary executable templates, and automatic conversion or activation of client-specific hooks.
