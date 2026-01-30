---
name: plan-to-tasks
description: Turn product plan or requirements into a checklist or task list (e.g. for DEVELOPMENT_MASTER_PLAN). Use when given a plan fragment, roadmap, or requirements to break down into concrete tasks.
compatibility: TikTok-AI-Agent. General.
---

# Plan to Tasks

Convert product plan or requirements into an ordered checklist or task list.

## Input

- A fragment of a plan, roadmap, or requirements (e.g. from DEVELOPMENT_MASTER_PLAN, tiktok-ai-master-plan-ostateczny, or user-provided text).

## Steps

1. Parse the plan or requirements.
2. Extract discrete, actionable items. Prefer small units (single deliverable or change).
3. Order logically (dependencies first, then independent work).
4. Output a **task list** (markdown or similar) with short labels. Optionally add IDs (e.g. P1, P2) or link to existing checklist items (e.g. D3, C1) where relevant.

## Output

- Ordered list of tasks with brief descriptions. No implementation; only the breakdown.

## References

- [DEVELOPMENT_MASTER_PLAN.md](DEVELOPMENT_MASTER_PLAN.md) – main checklist, task IDs
- [.cursor/plans/next-steps-proposal.plan.md](.cursor/plans/next-steps-proposal.plan.md) – Tier 1–4 proposal
