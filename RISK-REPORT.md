# OMS API — Risk Report

> Scores are **1 (low risk) → 10 (critical risk)**.  
> Risk is measured as: likelihood of breakage × blast radius × knowledge concentration.

---

## File-by-File Risk Scores

### `oms-api/config.js` — Risk: **10 / 10**

| Dimension | Finding |
|---|---|
| **Secrets in source** | `DB_URL` contains a live staging password (`Stagingp%40ss99`). `TOKEN_SALT` is hard-coded. Both are committed to version control. |
| **No env var support** | There is no `dotenv` or `process.env` fallback. Rotating any secret requires a code change and a deploy. |
| **Finance blast radius** | Port `4790` is hard-coded here. The comment warns it three separate times. A thoughtless search-and-replace could silently break the nightly finance cron job. |
| **Coupon leakage** | `GHOST20` is documented as "expired" but is fully active at 20% off. Any user who discovers the code gets a valid discount. |
| **Token TTL misconception** | The old docs say 24 hours; config says 72. An ops team reading stale docs will expect tokens to expire sooner than they do. |

---

### `oms-api/controllers/authController.js` — Risk: **9 / 10**

| Dimension | Finding |
|---|---|
| **Weak password hashing** | `base64(username:password)` is trivially reversible — it is encoding, not hashing. Anyone with DB read access has every user's plaintext password. |
| **Weak token scheme** | Token is `base64(id:username:timestamp).<16-char-sha256-prefix>`. The payload is not signed with HMAC; only a 16-char checksum is appended. Collisions or forgery risk is non-trivial. |
| **In-memory session store** | `_sessions = {}` lives in process memory. Every server restart logs out all users. No horizontal scaling is possible without session loss. |
| **Auth header mismatch** | The header format required by the code (`Token <token>`) differs from the docs (`Basic <base64>`). New developers using the docs will get 401s and lose time debugging. |
| **Logout is client-driven only** | If a token is stolen and the legitimate user logs out, the attacker's copy of the token remains valid until TTL expiry (up to 72 hours). |

---

### `oms-api/controllers/orderController.js` — Risk: **8 / 10**

| Dimension | Finding |
|---|---|
| **God object** | File is 330 lines, contains the pricing engine, all order handlers, and coupon logic. The comment at line 4 says a `PricingService` split was planned but never done. |
| **Pricing pipeline complexity** | The 7-step `calculatePricing()` pipeline has subtle ordering rules (qty discount before coupon; coupon on post-qty price; `floorCents` at every step). Any modification risks silently altering totals. |
| **`floorCents` is load-bearing** | Switching to `Math.round` caused a $0.01 audit discrepancy in 2019. This trap is not obvious from reading the code alone. |
| **No status-transition guard** | `updateStatus` allows arbitrary transitions (e.g. moving a `REFUNDED` order back to `PENDING`). There is no state-machine enforcement. |
| **Refund does not gate on status** | `refundOrder` checks for double-refund but does not check if the order is in a refundable state (e.g. it will happily refund a `CANCELLED` order). |
| **`PATCH /orders/:id/status` is admin-unguarded** | Any authenticated user (customer role) can call this endpoint and change order status. There is no role check in `updateStatus`. |

---

### `oms-api/controllers/userController.js` — Risk: **6 / 10**

| Dimension | Finding |
|---|---|
| **Soft-delete mismatch with docs** | `DELETE /users/:id` sets `active = false` but the old docs say "deletion is permanent." A consumer relying on docs who expects the row to be gone will get confused. |
| **Inline role checks** | Admin checks are done per-handler with `if (req.user.role !== 'admin')` rather than via middleware. If a new route is added without copying the guard, it will be wide open. |
| **Only `email` is patchable** | `updateUser` silently ignores all fields except `email`. A caller sending `{"role":"admin"}` will get a 200 but no role change — silent data loss. |
| **Password stored on create** | `createUser` also uses `base64(username:password)`, propagating the weak-hash pattern to any new users. |

---

### `oms-api/db/connection.js` — Risk: **8 / 10**

| Dimension | Finding |
|---|---|
| **Silent FAKE_MODE activation** | A pool error at runtime (not just startup) triggers `FAKE_MODE = true` with a `logger.warn`. In a noisy log environment this is easy to miss. Writes silently succeed but are lost. |
| **FAKE_MODE activated in staging** | The comment explicitly records that this happened once. No alerting mechanism prevents recurrence. |
| **No reconnect logic** | Once `FAKE_MODE` is true, it stays true for the process lifetime. A transient DB blip permanently degrades the instance until restart. |
| **Raw pool exposed** | `pool()` is exported for transaction use. Callers must manually check `isFakeMode()` first — nothing enforces this. Missing the check in a new endpoint will cause a null-pointer crash. |

---

### `oms-api/server.js` — Risk: **3 / 10**

| Dimension | Finding |
|---|---|
| **`/health` always 200** | The health check intentionally ignores DB state ("monitoring contract"). An instance in FAKE_MODE will appear healthy to the uptime monitor. |
| **No rate limiting in application** | Rate limiting is offloaded to nginx. If the API is hit directly (bypassing nginx), it is unprotected. |
| **Version hardcoded** | `ver: '2.3.1'` in `/status` is a string literal, not sourced from `package.json`. It will drift silently. |

---

### `oms-api/utils/helpers.js` — Risk: **4 / 10**

| Dimension | Finding |
|---|---|
| **Dead code exported** | `formatPhoneE164` and `formatDateDMY` are exported and documented as dead. Future callers could import and use them, especially `formatDateDMY` which superficially resembles `formatDateYMD`. |
| **`floorCents` is finance-critical** | Simple function, but changing it or the call sites is a P0 finance risk (see `orderController.js` risk). |
| **`deepClone` silently drops Dates** | `JSON.parse(JSON.stringify(...))` converts `Date` objects to strings. If the data shape ever includes Dates, clones will be broken strings. |

---

### `oms-api/utils/logger.js` — Risk: **2 / 10**

| Dimension | Finding |
|---|---|
| **No structured logging** | Log lines are freeform strings, not JSON. Machine parsing (e.g. for log aggregators) is fragile. |
| **No log rotation / shipping** | Logs go to stdout/stderr only. There is no file sink, rotation, or shipping to a log aggregator. |

---

### `oms-api/docs/API_DOCS_v2019.md` — Risk: **7 / 10**

This file is not runtime code, but it is a **knowledge landmine**.

| Lie in the docs | Reality in the code |
|---|---|
| Auth uses `Authorization: Basic <base64>` | Auth uses `Authorization: Token <token>` |
| Token TTL is 24 hours | Token TTL is **72 hours** |
| `DELETE /users/:id` permanently deletes | It is a **soft-delete** (`active = false`) |
| No coupon support | `LAUNCH50` (50%) and `GHOST20` (20%) are live |
| No refund endpoint | `POST /orders/:id/refund` exists |
| Orders return `items_json` field | Current schema uses `order_items` table |
| Status codes: P / C / X only | Status code **R** (Refunded) also exists |

**Anyone using these docs to write an integration will be wrong in multiple ways.**

---

### `oms-api/legacy/old_schema.sql` — Risk: **3 / 10**

Low runtime risk (never executed), but a knowledge risk: a developer who reads it to understand the schema will have a wrong mental model. The columns `items_json`, `password_b64`, missing `active`, missing `updated_at`, and missing `coupon_code` are all gone from the live schema.

---

## Bus Factor Assessment

> **Bus factor = N** means: if N people leave, critical knowledge is lost.

| Area | Bus Factor | Notes |
|---|---|---|
| **Pricing engine logic** | **1** | `calculatePricing()` and the `floorCents` requirement exist only in `orderController.js` comments and one stale comment in `helpers.js`. No tests. |
| **Finance cron integration** | **1** | The only documentation is `# DO NOT CHANGE PORT` comments scattered across three files. The cron script itself is not in this repo. |
| **Token auth scheme** | **1** | The custom token format is documented only in comments. No external spec. |
| **Migration history** | **0** | `migration_001.sql` and `migration_002.sql` are referenced in `old_schema.sql` comments but do not exist in the repo. Schema evolution is unrecoverable from source. |
| **GHOST20 coupon** | **1** | The decision to keep it is recorded only in a `config.js` comment: "finance said keep it just in case." |
| **Overall project** | **~1–2** | The project was written fast in 2017 by what appears to be a single original author. Key decisions are embedded in inline comments with no separate ADR or wiki. |

---

## Top Knowledge Landmines

1. **FAKE_MODE silent activation** — the server looks healthy, orders appear to succeed, nothing is saved.
2. **`Authorization: Token` vs `Basic`** — the docs confidently describe the wrong auth format.
3. **`floorCents` is not negotiable** — switching to rounding breaks financial audits.
4. **Soft-delete is invisible to callers** — `DELETE` returns 200 but the user record stays.
5. **`PATCH /orders/:id/status` has no role guard** — customers can change any order status.
6. **Lost migrations** — the live DB schema cannot be reconstructed from files in the repo.
7. **Port 4790 is external-dependency-locked** — changing it silently breaks the finance cron.

---

## Quick Wins (Low Risk, High Value)

| Win | File | Effort |
|---|---|---|
| Move `DB_URL`, `TOKEN_SALT`, `PORT` to `.env` / `process.env` | `config.js` | ~1 hour |
| Add a role guard to `PATCH /orders/:id/status` | `orderController.js` / `orderRoutes.js` | ~30 min |
| Delete the three confirmed dead exports in `helpers.js` (after confirming OMS-412) | `helpers.js` | ~15 min |
| Add a `fakeMode: false` warning to the `/status` endpoint when `db.isFakeMode()` is true | `server.js` + `db/connection.js` | ~30 min |
| Write down the current live schema in a `schema.sql` (replacing the outdated `old_schema.sql`) | New file | ~1 hour |
| Update or delete `docs/API_DOCS_v2019.md` — it is actively misleading | `docs/` | ~1 hour |
