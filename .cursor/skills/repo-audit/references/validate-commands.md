# Validate pipeline commands

Same sequence as the **validate** command and **repo-audit** skill. Run from repo root.

1. `npm run lint` (or `npm run lint:fix` if fixing)
2. `npm run typecheck` (or `npm run build` if no typecheck)
3. `npm run test`
4. `npm run test:render` (if available)
5. Optionally `npm run test:e2e` for full E2E

See [.cursor/commands/validate.md](.cursor/commands/validate.md) and [docs/testing.md](../../docs/testing.md).
