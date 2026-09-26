# 📸 PROOF OF WORK — Bob X-Ray (Legacy Knowledge Rescue)

> Screenshots showing every step of this project was built **inside IBM Bob**,
> using all 4 required capabilities: **Ask · Agent · Orchestrator/Subagents · Document Understanding**.

## Bob Session Evidence

| # | File | Task | Bob Feature Proven |
|---|------|------|--------------------|
| 1 | `task1-agent-repo-created.png` | Task 1 — legacy repo creation (14 files) | **Agent mode** — Bob created the undocumented oms-api codebase file-by-file (with permission prompts); it also caught a missing `/health` endpoint itself and fixed it ("Applied diff to oms-api/server.js", 15 files changed) |
| 2 | `task2-ask-analysis.png` | Task 2 — full repo analysis | **Ask mode** — Tech Stack table (Node/Express/PostgreSQL, hand-rolled token auth), "Entry Point & Boot Flow", only 2 direct dependencies |
| 3 | `task2-ask-analysis-2.png` | Task 2 (continued) | **Ask mode** — boot-flow diagram (Real Mode vs FAKE_MODE paths), Module Dependency Map, port 4790 finance cron dependency |
| 4 | `task2-docs-vs-code.png` | Task 2 (bonus) | ⭐ **Document Understanding** — Bob cross-checked `API_DOCS_v2019.md` against code and produced the "Docs vs Code: What's Outdated" lie table: wrong auth (Basic vs Token), wrong TTL (24h vs actual 72h), "no coupons" (LAUNCH50 + GHOST20 exist), "no refund endpoint" (exists), hard-delete claim (actually soft-delete), wrong /v1/ prefix, missing R status, undocumented /health + /status |
| 5 | `task3-agent-onboarding-kit.png` | Task 3 — Onboarding Kit | **Agent + Orchestrator** — "All tasks completed! 4/4": ONBOARDING.md, ARCHITECTURE.md, RISK-REPORT.md, STARTER-TASKS.md generated as parallel subtasks (orderController 8/10, docs 7/10 "the lie table", userController 6/10, helpers 4/10, server 3/10, logger 2/10) + Bus Factor table + 7 landmines + 6 quick wins + 3 starter tasks with TRAP sections |
| 6 | `task4-agent-dashboard.png` | Task 4 — dashboard | **Agent mode** — self-contained dark dashboard generated; then hardened by the team: fixed Mermaid syntax edge-cases, embedded the mermaid library inline, made it offline-capable |

## Product Evidence

| # | File | What it shows |
|---|------|---------------|
| 7 | `bob-all-tasks-complete.png` | Bob panel: "All tasks completed! 4/4" — clean proof that all 4 tasks ran inside Bob |
| 8 | `server-running.png` | The generated legacy repo **actually runs**: `curl /health` → `HTTP 200 OK` on port 4790 |
| 9 | `final-dashboard.png` | Final dashboard with architecture diagrams rendered — dependency graph color-coded by risk (red = orderController, orange = auth/db, yellow = medium, green = safe) |

## The Problem We Solved (one line)

New developers take 3-4 weeks to become productive on undocumented legacy code; seniors
burn 30-40% of their time explaining it. **Bob X-Ray scans any repo and generates a complete
Onboarding Kit — guide, architecture diagrams, risk report with Bus Factor, and 3 starter
tasks — in minutes, Day-1 productivity instead of Week-3.**
