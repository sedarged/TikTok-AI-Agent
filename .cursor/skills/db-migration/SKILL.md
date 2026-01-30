---
name: db-migration
description: Create and apply Prisma migrations; validate schema. Use when changing the database schema, adding models or columns, or running migrations.
compatibility: TikTok-AI-Agent. Node, Prisma, SQLite. Schema in apps/server/prisma.
---

# DB Migration

Create and apply Prisma migrations for TikTok-AI-Agent.

## Input

- Description of the change (e.g. "add Project.costCents") or concrete diff. Optionally a migration name.

## Steps

1. **Edit schema** – Update `apps/server/prisma/schema.prisma`. Keep relations, `@id`, `@default`, etc. consistent.
2. **Create migration** – From repo root:
   - `npm run db:migrate:dev` (creates and applies in dev), or
   - `cd apps/server && npx prisma migrate dev --name <snake_case_name>`.
3. **Verify** – Run `npx prisma generate` (or `npm run db:generate`) and ensure the app typechecks. Run `npm run test` if touching code that uses the new schema.
4. **Report** – "Migration created and applied" or "Migration failed: …" with next steps (e.g. fix schema, resolve conflicts).

## Output

- Updated `schema.prisma` and a new migration under `apps/server/prisma/migrations/`.
- Short summary: success or failure and what to do next.

## References

- [apps/server/prisma/schema.prisma](apps/server/prisma/schema.prisma)
- [AGENTS.md](AGENTS.md) – `db:generate`, `db:migrate:dev`
- [.cursor/rules/always-project-standards.mdc](.cursor/rules/always-project-standards.mdc) – DB section
