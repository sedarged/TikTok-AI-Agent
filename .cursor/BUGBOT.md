# Bugbot rules – TikTok-AI-Agent

Project-specific rules for Cursor Bugbot (PR review). See [Cursor Bugbot](https://cursor.com/docs/bugbot).

## Security & safety

- **No `eval`, `exec`, or dynamic code execution** – Flag any use of `eval()`, `Function()`, `exec`, `execSync`, or similar. We do not run arbitrary code from user input or config.
- **No hardcoded secrets** – No API keys, tokens, or passwords in code. Use `env` (see `apps/server/src/env.ts`) and `.env`; never commit `.env` or `.env.*` (except `.env.example` if used).

## API & validation

- **New or changed API routes** – Request bodies and path params must be validated with **Zod**. Use `schema.safeParse()`; return `400` with `{ error, details }` on failure. Path params for IDs (`runId`, `projectId`, `planVersionId`, `sceneId`) must use `z.string().uuid()`.
- **Refer to** `apps/server/src/routes/*`, `.cursor/rules/api-routes.mdc`, and `.cursor/skills/add-api-endpoint/SKILL.md`.

## Tests

- **Backend route or service changes** – Require corresponding **tests**: unit (Vitest) and/or integration (`apps/server/tests/`). New endpoints should be covered by `api.integration.test.ts` or equivalent.
- **E2E** – When adding new user-facing flows, add or extend Playwright E2E in `apps/web/tests/e2e/`.

## Code quality

- **No TODOs, FIXMEs, or placeholders** in deliverables. Implement or remove before merge.
- **No `eslint-disable` or `@ts-ignore`** without a justified comment and ticket.

## References

- [AGENTS.md](../AGENTS.md), [.cursor/rules/](../.cursor/rules/), [DEVELOPMENT_MASTER_PLAN.md](../DEVELOPMENT_MASTER_PLAN.md)
