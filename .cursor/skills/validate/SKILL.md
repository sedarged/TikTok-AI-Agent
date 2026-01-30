---
name: validate
description: Run lint, typecheck, test, and test:render; summarize pass/fail. Complements the validate command. Use when user asks to "validate", "run checks", or "run full validation".
compatibility: TikTok-AI-Agent. Node, npm. Run from repo root.
---

# Validate (Skill)

Mirrors the **validate** command: run the full validation pipeline and summarize.

## Steps

1. **Lint:** `npm run lint` (or `npm run lint:fix` if available). Note errors or warnings.
2. **Typecheck:** `npm run typecheck` (or `npm run build` if no typecheck). Note TypeScript errors.
3. **Tests:** `npm run test`, then `npm run test:render` if available. Note failing tests.
4. **Summarize:** List which steps passed or failed and the first few error messages for any failure. Do not commit if any step fails unless the user explicitly asks to ignore.

If `lint` or `typecheck` scripts are missing, say so and suggest adding them (see DEVELOPMENT_MASTER_PLAN.md).

## References

- [.cursor/commands/validate.md](.cursor/commands/validate.md) – validate command
- [repo-audit](.cursor/skills/repo-audit) – same steps with a structured audit report format
