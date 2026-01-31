# Development Master Plan & Checklist

**To jest główny checklist projektu.** Mapa wszystkich dokumentów: [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md).

**Purpose:** Single source of truth for improving AI-assisted development, reducing bugs, placeholders, and “AI lies,” and streamlining the dev pipeline.  
**Last updated:** 2026-01-29 (C3, F3: Vitest + Testing Library in web; Analytics, channel presets, script templates.)  
**How to update:** Edit this file when completing tasks; set status to ✅, add notes, bump “Last updated.”

---

## 1. Audit summary (2026-01-29)

| Area                    | Status | Notes                                                                                                                                                               |
| ----------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cursor / AI context** | ✅     | `.cursor/rules/`, `AGENTS.md`, `.cursor/commands/`, `.cursor/skills/`, `.cursorindexingignore` in place. `.cursorignore` optional (add manually if needed; see A1). |
| **Lint / format**       | ✅     | ESLint + Prettier; `lint`, `lint:fix`, `format`, `format:check`; CI runs lint                                                                                       |
| **Typecheck**           | ✅     | `typecheck` in server + web; root `typecheck`; CI runs typecheck                                                                                                    |
| **Tests**               | ✅     | Vitest (backend), Playwright (E2E); `test:coverage` in server; planValidator + ffmpegUtils unit tests.                                                              |
| **CI**                  | ✅     | Job `lint-typecheck-build` runs lint, typecheck, build, `npm run audit`; backend, render-dry-run, Windows, E2E unchanged.                                           |
| **Git hooks**           | ✅     | Husky + lint-staged; pre-commit runs `lint-staged` on staged files                                                                                                  |
| **AI-facing docs**      | ✅     | `AGENTS.md`, `.cursor/rules`, `.github/copilot-instructions`; TESTING_GUIDE updated                                                                                 |
| **Code quality**        | ✅     | Reduced `any` everywhere: planGenerator, openai, plan routes, renderPipeline (ResumeState), verifyArtifacts (details).                                              |

---

## 2. Master checklist

### A. Cursor & AI context (reduce hallucination, placeholders, dummy code)

| ID  | Task                                                      | Status | Priority | Notes                                                                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Add `.cursorignore`                                       | ✅     | High     | Done. Excludes node_modules, dist, build, artifacts, .env*, *.db, test-results, playwright-report, coverage, lockfile.                                                                                                                                                    |
| A2  | Add `.cursorindexingignore`                               | ✅     | Medium   | Done. Excludes lockfile, generated, build outputs from indexing.                                                                                                                                                                                                          |
| A3  | Add `.cursor/rules/` with project rules                   | ✅     | High     | Done. `always-project-standards`, `api-routes`, `frontend-patterns`.                                                                                                                                                                                                      |
| A4  | Add `AGENTS.md` at project root                           | ✅     | High     | Done. Commands, no TODOs/placeholders, lint before commit.                                                                                                                                                                                                                |
| A5  | Add `.cursor/commands/` (e.g. validate, add-api-endpoint) | ✅     | Medium   | Done. `validate`, `add-api-endpoint`.                                                                                                                                                                                                                                     |
| A6  | Add `.cursor/skills/` (optional)                          | ✅     | Low      | Done. `add-api-endpoint`, `debug-render-failure`, `hello-skill`, `repo-audit`, `validate`, `db-migration`, `plan-to-tasks`, `deploy-check`, `e2e-smoke`. PARTIAL skills.sh integration (no skills runner). Optional `npx skills add` from [skills.sh](https://skills.sh). |

### B. Lint, format, typecheck, CI

| ID  | Task                                    | Status | Priority | Notes                                                                                      |
| --- | --------------------------------------- | ------ | -------- | ------------------------------------------------------------------------------------------ |
| B1  | ESLint + Prettier (or Biome) in repo    | ✅     | High     | Done. `eslint.config.mjs`, `.prettierrc`; `lint`, `lint:fix`, `format`, `format:check`.    |
| B2  | `typecheck` script (server + web)       | ✅     | High     | Done. `typecheck` in each app; root `typecheck`.                                           |
| B3  | Root `check` or `validate` script       | ✅     | Medium   | Done. `check` = lint + typecheck. `/validate` command runs lint + typecheck + test.        |
| B4  | Husky + lint-staged (pre-commit)        | ✅     | High     | Done. Pre-commit runs `npx lint-staged`; lint + format staged `*.{ts,tsx,js,jsx,mjs,cjs}`. |
| B5  | CI: lint, typecheck, build before tests | ✅     | High     | Done. Job `lint-typecheck-build` runs audit, lint, typecheck, build.                       |

### C. Testing

| ID  | Task                                                    | Status | Priority | Notes                                                                                   |
| --- | ------------------------------------------------------- | ------ | -------- | --------------------------------------------------------------------------------------- |
| C1  | Vitest `--coverage` in server                           | ✅     | Medium   | Done. `test:coverage` in server; v8 provider, include src.                              |
| C2  | Unit tests: ffmpegUtils, captionsBuilder, planGenerator | ✅     | Medium   | Done. ffmpegUtils (escapeConcatPath, getMotionFilter); planValidator already had units. |
| C3  | Vitest + Testing Library in `apps/web`                  | ✅     | Low      | Done. vitest, jsdom, @testing-library/react, errors.test.                               |
| C4  | E2E for new flows (Analytics, Calendar, etc.)           | 🔲     | Low      | When those features exist                                                               |

### D. Code quality & anti–“AI lies”

| ID  | Task                                                             | Status | Priority | Notes                                                                                                                            |
| --- | ---------------------------------------------------------------- | ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Rules: no TODOs / placeholders / dummy in deliverables           | ✅     | High     | Done. `always-project-standards` + AGENTS.md.                                                                                    |
| D2  | Reduce `any` / `as any` (openai, planGenerator, routes, render)  | ✅     | Medium   | Done. planGenerator, openai, plan updateData; renderPipeline (ResumeState), verifyArtifacts (details `Record<string, unknown>`). |
| D3  | Zod validation for UUID params (runId, projectId, etc.)          | ✅     | Medium   | Done. run, project, plan, scene routes; 400 + details on invalid.                                                                |
| D4  | Helmet (security headers)                                        | ✅     | Medium   | Done. `helmet` in `index.ts`; `contentSecurityPolicy: false` for SPA.                                                            |
| D5  | Toast / global success feedback                                  | ✅     | Low      | Done. Sonner: “Plan saved” (autosave), “Render started” (Approve & Render).                                                      |
| D6  | i18n or consistent UI language (e.g. “Ostrzeżenia” → “Warnings”) | ✅     | Low      | PlanStudio “Warnings”; Output EN labels.                                                                                         |

### E. Security & audit (when sharing app)

| ID  | Task                                 | Status | Priority | Notes                                                                                                                      |
| --- | ------------------------------------ | ------ | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| E1  | Auth for `/api` and artifact access  | 🔲     | Low      | When exposing to others                                                                                                    |
| E2  | Rate limiting (`express-rate-limit`) | 🔲     | Low      | When exposing                                                                                                              |
| E3  | `npm audit` and dependency updates   | ✅     | Medium   | Done. `npm run audit`; CI step in lint-typecheck-build; TESTING_GUIDE. Fix moderate (vite/esbuild) via upgrade when ready. |

### F. Product (from master plan; optional here)

| ID  | Task                                         | Status | Priority | Notes                                                                                     |
| --- | -------------------------------------------- | ------ | -------- | ----------------------------------------------------------------------------------------- |
| F1  | Hook 3s (validator + prompts)                | ✅     | Medium   | planValidator warning; planGenerator prompts.                                             |
| F2  | Cost tracking (usage → Run, Output)          | ✅     | Medium   | openai estimatedCostUsd; artifacts.costEstimate; Output.                                  |
| F3  | Analytics, Channel presets, Script templates | ✅     | Low      | Done. Analytics (Run metrics + PATCH + Analytics.tsx), channel presets, script templates. |
| F4  | Calendar, SEO keywords, audit tweaks         | ✅     | Low      | Done. Calendar, SEO, full-app-completion audit.                                           |

### G. Docs & DX

| ID  | Task                                                   | Status | Priority | Notes                                                                               |
| --- | ------------------------------------------------------ | ------ | -------- | ----------------------------------------------------------------------------------- |
| G1  | `TESTING_GUIDE`: lint, typecheck, coverage             | ✅     | Medium   | Done. Lint, typecheck, format, check; link to DEVELOPMENT_MASTER_PLAN, AGENTS.      |
| G2  | `copilot-instructions`: mention lint, AGENTS.md, Rules | ✅     | Medium   | Done. Commands + “run lint/typecheck before commit”; link to AGENTS, .cursor/rules. |
| G3  | `.env.example` kept in sync with new vars              | 🔲     | Low      | Ongoing: when adding new variables in env.ts, add them to .env.example.             |

### H. Additional AI workflow (from deep research)

| ID  | Task                                                    | Status | Priority | Notes                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | Add `.cursor/BUGBOT.md`                                 | ✅     | Medium   | Done. No eval/exec, Zod + tests for API, backend tests required. [Cursor Bugbot](https://cursor.com/docs/bugbot)                                                                                                                                                                |
| H2  | Add `.github/instructions/` path-specific (optional)    | 🔲     | Low      | `NAME.instructions.md` with `applyTo` globs for Copilot (e.g. `api.instructions.md` → `apps/server/src/routes/**`, `frontend.instructions.md` → `apps/web/**`). [Copilot](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions) |
| H3  | Add `.cursor/hooks.json` (optional)                     | 🔲     | Low      | Hooks: e.g. `afterEdit` run formatter, or `beforeSession` inject context. [Cursor Hooks](https://cursor.com/docs/agent/hooks). Use sparingly.                                                                                                                                   |
| H4  | Use `rules-cli` / awesome-rules (optional)              | 🔲     | Low      | `npm i -g rules-cli`, `rules add starter/nextjs-rules` (or TS/Express), `rules render cursor` to supplement `.cursor/rules`. [rules.so](https://rules.so), [awesome-rules](https://github.com/continuedev/awesome-rules)                                                        |
| H5  | Add Cursor @Docs for stack                              | 🔲     | Low      | In Cursor: **Settings → Indexing & Docs → Add new doc**. Add Prisma, React, Vite, Tailwind, Playwright, Express as needed. Improves framework-aware suggestions.                                                                                                                |
| H6  | MCP servers (optional)                                  | 🔲     | Low      | **Settings → MCP**: e.g. Filesystem, Git, Fetch. Useful for repo-aware automation; optional for typical day-to-day.                                                                                                                                                             |
| H7  | Effective-prompting rule or AGENTS.md addition          | ✅     | Low      | Encode Replit-style guidance: be specific, incremental, give examples; avoid vague “make it better”. Reduces back-and-forth.                                                                                                                                                    |
| H8  | `CLAUDE.md` or `.claude/` (optional, Claude Code users) | 🔲     | Low      | If using Claude Code: same content as AGENTS.md or `.cursor/rules`; [Claude](https://docs.anthropic.com/en/docs/claude-code/best-practices). We have AGENTS.md.                                                                                                                 |
| H9  | Cursor ↔ GitHub integration + Bugbot                    | 🔲     | Low      | Connect GitHub in Cursor, enable Bugbot on repo. Enables PR review and “Fix in Cursor” from PR comments.                                                                                                                                                                        |

---

## 3. Recommended implementation order

1. **A1–A4, B1–B2, B4–B5** – Cursor context + lint/typecheck/CI + hooks. Biggest impact on quality and feedback.
2. **D1, D2, D3** – Reinforce “no placeholders” and types; UUID validation.
3. **C1, C2** – Coverage and extra unit tests.
4. **A5, B3, G1–G2** – Commands, `validate` script, docs.
5. **H1, H5, H7, H9** – BUGBOT, @Docs, prompting, GitHub+Bugbot (if you use PRs).
6. **D4–D6, E3, F\*, H2–H4, H6, H8** – Remaining quality, security, product, optional AI workflow.

---

## 4. Test layout

- **`npm run test`** runs api + planValidator, then **runSse** in a **separate vitest process**. This avoids shared Prisma state (runSse starts an HTTP server; previously, same-process run led to FK/create/404 issues).
- **`npm run test:render`** runs render dry-run tests (separate `test-render.db`). Can be slightly flaky; re-run if needed.

## 5. References

- **Cursor:** [Rules](https://cursor.com/docs/context/rules), [Commands](https://cursor.com/docs/context/commands), [Skills](https://cursor.com/docs/context/skills), [Ignore](https://cursor.com/docs/context/ignore-files), [Bugbot](https://cursor.com/docs/bugbot), [Hooks](https://cursor.com/docs/agent/hooks), [Semantic Search](https://cursor.com/docs/context/semantic-search), [@ Mentions](https://cursor.com/docs/context/mentions)
- **Project:** `.github/copilot-instructions.md`, [SECURITY.md](SECURITY.md), [TESTING_GUIDE.md](TESTING_GUIDE.md)
- **Mapa dokumentów (START HERE):** [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) – który plik jest główny, co dla AI

---

## 6. Deep research – what else could improve AI workflow

**Sources:** Cursor docs, Replit Agent, Claude Code, GitHub Copilot, Continue.dev, rules-cli / awesome-rules, Bugbot, MCP, Hooks, user recommendations (2024–2025).

### 6.1 Cursor-specific

- **Rules, Commands, Skills** – We use these. Keep them under ~500 lines each; reference files instead of pasting large blocks.
- **Semantic search / indexing** – Cursor indexes the workspace; use `@codebase` or Ctrl+⌘+Enter for semantic search. `.cursorindexingignore` reduces noise. Ensure **Settings → Indexing & Docs** has indexing enabled for the repo.
- **@Docs** – Add Prisma, React, Vite, Tailwind, Playwright, Express via **Settings → Indexing & Docs → Add new doc** (URLs). Improves framework-specific suggestions.
- **Bugbot** – PR review agent. Add `.cursor/BUGBOT.md` for project-specific rules (e.g. no `eval`, require tests for API changes). Enable via Cursor ↔ GitHub integration.
- **Hooks** – `.cursor/hooks.json` can run scripts before/after stages (e.g. format after edit, inject context at session start). Use sparingly; pre-commit already covers format.
- **MCP** – Model Context Protocol: optional servers (Filesystem, Git, Fetch, etc.) for tool use. Helpful for advanced automation; not required for standard coding.

### 6.2 Cross-tool (Replit, Claude, Copilot, Continue)

- **AGENTS.md** – We have it. Copilot also supports `CLAUDE.md`, `GEMINI.md` for agent-specific instructions.
- **Path-specific instructions** – Copilot: `.github/instructions/NAME.instructions.md` with `applyTo` globs. Cursor uses `globs` in rules. We have file-scoped rules; optional to add Copilot path-specific instructions too.
- **Modular rules** – Claude uses `.claude/rules/`; we use `.cursor/rules/`. Same idea: small, topic-based files.
- **Effective prompting** – Replit-style: be specific, give constraints and examples, iterate incrementally. Can be encoded in a Rule or AGENTS.md section to reduce vague prompts and “AI lies.”

### 6.3 Rules ecosystem

- **rules-cli** – `npm i -g rules-cli`. Add community rules (e.g. `rules add starter/nextjs-rules`), then `rules render cursor` to output `.cursor/rules`-compatible content. [awesome-rules](https://github.com/continuedev/awesome-rules) has TS, React, testing, etc.
- **Agent Skills** – [agentskills.io](https://agentskills.io). We have `.cursor/skills/`. Skills can include `scripts/`, `references/`, `assets/` for richer workflows.

### 6.4 What we already do well

- Project rules (always + file-scoped), AGENTS.md, copilot-instructions, commands, skills.
- Lint, format, typecheck, CI, pre-commit.
- No TODOs/placeholders in deliverables; Zod, structure, errors.
- Indexing ignore; .cursorignore; test layout.
- Agent quality rules (from jujumilk3 + CL4R1T4S): no proactive docs, read_lints scope, related files, don’t change tests to pass, check libs, mimic style, git guidelines.

### 6.5 Suggested order for new additions

1. **BUGBOT.md** (H1) – High leverage if you use PRs and Cursor ↔ GitHub.
2. **@Docs** (H5) – Quick win; add framework docs.
3. **Effective-prompting** (H7) – Small Rule or AGENTS.md addition.
4. **GitHub + Bugbot** (H9) – If you work with PRs.
5. **Path-specific Copilot** (H2), **hooks** (H3), **rules-cli** (H4), **MCP** (H6), **CLAUDE.md** (H8) – Optional, as needed.

---

_Checklist is updated as tasks are completed. Use 🔲 = todo, ✅ = done, 🔄 = in progress._
