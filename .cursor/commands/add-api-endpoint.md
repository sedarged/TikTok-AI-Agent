# Add API Endpoint

Follow these steps to add a new API endpoint correctly.

1. **Route** – Create or edit a file in `apps/server/src/routes/`. Define the handler (e.g. `router.post('/...', async (req, res) => { ... })`).
2. **Zod schema** – Define a schema for body (and params if needed). Use `safeParse()` on `req.body` / `req.params`. Return `400` with `{ error, details }` when validation fails. For IDs (e.g. `runId`, `projectId`), use `z.string().uuid()`.
3. **Register** – Mount the router in `apps/server/src/index.ts` under `/api/...`.
4. **Client** – Add a function in `apps/web/src/api/client.ts` that calls the new endpoint. Add or update types in `api/types.ts` as needed.
5. **Test** – Add or extend a test in `apps/server/tests/` (integration) or `apps/web/tests/e2e/` (E2E) to cover the new endpoint.

Do not leave TODOs, placeholders, or dummy implementations. Reference `apps/server/src/routes/project.ts` and `plan.ts` for patterns.
