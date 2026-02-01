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
| `DEVELOPMENT_MASTER_PLAN.md` | Content migrated to `STATUS.md` (automated) and GitHub Issues | ⏳ | grep, link check |
| `GITHUB_ISSUES.md` | Converted to GitHub Issues where relevant | ⏳ | grep, link check, issue audit |
| `QUICK_FIX_GUIDE.md` | Content migrated to `.cursor/docs/common-pitfalls.md` and GitHub Issues | ⏳ | grep, link check, issue audit |
| `DOCKER.md` | Merged into `docs/deployment.md` (Docker section) | ⏳ | grep, link check |
| `DOCKER_VALIDATION.md` | Merged into `docs/deployment.md` (Docker section) | ⏳ | grep, link check |

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
