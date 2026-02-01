---
name: plan-to-tasks
description: Turn product plan or requirements into a checklist or task list (e.g. for STATUS.md). Use when given a plan fragment, roadmap, or requirements to break down into concrete tasks.
compatibility: TikTok-AI-Agent. General.
---

# Plan to Tasks

Convert product plan or requirements into an ordered checklist or task list.

## Input

- A fragment of a plan, roadmap, or requirements (e.g. from STATUS.md, issues, or user-provided text).

## Steps

1. Parse the plan or requirements.
2. Extract discrete, actionable items. Prefer small units (single deliverable or change).
3. Order logically (dependencies first, then independent work).
4. Output a **task list** (markdown or similar) with short labels. Optionally add IDs (e.g. P1, P2) or link to existing checklist items (e.g. D3, C1) where relevant.

## Output

- Ordered list of tasks with brief descriptions. No implementation; only the breakdown.

## References

- [STATUS.md](../../STATUS.md) – current priorities and active work
