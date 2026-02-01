# AGENTS.md – Instructions for AI Coding Agents

**Project:** TikTok-AI-Agent (React + Express + TypeScript monorepo).  
**📍 Read first:** [STATUS.md](STATUS.md) – Current priorities and active work.  
**Documentation:** [docs/README.md](docs/README.md) • [.cursor/docs/](.cursor/docs/) • [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)  
**See also:** [.github/copilot-instructions.md](.github/copilot-instructions.md), `.cursor/rules/`.

## Commands

```bash
npm install          # install deps (both apps)
npm run dev          # server (3001) + web (5173)
npm run build        # build both apps
npm run test         # backend unit + integration tests
npm run test:only    # same as test but skip prisma generate (use after EPERM on Windows)
npm run test:render  # render pipeline dry-run tests
npm run test:render:only  # same but skip prisma generate
npm run test:e2e     # Playwright E2E (reuses dev server when not in CI)
npm run db:generate  # Prisma generate
npm run db:migrate:dev  # migrations (dev)
npm run db:seed      # seed DB
```

When `lint` / `typecheck` exist: run them before committing. Run `npm run test` before pushing.

## Rules

- **No TODOs, placeholders, or dummy code** in finished work. Implement or remove.
- **Skills (allowlist):** When running commands as part of skills, prefer `npm run …`, `npx prisma …`, `npx playwright …`. Avoid arbitrary `curl` with tokens or secrets. Do not log or commit `.env` or API keys.
- **API:** Zod for all input; `safeParse`; 400 + details on validation failure. Validate UUID path params.
- **Errors:** Backend try/catch, JSON responses. Frontend `getErrorMessage()`, show in UI.
- **Structure:** Routes in `apps/server/src/routes/`, services in `services/`, client in `apps/web/src/api/client.ts`.

## Agent behavior (quality of work)

- **Never invent or guess** – If unsure, search the codebase or read the file instead of assuming. Do not make up APIs, paths, or types.
- **Prefer finding the answer** – Use semantic search and read relevant code before asking the user. Only ask when context is missing or ambiguous.
- **Debugging** – Change code only when the fix is clear. Otherwise suggest logging, reproduction steps, or ask for clarification instead of speculative edits.
- **After edits** – If linter/type errors appear, fix them; do not loop more than 3 times on the same file—then stop and report what remains.
- **Failed apply** – If an edit was not applied correctly by the apply model, try reapply once, then proceed or describe the remaining change.
- **Citations** – When referring to code, use only this format: `startLine:endLine:filepath` (e.g. `12:15:apps/server/src/routes/project.ts`).
- **Edits** – Prefer one logical edit per file per turn; group related changes to the same file. Read the relevant section before editing.
- **No proactive docs** – Do not create `*.md` or README unless the user explicitly requests.
- **read_lints** – Use only for files you edited or are about to edit; avoid wide-scope calls.
- **Related files** – When changing one file, consider related files (re-exports, types, callers) and make a consistent set of edits.
- **Tests** – Do not modify tests to make them pass unless the user explicitly asks; fix the implementation under test.
- **Libraries** – Before using a library, verify the project already uses it (e.g. `package.json`, existing imports).
- **Code style** – Match existing file conventions and style; use existing utilities and libraries where possible.
- **Git** – When suggesting git: no force push; only add files intended for the commit (no blind `git add .`).

## Effective prompting (for users)

To get better results from the agent: be **specific** (e.g. “add Zod validation for `topic` max 500 chars” instead of “validate the form”); give **constraints or examples** when possible; prefer **incremental** requests rather than “refactor everything”; avoid vague “make it better” without criteria.

## References

- **Current status:** [STATUS.md](STATUS.md) – Read this first for priorities
- **Patterns & architecture:** [.github/copilot-instructions.md](.github/copilot-instructions.md)
- **AI docs:** [.cursor/docs/](.cursor/docs/) – Project layout, common pitfalls, decision trees
- **Cursor rules:** `.cursor/rules/` (always-applied + file-scoped)
- **Skills:** Skille w `.cursor/skills/` (Agent Skills format). Opcjonalnie `npx skills add <owner/repo>` dla skilli z [skills.sh](https://skills.sh) (np. `npx skills add antfu/skills -s vitest -a cursor -y`).
