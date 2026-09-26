# OMS API — Starter Tasks for New Developers

> Three safe, self-contained tasks designed to get a new developer productive without touching the
> critical-path pricing engine, auth scheme, or finance integration.  
> Each task includes: what to do, step-by-step, estimated time, and a **TRAP** warning about the
> specific legacy gotcha that has burned people before.

---

## Task 1 — Move Hard-coded Config to Environment Variables

**Why this task:** `config.js` contains a live DB password, a token-signing secret, and a hard-coded
port number committed directly to source control. This is the single highest-risk file in the repo
(Risk: 10/10). Moving these values to environment variables is pure infrastructure hygiene with no
logic changes required.

**Scope:** `oms-api/config.js` and a new `oms-api/.env.example` file.

### Steps

1. **Read `config.js` in full** before touching anything. Note every value and its comment.

2. **Create `oms-api/.env.example`** with placeholder values:
   ```
   DB_URL=postgres://oms_user:YOURPASSWORD@localhost:5432/oms_db
   TOKEN_SALT=replace-with-a-random-32-char-string
   PORT=4790
   LOG_LEVEL=info
   ```

3. **Install `dotenv`** as a dev-only helper (it is already idiomatic in Node):
   ```bash
   cd oms-api && npm install dotenv
   ```

4. **At the very top of `config.js`**, add:
   ```js
   require('dotenv').config();
   ```

5. **Replace hard-coded values** in `config.js` with `process.env` reads:
   ```js
   DB_URL:       process.env.DB_URL       || 'postgres://oms_user:Stagingp%40ss99@staging-db.internal:5432/oms_db',
   TOKEN_SALT:   process.env.TOKEN_SALT   || 'xK9#mL2$nP7@qR4',
   PORT:         parseInt(process.env.PORT, 10) || 4790,
   ```
   Keep the old values as fallbacks so existing deployments are not broken.

6. **Verify** the server still starts and `/health` returns 200:
   ```bash
   npm start
   curl http://localhost:4790/health
   ```

7. **Add `.env` to `.gitignore`** (create the file if it doesn't exist):
   ```
   .env
   ```

8. Open a PR. The diff should touch only `config.js`, `package.json`, `.gitignore`, and the new `.env.example`.

**Estimated time:** 1–2 hours

---

> ### ⚠️ TRAP — The PORT Comment Is Load-Bearing
>
> `config.js` has this comment (repeated in `server.js` too):
> ```
> // DO NOT CHANGE PORT - finance job depends on it (cron @ 02:00 hits :4790)
> ```
> This is not a suggestion. A nightly finance cron job on an external server makes HTTP requests
> directly to port `4790`. **If you change or remove this port — even to a configurable default
> that reads `process.env.PORT || 3000` — and someone sets `PORT=3000` in `.env`, the finance
> job silently stops receiving data.** The fallback value in your `process.env.PORT || 4790` line
> must be `4790`, not any other number. Double-check your `.env.example` documents this constraint
> with a comment.

---

## Task 2 — Add a Role Guard to the Order Status Endpoint

**Why this task:** `PATCH /orders/:id/status` has no role check — any authenticated customer can
call it and change any order to any status (including `R` for Refunded). Every other mutation
endpoint either checks `req.user.role === 'admin'` or verifies ownership. This one was missed.
The fix is a three-line addition and teaches you the auth/role pattern used throughout the codebase.

**Scope:** `oms-api/controllers/orderController.js` (one function).

### Steps

1. **Read `updateStatus` in `orderController.js`** (lines 256–285). Notice it has no role check at all.

2. **Read `updateUser` in `userController.js`** for the pattern used elsewhere:
   ```js
   if (req.user.role !== 'admin' && req.user.userId !== id) {
     return res.status(403).json({ error: 'forbidden' });
   }
   ```

3. **Decide on the right policy.** Looking at the other order endpoints:
   - Customers can *view* their own orders.
   - There is no precedent for customers changing order status.
   - Status changes (completing, cancelling, refunding) are operational actions.
   - **Correct policy:** admin-only for status changes.

4. **Add the guard** as the first statement inside `updateStatus`, right after the `id` and `status`
   are parsed, before the `validStatuses` check:
   ```js
   if (req.user.role !== 'admin') {
     return res.status(403).json({ error: 'admin only' });
   }
   ```

5. **Test manually** in FAKE_MODE (no DB needed):
   - Log in as `alice` (customer) → try `PATCH /orders/1/status` → expect **403**.
   - Log in as `admin` → try the same → expect **200** or **404**.

   ```bash
   # get alice token
   ALICE=$(curl -s -X POST http://localhost:4790/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"alice","password":"pass12"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

   curl -s -X PATCH http://localhost:4790/orders/1/status \
     -H "Authorization: Token $ALICE" \
     -H "Content-Type: application/json" \
     -d '{"status":"C"}'
   # Expected: {"error":"admin only"}
   ```

6. Open a PR. Diff should be 3–4 lines in `orderController.js` only.

**Estimated time:** 30–60 minutes

---

> ### ⚠️ TRAP — The Old Docs Say Basic Auth; The Code Requires Token Auth
>
> `docs/API_DOCS_v2019.md` documents authentication as:
> ```
> Authorization: Basic YWRtaW46c2VjcmV0
> ```
> **This is wrong.** The running code in `authController.requireAuth` checks for:
> ```
> Authorization: Token <token>
> ```
> Any curl command you copy from the docs will get a `401 missing or malformed token`.
> You must log in first (`POST /auth/login`), capture the `token` from the response, and
> send `Authorization: Token <that-token>` on every subsequent request.
>
> Also: fake-mode stub users have specific base64 passwords.  
> `admin` password → decode `YWRtaW46c2VjcmV0` → `admin:secret`  
> `alice` password → decode `YWxpY2U6cGFzczEy` → `alice:pass12`

---

## Task 3 — Clean Up Dead Code in `helpers.js`

**Why this task:** `helpers.js` exports two dead symbols — `formatPhoneE164` (SMS feature cancelled
Q3 2020, ticket OMS-412) and `formatDateDMY` (for an invoice PDF generator that was never shipped).
They are imported by nothing, they are tested by nothing, and their own comments say to remove them.
Cleaning them up reduces surface area and prevents a future developer from accidentally reaching for
`formatDateDMY` instead of `formatDateYMD` and getting dates in the wrong format silently.

**Scope:** `oms-api/utils/helpers.js` only.

### Steps

1. **Verify `formatPhoneE164` is not imported anywhere:**
   ```bash
   grep -r "formatPhoneE164" oms-api/ --include="*.js" --exclude-dir=node_modules
   # Expected: only utils/helpers.js itself
   ```

2. **Verify `formatDateDMY` is not imported anywhere:**
   ```bash
   grep -r "formatDateDMY" oms-api/ --include="*.js" --exclude-dir=node_modules
   # Expected: only utils/helpers.js itself
   ```

3. **Check OMS-412 ticket status** (ask a team member or check your issue tracker). If the ticket
   is still open but unblocked, this is fine to proceed — the ticket is just the tracking vehicle.

4. **Delete the `formatPhoneE164` function** (lines 54–59) and its JSDoc block above it.

5. **Delete the `formatDateDMY` function** (lines 23–29) and its JSDoc block above it.

6. **Remove both from the `module.exports` object** at the bottom of the file.

7. **Verify the remaining exports still work:**
   ```bash
   node -e "const h = require('./oms-api/utils/helpers'); console.log(h.floorCents(9.999), h.formatDateYMD(new Date()));"
   # Expected: 9.99 followed by today's date in YYYY-MM-DD format
   ```

8. **Start the server and smoke-test** to confirm nothing broke:
   ```bash
   npm start
   curl http://localhost:4790/health
   ```

9. Open a PR. Diff should be deletions only in `helpers.js`.

**Estimated time:** 30–45 minutes

---

> ### ⚠️ TRAP — "Removing it broke something once"
>
> The comment on `formatDateDMY` says:
> ```
> // NOTE: this is a duplicate of formatDateYMD but in a different format.
> // Was added by someone for the invoice PDF generator but that feature
> // was never shipped. Kept because removing it broke something once.
> ```
> **"Broke something once" almost certainly means a merge conflict, not a runtime error** —
> it was not being called by anything. But before you delete it: run the two grep commands in
> Step 1 and Step 2 above. If either returns a result outside `helpers.js` itself, stop and
> investigate that import before deleting. Do not trust the comments alone; verify with grep.
>
> Similarly, `formatPhoneE164` is JSDoc-tagged `@deprecated` and its ticket (OMS-412) is open.
> Deleting the function does not close the ticket; close it manually after the PR merges.
