# Documentation Migration Log

This file tracks the migration of documentation files to their new locations.

## Status Legend

- ✅ - Migration complete, links updated, verified no references
- 🔄 - In progress
- ⏳ - Planned

---

## Moves (PR3)

| Source | Destination | Status | Notes |
|--------|-------------|--------|-------|
| `COST_ANALYSIS_60SEC_VIDEO.md` | `docs/cost/COST_ANALYSIS_60SEC_VIDEO.md` | ✅ | Cost analysis for 60s video |
| `COST_VISIBILITY_AND_REDUCTION.md` | `docs/cost/COST_VISIBILITY_AND_REDUCTION.md` | ✅ | Cost visibility and reduction strategies |
| `LOCAL_PROVIDERS_AND_COST_REDUCTION.md` | `docs/cost/LOCAL_PROVIDERS_AND_COST_REDUCTION.md` | ✅ | Local providers and cost optimization |
| `CONTROL_PANEL_PROPOSAL.md` | `docs/proposals/CONTROL_PANEL_PROPOSAL.md` | ✅ | Control panel feature proposal |
| `TOPIC_SUGGESTIONS_IMPLEMENTATION.md` | `docs/proposals/TOPIC_SUGGESTIONS_IMPLEMENTATION.md` | ✅ | Topic suggestions implementation |
| `TOPIC_SUGGESTIONS_VISUAL_GUIDE.md` | `docs/proposals/TOPIC_SUGGESTIONS_VISUAL_GUIDE.md` | ✅ | Topic suggestions visual guide |

---

## Deletions (PR4 - After Verification)

| Source | Destination/Action | Status | Verification |
|--------|-------------------|--------|--------------|
| `DEVELOPMENT_MASTER_PLAN.md` | Content migrated to `STATUS.md` (automated) and GitHub Issues | ✅ | grep ✅ (0 refs), link check ✅ |
| `GITHUB_ISSUES.md` | Converted to GitHub Issues where relevant | ✅ | grep ✅ (0 refs), link check ✅ |
| `QUICK_FIX_GUIDE.md` | Content migrated to `.cursor/docs/common-pitfalls.md` and GitHub Issues | ✅ | grep ✅ (0 refs), link check ✅ |
| `DOCKER.md` | Content already in `docs/deployment.md`, links updated | ✅ | grep ✅ (0 refs), link check ✅ |
| `DOCKER_VALIDATION.md` | Content already in `docs/deployment.md`, validation notes preserved | ✅ | grep ✅ (0 refs), link check ✅ |

---

## Security Fixes Documented (Feb 2026 Audit)

These fixes were completed in previous PRs and verified in the Feb 2026 audit:

| Issue | Files | Status | Notes | Evidence |
|-------|-------|--------|-------|----------|
| Silent failure on empty topics | `apps/server/src/routes/batch.ts` | ✅ FIXED | Added validation + error response with `emptyTopicIndexes` | AUDIT_SUMMARY_COMMENT.md (P0-1) |
| Batch fail-fast without rollback | `apps/server/src/routes/batch.ts` | ✅ FIXED | Restructured to two-phase: validate all, then queue all or rollback | AUDIT_SUMMARY_COMMENT.md (P0-2) |
| Scene update race condition | `apps/server/src/routes/plan.ts` | ✅ FIXED | Wrapped scene updates in Prisma transaction for atomic operations | AUDIT_SUMMARY_COMMENT.md (P0-3) |
| Silent orphaned projects | `apps/server/src/routes/batch.ts` | ✅ FIXED | Added 3-attempt retry (500ms delay) with error instead of silent continue | AUDIT_SUMMARY_COMMENT.md (P0-4) |
| SSE heartbeat memory leak | `apps/server/src/routes/run.ts` | ✅ VERIFIED | Cleanup code already exists at lines 267-277 | AUDIT_SUMMARY_COMMENT.md (P1-4) |
| Scene lock missing check | `apps/server/src/routes/scene.ts` | ✅ FIXED | Added existence check + P2025 error handling for proper 404 | AUDIT_SUMMARY_COMMENT.md (P1-5) |
| Automate missing error handling | `apps/server/src/routes/automate.ts` | ✅ FIXED | Added 3-attempt retry with detailed error message | AUDIT_SUMMARY_COMMENT.md (P1-6) |
| Project delete no run check | `apps/server/src/routes/project.ts` | ✅ FIXED | Returns 409 Conflict if active runs exist, with run IDs | AUDIT_SUMMARY_COMMENT.md (P2-3) |
| Node version mismatch | `README.md` | ✅ FIXED | Updated to specify Node 20.19+ or 22.12+ | AUDIT_REPORT.md, line 54 |
| Dependency vulnerabilities (8 issues) | `package.json` overrides | ✅ FIXED | Fixed hono, lodash, chevrotain using npm overrides | docs/security.md (Dependency Vulnerabilities section) |

**Migration to Canonical Docs:**
- Security fixes documented in `docs/security.md` (Security Audit Findings section)
- Dependency vulnerability details migrated to `docs/security.md` (Dependency Vulnerabilities section)
- `DEPENDENCY_VULNERABILITIES.md` deleted after content migration

---

## Verification Checklist (Before Deletion)

For each file to be deleted:

1. ✅ Content migrated and recorded in this log
2. ✅ Zero references found via grep:
   ```bash
   grep -RIn --exclude-dir=node_modules --exclude-dir=.git "<FILENAME>" .
   ```
3. ✅ Markdown link check passes:
   ```bash
   npx --yes markdown-link-check README.md
   npx --yes markdown-link-check AGENTS.md
   npx --yes markdown-link-check STATUS.md
   npx --yes markdown-link-check docs/README.md
   ```

---

## Notes

- All moves in PR3 use `git mv` to preserve file history
- Links updated in all referencing documents
- PR4 deletions only happen after verification gates pass
- Migration log updated with each step
