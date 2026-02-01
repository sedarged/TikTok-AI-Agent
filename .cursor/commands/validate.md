# Validate: Lint, Typecheck, Tests

Run the full validation pipeline and report what failed.

1. **Lint:** `npm run lint` (or `npm run lint:fix` if available). Note any errors or warnings.
2. **Typecheck:** `npm run typecheck` (or `npm run build` if no typecheck script). Note TypeScript errors.
3. **Tests:** `npm run test`, then `npm run test:render` if available. Note failing tests.
4. **Summarize:** List which steps passed or failed and the first few error messages for any failure. Do not commit if any step fails unless the user explicitly asks to ignore.

If `lint` or `typecheck` scripts are missing, say so and suggest adding them (see [STATUS.md](../../STATUS.md)).
