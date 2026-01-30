# Skills (Agent Skills)

Project skills for TikTok-AI-Agent, in [Agent Skills](https://agentskills.io) format. Cursor loads them from `.cursor/skills/`.

## How to run locally

1. Open the repo in Cursor.
2. Skills are loaded automatically from `.cursor/skills/` (project-level).
3. Use **Agent** and mention a task (e.g. "audit the repo", "add an API endpoint") or type `/` and pick a skill (e.g. `/repo-audit`, `/hello-skill`).

## What’s here

| Skill | Use when |
|-------|----------|
| `hello-skill` | Quick intro, list project commands |
| `repo-audit` | Audit repo: lint, typecheck, test, test:render → report |
| `validate` | Run full validation pipeline, summarize pass/fail |
| `add-api-endpoint` | Add new API route (Zod, client, tests) |
| `debug-render-failure` | Debug render pipeline, dry-run, retry |
| `db-migration` | Create/apply Prisma migrations |
| `plan-to-tasks` | Turn plan/requirements into task list |
| `deploy-check` | Pre-deploy checklist, rollback plan |
| `e2e-smoke` | Run Playwright E2E, report pass/fail |

## Install external skills (optional)

```bash
# List skills in a repo
npx skills add vercel-labs/agent-skills --list

# Install a specific skill for Cursor (project)
npx skills add antfu/skills -s vitest -a cursor -y

# Install from GitHub shorthand
npx skills add owner/repo --skill "skill-name" -a cursor -y
```

See [skills.sh](https://skills.sh) and [skills.sh/docs](https://skills.sh/docs). Project uses **PARTIAL** integration: no skills runner in backend; skills are context for Cursor only.
