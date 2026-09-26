# AGENTS.md — Bob X-Ray Workflow Instructions

> **Purpose:** Any developer who clones this repo and opens IBM Bob here will have
> the full "Bob X-Ray — Legacy Knowledge Rescue" workflow available. Bob reads this
> file as standing project instructions, so the Onboarding-Kit generation below
> works as a repeatable, semi-automatic "function".

## What this project does

Given any legacy codebase in a folder, guide Bob through a 4-step pipeline that
produces a complete **Onboarding Kit** so a new developer is productive on Day 1
instead of week 3:

1. **ONBOARDING.md** — what the project is, setup steps, folder guide, hidden quirks
2. **ARCHITECTURE.md** — 3–5 Mermaid diagrams: system map, module dependency graph
   (risk-colored), key sequence flow, data model / state machine
3. **RISK-REPORT.md** — per-file risk scores, tribal-knowledge landmines,
   outdated-doc conflicts, Bus Factor calculation
4. **STARTER-TASKS.md** — 3 safe day-1 starter tasks, each with a TRAP warning
   (the hidden reason the obvious fix fails)

Plus an offline **index.html dashboard** that bundles the whole kit.

## The pipeline (run in this order)

### Step 1 — Ask mode: repo analysis
```
@. Analyze this full repo: tech stack, entry point, module dependencies,
which 3 files are most complex and why, and which docs are outdated vs the code.
Explain like I'm a new joiner.
```

### Step 2 — Document Understanding: docs-vs-code cross-check
```
Compare every doc in docs/ (or any *.md documentation) against the actual code.
List every claim in the docs that contradicts the code, as a table:
| # | Doc says | Code actually does | Evidence (file:line) | Risk if trusted |
```

### Step 3 — Orchestrator: generate the kit in parallel
```
Orchestrate 4 subtasks in parallel and report completion of each:
1. Write ONBOARDING.md (setup, folder guide, quirks, "gotchas no one will tell you")
2. Write ARCHITECTURE.md with Mermaid diagrams (system map, risk-colored dependency
   graph, main sequence flow, data model)
3. Write RISK-REPORT.md (per-file risk scores, landmines with business context,
   Bus Factor per module)
4. Write STARTER-TASKS.md (3 starter tasks, each with a TRAP warning)
```

### Step 4 — Agent mode: build the dashboard
```
Create index.html: a dark-themed dashboard embedding the full kit — scan summary
stats bar, tabbed sections (Overview / Architecture / Risk / Starter Tasks /
Onboarding), all Mermaid diagrams rendered. It must work fully offline (embed all
JS libraries inline, no CDN).
```

## Rules Bob must follow here

- Output every artifact in **English**, in Markdown, at the repo root.
- Every claim in RISK-REPORT.md must cite **file + line evidence**.
- Never invent business rules: derive them from code, and mark uncertain ones
  as "inferred — verify with the team".
- Keep diagrams **Mermaid** (GitHub renders them natively).
- The dashboard must be a **single self-contained index.html** that opens via file://.
- Preserve the demo assets in `oms-api/` and `sample-legacy-repo/` — they are the
  example input/output for judges of the IBM Bob 2.0 hackathon.

## Verify success

You are done when: all 4 kit files exist, ARCHITECTURE.md has ≥ 4 valid Mermaid
blocks, STARTER-TASKS.md has exactly 3 tasks with traps, and index.html renders
the kit offline. Report a completion summary listing each artifact.
