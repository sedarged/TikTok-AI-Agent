---
name: add-api-endpoint
description: Add a new API endpoint following project conventions (Zod, route registration, client, tests). Use when creating or extending backend API routes.
compatibility: TikTok-AI-Agent, Node, Express, Prisma. Routes in apps/server, client in apps/web.
---

# Add API Endpoint

Use this skill when adding a new REST endpoint to TikTok-AI-Agent.

## Steps

1. **Route** – Create or edit a file in `apps/server/src/routes/`. Implement the handler (e.g. `router.get/post('/...', async (req, res) => { ... })`).
2. **Zod** – Define a schema for body and, if needed, params. Use `safeParse()` on `req.body` / `req.params`. Return `400` with `{ error, details: parsed.error.flatten() }` on failure. For `runId`, `projectId`, `planVersionId`, use `z.string().uuid()`.
3. **Register** – Mount the router in `apps/server/src/index.ts` under `/api/...`.
4. **Client** – Add a function in `apps/web/src/api/client.ts` and update `api/types.ts` if needed.
5. **Test** – Add or extend an integration test in `apps/server/tests/` or E2E in `apps/web/tests/e2e/`.

## Rules

- Do not leave TODOs, placeholders, or dummy code.
- Use `try/catch` for DB and external calls; return 5xx JSON on failure.
- Wrap `JSON.parse` in try/catch. Use `.strict()` on body schemas.

## References

- [apps/server/src/routes/project.ts](apps/server/src/routes/project.ts), [plan.ts](apps/server/src/routes/plan.ts)
- [.cursor/rules/api-routes.mdc](.cursor/rules/api-routes.mdc)
