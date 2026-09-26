-- legacy/old_schema.sql
-- Original schema from 2017 launch. DO NOT run this against any live database.
-- Kept for historical reference - the current schema has diverged significantly.
-- Notable differences from current:
--   - orders.coupon_code column was added in 2018 (not here)
--   - users.active column was added after the "ghost account" incident of 2019
--   - order_items table did not exist in v1 - line items were stored as JSON in orders.items_json
--   - no updated_at column on orders (added after the 2020 audit requirement)
--   - password_hash was called password_b64 originally (renamed, see migration_002.sql - now lost)

CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(64) NOT NULL UNIQUE,
    password_b64  TEXT        NOT NULL,   -- base64(username:password), NOT bcrypt
    email         VARCHAR(255),
    role          VARCHAR(16) NOT NULL DEFAULT 'customer',  -- 'admin' or 'customer'
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- v1 orders table - items stored as raw JSON blob (bad idea, replaced in v2)
CREATE TABLE orders (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    items_json   TEXT    NOT NULL,   -- JSON array, no schema validation
    subtotal     NUMERIC(10,2) NOT NULL,
    tax          NUMERIC(10,2) NOT NULL,
    shipping     NUMERIC(10,2) NOT NULL DEFAULT 5.99,
    total        NUMERIC(10,2) NOT NULL,
    status       CHAR(1) NOT NULL DEFAULT 'P',  -- P/C/X (R=refunded added later)
    created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- index added after slow query complaints in Q1 2018
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status  ON orders(status);

-- seed admin user (password = admin:secret123 in base64)
-- base64('admin:secret123') = YWRtaW46c2VjcmV0MTIz
INSERT INTO users (username, password_b64, email, role)
VALUES ('admin', 'YWRtaW46c2VjcmV0MTIz', 'admin@internal', 'admin');
