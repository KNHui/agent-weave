# Contributing

Agent Weave is an early preview. Start with the [specification](.agents/specs/mvp.md), [installation guide](.agents/docs/installation.md), and [backlog](.agents/docs/backlog.md).

Use short-lived branches and focused pull requests. Explain the problem, resulting behavior, and validation performed. The runtime is Node.js 22+ with ES modules, the official MCP SDK, and an esbuild-generated CommonJS distribution. Run `npm ci --ignore-scripts` and `npm run check` before submitting. Commit generated distribution files; CI verifies they match their sources on Windows, macOS, and Linux.

Use synthetic fixtures for user directories and agent assets. Never submit private skills, credentials, real session logs, or local absolute paths. Examples should use placeholders.

Implementation contributions should include focused checks for their meaningful behavior. Asset imports must be previewable, preserve their sources, and fail safely when inputs change after planning.
