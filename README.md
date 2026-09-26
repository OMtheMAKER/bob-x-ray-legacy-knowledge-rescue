# 🔦 Bob X-Ray — Legacy Knowledge Rescue

> **IBM Bob 2.0 Hackathon Submission**
> Scan any legacy repo with IBM Bob → get a complete Onboarding Kit in minutes.
> New developers become productive on **Day 1** — not Week 3.

---

## 🎯 The Problem

IBM has 80,000+ developers and decades of legacy code. A new joiner takes **3-4 weeks**
just to understand what a codebase does — architecture docs are missing or outright lying.
Seniors burn **30-40% of their time** answering the same onboarding questions. The most
critical knowledge (pricing rules, auth quirks, deprecated contracts) lives only in
tribal memory. **Bus Factor = 1.**

## 💡 The Solution

Give Bob a repository — it scans everything and generates a full **Onboarding Kit**:

| Deliverable | What it gives the new developer |
|---|---|
| 📖 `ONBOARDING.md` | What the project is, 5-min setup, folder guide, and the "known quirks" nobody documents |
| 📊 `ARCHITECTURE.md` | Mermaid diagrams reverse-engineered from code: system map, dependency graph (color-coded by risk), request sequence, ER diagram, status machine |
| ⚠️ `RISK-REPORT.md` | File-by-file risk scores (1-10), **Bus Factor report**, knowledge landmines, quick wins |
| ✅ `STARTER-TASKS.md` | 3 safe first tasks — each with steps, estimates, and **TRAP warnings** |
| 🎨 `index.html` | Self-contained dark dashboard presenting the whole kit — mermaid embedded, works offline |

Demo repo: **`oms-api/`** — a realistic undocumented Node.js/Express/PostgreSQL
order-management API (tiered pricing engine, coupon system, token auth, FAKE_MODE
database fallback). It actually runs: `npm install && npm start` → port 4790 →
`curl /health` → **200 OK**.

## 🤖 How IBM Bob Was Used (all 4 capabilities)

| Bob Feature | Where it was used |
|---|---|
| **Ask** | Full repo analysis — tech stack, entry point, boot flow, module dependency map, complexity ranking |
| **Agent** | Created the 14-file legacy repo; generated all 4 kit documents; built the dashboard |
| **Orchestrator / Subagents** | Kit generated as **4 parallel subtasks** ("All tasks completed! 4/4") |
| **Document Understanding** | ⭐ Cross-checked the repo's outdated 2019 API doc against the actual code → **"Docs vs Code" lie table with 8 confirmed conflicts** (wrong auth scheme, wrong token TTL, "missing" coupons & refund endpoint, wrong URL prefix, undocumented statuses) |

## 📁 Repository Structure

```
├── oms-api/                 ← demo legacy repo (input) + generated Onboarding Kit (output)
│   ├── server.js, controllers/, routes/, db/, utils/     ← the legacy codebase
│   ├── ONBOARDING.md / ARCHITECTURE.md / RISK-REPORT.md / STARTER-TASKS.md
│   └── index.html           ← Bob X-Ray dashboard (open in any browser)
└── bob_sessions/            ← proof-of-work screenshots from the Bob session
    └── PROOF.md             ← index of every screenshot + which Bob capability it proves
```

## 🚀 Run It

```bash
cd oms-api
npm install
npm start          # → http://localhost:4790  (runs even without a DB — FAKE_MODE)
curl localhost:4790/health   # → 200 OK
```

Then open `oms-api/index.html` in a browser to see the full Onboarding Kit dashboard.

## 💥 Impact

- **Onboarding:** 3-4 weeks → Day 1 productive
- **Senior mentoring load:** −30-40% (repetitive questions answered by the kit)
- **Knowledge risk:** Bus Factor made visible & actionable, landmines documented
- **Repeatable:** one command re-runs the entire analysis on any repo

---

*Built inside IBM Bob — every screenshot in `bob_sessions/` is a live session artifact.*
