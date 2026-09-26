# OMS API — Architecture Reference

> All diagrams reflect the **actual running code**, not the outdated `docs/API_DOCS_v2019.md`.

---

## 1. System Map

High-level view of the OMS API and its external touchpoints.

```mermaid
graph TD
    subgraph Clients
        A["Internal Users and Admin UI"]
        B["Customer-facing App"]
    end

    subgraph OMS_API["OMS API - Node.js Express port 4790"]
        S["server.js"]
        AR["authRoutes"]
        UR["userRoutes"]
        OR["orderRoutes"]
        AC["authController"]
        UC["userController"]
        OC["orderController"]
        DB_CONN["db-connection - pg.Pool"]
        CFG["config.js"]
        LOG["utils-logger"]
        HLP["utils-helpers"]
    end

    subgraph Data
        PG[("PostgreSQL oms_db")]
        MEM[("In-Memory Session Store")]
        FM[("Fake In-Memory Data")]
    end

    subgraph External
        FIN["Finance Cron - nightly at 02:00 on port 4790"]
        PORTAL["Finance Portal - payment reversal"]
        UPTIME["Uptime Monitor - GET health"]
    end

    A -->|"Auth Token header"| S
    B -->|"Auth Token header"| S
    S --> AR & UR & OR
    AR --> AC
    UR --> UC
    OR --> OC
    AC --> MEM
    AC --> DB_CONN
    UC --> DB_CONN
    OC --> DB_CONN
    DB_CONN -->|"connected"| PG
    DB_CONN -->|"unreachable enters FAKE_MODE"| FM
    AC & UC & OC --> LOG
    OC --> HLP
    OC & AC & UC --> CFG
    FIN -->|"reads status P C X R"| PG
    PORTAL -.->|"actual money movement"| OC
    UPTIME -->|"GET health always 200"| S
```

---

## 2. Module Dependency Graph

How source files depend on each other inside the project.

```mermaid
graph LR
    server --> authRoutes
    server --> userRoutes
    server --> orderRoutes
    server --> config
    server --> logger

    authRoutes --> authController
    userRoutes --> userController
    userRoutes --> authController

    orderRoutes --> orderController
    orderRoutes --> authController

    authController --> dbConnection
    authController --> config
    authController --> logger

    userController --> dbConnection
    userController --> logger
    userController --> helpers

    orderController --> dbConnection
    orderController --> config
    orderController --> logger
    orderController --> helpers

    dbConnection --> config
    dbConnection --> logger
```

> **Note:** `authController.js` is imported by both `authRoutes.js` and the other two route files (to access the `requireAuth` middleware). It is a shared cross-cutting dependency.

---

## 3. Order-Create Sequence Diagram

What happens when a client calls `POST /orders`.

```mermaid
sequenceDiagram
    participant Client
    participant Express as Express server
    participant Auth as requireAuth
    participant OC as createOrder
    participant Pricing as calculatePricing
    participant DB as db-connection
    participant PG as PostgreSQL

    Client->>Express: POST orders with Token header and items body

    Express->>Auth: requireAuth middleware
    Auth->>Auth: validateToken checks session map and expiry
    alt token invalid or expired
        Auth-->>Client: 401 invalid or expired token
    end
    Auth->>Express: attach user id username and role to request

    Express->>OC: createOrder
    OC->>OC: validate items array fields
    alt validation fails
        OC-->>Client: 400 items array required or field missing
    end

    OC->>Pricing: calculatePricing items and coupon code
    Note over Pricing: subtotal then qty discount then coupon then shipping then tax
    Pricing-->>OC: pricing breakdown object

    alt FAKE_MODE active
        OC->>DB: push to fakeOrders array
        DB-->>OC: in-memory order not persisted
        OC-->>Client: 201 order with fakeMode true
    else Real DB path
        OC->>DB: pool connect
        DB->>PG: acquire connection from pool
        PG-->>DB: client
        DB-->>OC: client
        OC->>PG: BEGIN transaction
        OC->>PG: INSERT into orders returning id status total
        PG-->>OC: order row with status P
        loop for each item
            OC->>PG: INSERT into order_items
        end
        OC->>PG: COMMIT
        OC->>DB: client release
        OC-->>Client: 201 order with id status total items and pricing
    end
```

---

## 4. Entity-Relationship Diagram

Database schema as inferred from the active queries in the codebase (not from `old_schema.sql`).

```mermaid
erDiagram
    USERS {
        int     id            PK
        varchar username      "UNIQUE NOT NULL"
        text    password_hash "base64 encoded - NOT bcrypt"
        varchar email
        varchar role          "admin or customer"
        boolean active        "false means soft-deleted"
        timestamptz created_at
    }

    ORDERS {
        int     id                     PK
        int     user_id                FK
        char    status                 "P Pending C Completed X Cancelled R Refunded"
        numeric subtotal
        numeric qty_discount_amount
        varchar coupon_code            "nullable added 2018"
        numeric coupon_discount_amount
        numeric discounted_subtotal
        numeric shipping
        numeric tax
        numeric total
        timestamptz created_at
        timestamptz updated_at         "added for 2020 audit"
    }

    ORDER_ITEMS {
        int     id          PK
        int     order_id    FK
        varchar sku
        varchar name
        numeric unit_price
        int     qty
        numeric line_total  "floorCents unit price times qty"
    }

    USERS ||--o{ ORDERS : places
    ORDERS ||--o{ ORDER_ITEMS : contains
```

> **Schema history:** v1 (2017) stored line items as `items_json TEXT` on the `orders` table with no `order_items` table. The `coupon_code` column was added in 2018. `users.active` was added after the "ghost account" incident of 2019. `orders.updated_at` was added for the 2020 audit. Migration files `migration_001.sql` and `migration_002.sql` are referenced in comments but are no longer present in the repo.
