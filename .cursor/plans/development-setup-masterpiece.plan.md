---
name: ""
overview: ""
todos: []
isProject: false
---

# Development Setup Masterpiece – Step-by-Step Task List

**Główny checklist:** [DEVELOPMENT_MASTER_PLAN.md](../../DEVELOPMENT_MASTER_PLAN.md). **Mapa dokumentów:** [DOCUMENTATION_INDEX.md](../../DOCUMENTATION_INDEX.md).  
**Purpose:** Single checklist to build the best possible AI-assisted development setup. Sources: jujumilk3/leaked-system-prompts, CL4R1T4S. Last updated: 2026-01-29.

---

## Phase 1: Context & ignore files


| Step | Task                           | Status | Notes                                                                                                                        |
| ---- | ------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 1.1  | Add `.cursorignore`            | ✅      | Done. Excludes node_modules, dist, build, artifacts, .env*, *.db, test-results, playwright-report, coverage, lockfile, .git. |
| 1.2  | Verify `.cursorindexingignore` | ✅      | Verified. Excludes same areas; no change needed.                                                                             |


---

## Phase 2: AGENTS.md – agent behavior & quality


| Step | Task                       | Status | Notes                                            |
| ---- | -------------------------- | ------ | ------------------------------------------------ |
| 2.1  | No proactive documentation | ✅      | Added to AGENTS.md and always-project-standards. |
| 2.2  | read_lints scope           | ✅      | Added to AGENTS.md.                              |
| 2.3  | Related files              | ✅      | Added to AGENTS.md.                              |
| 2.4  | Don’t change tests to pass | ✅      | Added to AGENTS.md and always-project-standards. |
| 2.5  | Check library availability | ✅      | Added to AGENTS.md.                              |
| 2.6  | Mimic code style           | ✅      | Added to AGENTS.md and always-project-standards. |
| 2.7  | Git (optional)             | ✅      | Added to AGENTS.md.                              |


---

## Phase 3: .cursor/rules – always-project-standards


| Step | Task              | Status | Notes                             |
| ---- | ----------------- | ------ | --------------------------------- |
| 3.1  | No proactive docs | ✅      | Done in always-project-standards. |
| 3.2  | Tests             | ✅      | Done in always-project-standards. |
| 3.3  | Mimic style       | ✅      | Done in always-project-standards. |


---

## Phase 4: Documentation updates


| Step | Task                            | Status | Notes                                                |
| ---- | ------------------------------- | ------ | ---------------------------------------------------- |
| 4.1  | DEVELOPMENT_MASTER_PLAN.md      | ✅      | A1 set to done; Last updated bumped; 6.4 note added. |
| 4.2  | .github/copilot-instructions.md | ✅      | Verified; AGENTS.md and .cursor/rules referenced.    |
| 4.3  | TESTING_GUIDE.md                | ✅      | Link to AGENTS.md; agents run tests before push.     |


---

## Execution order

1. **Phase 1** – .cursorignore, verify .cursorindexingignore
2. **Phase 2** – AGENTS.md (all 2.1–2.7)
3. **Phase 3** – always-project-standards.mdc (3.1–3.3)
4. **Phase 4** – DEVELOPMENT_MASTER_PLAN, copilot-instructions, TESTING_GUIDE

---

---

## Summary

All phases completed 2026-01-29. Result: `.cursorignore` in place; AGENTS.md and `.cursor/rules/always-project-standards.mdc` enhanced with no proactive docs, read_lints scope, related files, tests, libs, style, git; DEVELOPMENT_MASTER_PLAN, TESTING_GUIDE updated.

*Checklist: 🔲 = todo, ✅ = done.*