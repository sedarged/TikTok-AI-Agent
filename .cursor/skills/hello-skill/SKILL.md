---
name: hello-skill
description: Say hello and list project commands. Use for a quick project intro or when the user asks "what can this project do" or "list commands".
compatibility: TikTok-AI-Agent. Cursor, terminal.
---

# Hello Skill

Use this skill when the user wants a brief project intro or a list of available commands.

## Steps

1. Greet and state that this is **TikTok-AI-Agent** (TikTok-style video generator: Topic → Plan → Render → MP4).
2. List the main commands from the project root:

   - `npm run dev` – server (3001) + web (5173)
   - `npm run build` – build both apps
   - `npm run test` – backend unit + integration tests
   - `npm run test:render` – render pipeline dry-run tests
   - `npm run test:e2e` – Playwright E2E
   - `npm run lint`, `npm run typecheck`, `npm run check` – quality
   - `npm run db:generate`, `npm run db:migrate:dev`, `npm run db:seed` – database

3. Point to [AGENTS.md](AGENTS.md) and [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) for more.

## References

- [AGENTS.md](AGENTS.md) – agent instructions and commands
- [README.md](README.md) – Quick Start, API, render pipeline
