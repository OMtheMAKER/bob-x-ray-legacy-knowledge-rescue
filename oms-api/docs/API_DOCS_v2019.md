# OMS API Documentation

**Version:** 2019-03  
**Status:** CURRENT  
**Base URL:** `http://oms-internal.company.net/v1`

> This document describes the Order Management System REST API.  
> For questions contact the backend team (originally: dave@company.net).

---

## Authentication

All endpoints (except `/v1/auth/login`) require HTTP **Basic Authentication**.

Include a `Authorization: Basic <base64(username:password)>` header with every request.

Example:
```
Authorization: Basic YWRtaW46c2VjcmV0
```

Token TTL is 24 hours. After expiry, re-authenticate.

---

## Endpoints

### Auth

#### POST /v1/auth/login

Authenticate and receive a session cookie.

**Request body (JSON):**
```json
{
  "username": "alice",
  "password": "mypassword"
}
```

**Response 200:**
```json
{
  "session_id": "abc123",
  "expires": "2019-03-15T10:00:00Z"
}
```

---

### Users

#### GET /v1/users

Returns a list of all users. Admin only.

**Response 200:**
```json
{
  "users": [
    { "id": 1, "username": "admin", "role": "admin" },
    { "id": 2, "username": "alice", "role": "customer" }
  ]
}
```

#### GET /v1/users/:id

Returns a single user.

#### POST /v1/users

Create a new user. Admin only.

**Request body:**
```json
{
  "username": "bob",
  "password": "secret",
  "email": "bob@example.com",
  "role": "customer"
}
```

#### DELETE /v1/users/:id

Permanently deletes a user record.

> **Note:** Deletion is permanent. There is no soft-delete.

---

### Orders

#### GET /v1/orders

Returns orders. Admins see all orders; customers see only their own.

**Query params:**
- `user_id` (admin only) – filter by user

#### GET /v1/orders/:id

Returns a single order with line items embedded in `items_json` field.

#### POST /v1/orders

Creates a new order. Pricing is calculated server-side.

**Request body:**
```json
{
  "items": [
    { "sku": "WIDGET-01", "name": "Blue Widget", "unit_price": 9.99, "qty": 3 }
  ]
}
```

**No coupon support** – coupon codes are not yet implemented as of this version.

**Response 201:**
```json
{
  "order": {
    "id": 42,
    "status": "P",
    "subtotal": 29.97,
    "tax": 5.39,
    "shipping": 5.99,
    "total": 41.35
  }
}
```

#### POST /v1/orders/:id/cancel

Cancels a pending order. Sets `status` to `X`.

> **Note:** There is no refund endpoint in v1. Refunds are handled manually
> by the finance team via the admin portal.

---

## Order Status Codes

| Code | Meaning  |
|------|----------|
| P    | Pending  |
| C    | Completed|
| X    | Cancelled|

---

## Error Responses

All errors return JSON with an `error` field:

```json
{ "error": "not found" }
```

Standard HTTP status codes are used (400, 401, 403, 404, 500).

---

## Known Limitations (as of 2019-03)

- No pagination on list endpoints
- No webhook support
- Coupon codes not yet implemented
- Refund flow is manual
- Rate limiting is handled at the nginx layer, not in the API

---

*Last updated: 2019-03-12 by Dave*
