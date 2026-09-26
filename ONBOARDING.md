# OMS API — Developer Onboarding Guide

> **Audience:** Brand-new developer joining the project.  
> **Based on:** Actual source code in `oms-api/` — not the docs in `oms-api/docs/` (those are outdated; see Quirks).

---

## What Is This Project?

This is the **Order Management System API** — an internal REST API that powers order creation, lifecycle management, and user administration for an e-commerce backend. It is written in Node.js (Express) and persists data to a PostgreSQL database.

Key capabilities:
- Token-based authentication and session management
- User CRUD with role-based access control (`admin` / `customer`)
- Order creation with a server-side tiered pricing engine (qty discounts + coupon codes + tax + shipping)
- Order lifecycle: **P** (Pending) → **C** (Completed) / **X** (Cancelled) / **R** (Refunded)
- A `refundOrder` endpoint that flags an order as refunded in the DB; the actual payment reversal happens in the external finance portal

The API listens on **port 4790**. An external finance cron job hits this port at `02:00` every night — do not change the port.

---

## 5-Minute Setup

### Prerequisites
- Node.js ≥ 16
- `npm`
- (Optional) A running PostgreSQL instance; without one the server silently enters **FAKE_MODE** (see Quirks)

### Steps

```bash
# 1. Enter the project directory
cd oms-api

# 2. Install dependencies
npm install

# 3. Set environment variables (see table below) — or skip for FAKE_MODE
export DB_URL="postgres://oms_user:yourpass@localhost:5432/oms_db"
export TOKEN_SALT="change-me-for-local-dev"
export LOG_LEVEL="debug"

# 4. Start the server
npm start
# Server logs: [INFO] OMS API listening on port 4790

# 5. Verify it's up
curl http://localhost:4790/health   # → 200 OK
curl http://localhost:4790/status   # → {"ok":true,"ver":"2.3.1"}

# 6. Log in and get a token (FAKE_MODE credentials work without a DB)
curl -s -X POST http://localhost:4790/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret"}'
# Returns: {"token":"...","expiresAt":"..."}
```

**All subsequent requests** use `Authorization: Token <token>`.

---

## Folder Guide

```
oms-api/
├── server.js                  Entry point — wires Express, routes, and global middleware
├── config.js                  ALL hard-coded config (port, DB URL, secrets, coupons, tax)
│
├── controllers/
│   ├── authController.js      Login/logout handlers + requireAuth middleware + in-memory session store
│   ├── orderController.js     Pricing engine + full order CRUD (too big; split was planned, never done)
│   └── userController.js      User CRUD with inline admin checks
│
├── routes/
│   ├── authRoutes.js          POST /auth/login, POST /auth/logout
│   ├── orderRoutes.js         GET/POST /orders, PATCH /orders/:id/status, POST /orders/:id/refund
│   └── userRoutes.js          GET/POST/PUT/DELETE /users (and /users/:id)
│
├── db/
│   └── connection.js          pg.Pool wrapper; auto-falls to FAKE_MODE when DB is unreachable
│
├── utils/
│   ├── helpers.js             floorCents, paginate, formatDateYMD, deepClone (+ dead code)
│   └── logger.js              Minimal console logger; level controlled by LOG_LEVEL env var
│
├── legacy/
│   └── old_schema.sql         2017 original schema — for reference only, DO NOT run against any DB
│
└── docs/
    └── API_DOCS_v2019.md      Outdated 2019 API docs — several things in here are WRONG (see Quirks)
```

---

## Environment Variables

| Variable | Where it lives today | What it does | Notes |
|---|---|---|---|
| `DB_URL` | Hard-coded in `config.js` | PostgreSQL connection string | Move to env before any prod deploy |
| `TOKEN_SALT` | Hard-coded in `config.js` (`xK9#mL2$nP7@qR4`) | Signs session tokens | Changing it invalidates ALL active sessions |
| `PORT` | Hard-coded `4790` in `config.js` | API listen port | **Do not change** — finance cron depends on it |
| `LOG_LEVEL` | Env var read in `utils/logger.js` | `error`/`warn`/`info`/`debug` | Defaults to `info` |

> ⚠️ **There is no `.env` file support.** `config.js` contains live secrets. Before any production deployment, all values in `config.js` must be extracted to real environment variables.

---

## Known Quirks & Tribal-Knowledge Traps

### 1. FAKE_MODE — silent data loss
If the database is unreachable at startup (or errors after startup), `db/connection.js` switches `FAKE_MODE = true`. The server keeps running against **in-memory stub data**. Writes appear to succeed but are lost on restart. Watch logs for `FAKE_MODE` lines. **This has accidentally activated in staging once.**

### 2. Auth header format — docs are wrong
`docs/API_DOCS_v2019.md` says to use `Authorization: Basic <base64>`. The actual code requires `Authorization: Token <token>`. Use the token format.

### 3. Token TTL is 72 hours, not 24
The old docs say 24-hour TTL. The real value in `config.js` is `TOKEN_TTL_HOURS: 72`. Sessions are also stored **in-memory** — a server restart logs everyone out.

### 4. Passwords are NOT bcrypt
Passwords are stored as `base64(username:password)` — e.g. `base64("alice:pass12") = YWxpY2U6cGFzczEy`. This is a known security debt. Treat the DB as compromised if ever exposed.

### 5. `DELETE /users/:id` is a soft-delete
Despite the docs saying "deletion is permanent", `deleteUser` sets `active = false` — it does **not** remove the row. Deleted users remain in the DB but cannot log in (the login query filters `WHERE active = true`).

### 6. `GHOST20` coupon is "expired" but still works
`config.js` has `GHOST20: 0.20` (20% off). It was supposed to be removed but finance asked to keep it "just in case." It silently applies to any order that sends `coupon_code: "GHOST20"`.

### 7. Coupon discount applies to the post-qty-discount price
Order: qty discount is calculated first (on raw subtotal), then coupon discount is applied to the already-discounted amount. Stacking order matters.

### 8. `Math.round` vs `floorCents` — never switch them
All monetary math uses `floorCents` (floor, not round). A `Math.round` change in 2019 caused a $0.01 audit discrepancy. The comment in `orderController.js` warns about this explicitly.

### 9. Finance export reads status codes literally
The finance export script greps the DB for the literal characters `P`, `C`, `X`, `R`. **Do not rename or extend status codes without coordinating with the finance team.**

### 10. `order_items` was added in v2 — legacy orders use `items_json`
Old orders (pre-2018) stored line items as a JSON blob in `orders.items_json`. That column no longer exists in the current schema. `old_schema.sql` shows the old shape for reference.

### 11. `formatPhoneE164` in helpers.js is dead code
The SMS notification feature was cancelled in Q3 2020. `formatPhoneE164` and `formatDateDMY` are unused. Ticket OMS-412 is supposed to clean this up.

### 12. `refundOrder` does NOT process payments
Setting status `R` only flags the order in the DB. Actual money movement happens through the external finance portal. The API is just the flag-setter.
