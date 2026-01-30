---
name: deploy-check
description: Pre-deploy checklist: build, migrations, healthcheck; brief rollback plan. Use before deploying or when asked "what to check before deploy" or "rollback plan".
compatibility: TikTok-AI-Agent. Node, Prisma. Railway, Procfile, railway.toml.
---

# Deploy Check

Run a pre-deploy checklist and outline a simple rollback plan.

## Input

- Target (e.g. "Railway", "staging") or branch. Descriptive only; no secrets.

## Steps

1. **Build** – `npm run build`. Ensure it succeeds.
2. **Migrations** – `npm run db:generate` and `npm run db:migrate` (or `db:migrate:dev` in dev). Confirm no pending migrations that would break deploy.
3. **Healthcheck** – After deploy, `GET /api/health` should return `{ status: "ok", database: { ok: true } }`.
4. **Rollback plan** – Short list: revert to previous deployment, re-run migrations if rolled back schema, restore `DATABASE_URL` / env if changed. Do not run rollback automatically; only describe steps.

## Output

- List of checks (build, migrations, health) and pass/fail.
- Brief "Rollback plan" section: what to revert and in what order.

## References

- [railway.toml](railway.toml), [Procfile](Procfile) – build and start commands
- [README.md](README.md) – Production notes, env vars
