---
name: repo-audit
description: Run lint, typecheck, test, and test:render; collect results and produce a short audit report. Use when asked to "audit the repo", "check project health", or "run full validation".
compatibility: TikTok-AI-Agent. Node, npm. Run from repo root.
---

# Repo Audit

Run the validation pipeline and produce a short markdown report.

## Input

- Open workspace (TikTok-AI-Agent). Optionally a "scope" (e.g. "backend only") – still run from root; you may skip `test:e2e` if scope is backend-only.

## Steps

1. From repo root, run in order:
   - `npm run lint` – note pass or first ~5 lines of errors.
   - `npm run typecheck` – note pass or first ~5 lines of errors.
   - `npm run test` – note pass or failing test names/messages.
   - `npm run test:render` – note pass or failures.
2. Optionally `npm run test:e2e` if full audit (requires Playwright browsers).
3. Produce a **short markdown report** with:
   - Each step: **ok** or **fail** + summary.
   - Final line: **Audit: pass** or **Audit: fail** and list of failed steps.

## Output

A concise report, e.g.:

```markdown
## Repo audit

- `npm run lint` – ok
- `npm run typecheck` – ok
- `npm run test` – ok
- `npm run test:render` – ok

**Audit: pass**
```

Or, on failure, which steps failed and the first few error lines.

## References

- [.cursor/commands/validate.md](.cursor/commands/validate.md) – validate command (same steps, no report format)
- [docs/testing.md](../../docs/testing.md) – test setup, env, commands
