// controllers/orderController.js
// Tiered pricing engine + order lifecycle management.
// This file does too much. It was supposed to be split into a PricingService
// but that never happened. Don't add more logic here - file is already 300+ lines.
// written fast in 2017, pricing logic added 2018

const db      = require('../db/connection');
const config  = require('../config');
const logger  = require('../utils/logger');
const { floorCents, formatDateYMD } = require('../utils/helpers');

// ─── Pricing Engine ────────────────────────────────────────────────────────────
// All monetary values are floored (penny round-down) per finance spec v1.2.
// DO NOT switch to Math.round - it caused a $0.01 discrepancy in the 2019 audit.

/**
 * Qty-based discount tiers.
 * Thresholds are INCLUSIVE lower bounds.
 * e.g. 10-24 units => 5% off, 25-49 => 10% off, 50+ => 15% off.
 */
const QTY_DISCOUNT_TIERS = [
  { minQty: 50, discount: 0.15 },
  { minQty: 25, discount: 0.10 },
  { minQty: 10, discount: 0.05 }
  // < 10 units: no discount
];

/**
 * Returns the quantity discount rate for a given total item count.
 */
function _getQtyDiscount(totalQty) {
  for (const tier of QTY_DISCOUNT_TIERS) {
    if (totalQty >= tier.minQty) return tier.discount;
  }
  return 0;
}

/**
 * Returns the coupon discount rate for a given coupon code.
 * Returns 0 for unknown / expired coupons (silent fail - don't leak coupon validity).
 * GHOST20 is "expired" but still active in config - see config.js comment.
 */
function _getCouponDiscount(couponCode) {
  if (!couponCode) return 0;
  const rate = config.COUPONS[couponCode.toUpperCase()];
  return rate !== undefined ? rate : 0;
}

/**
 * Core pricing engine.
 *
 * Input:  items = [{ sku, name, unit_price, qty }]
 *         couponCode (optional string)
 *
 * Pipeline:
 *   1. subtotal       = sum(unit_price * qty) for all items
 *   2. qtyDiscount    = subtotal * _getQtyDiscount(totalQty)   [applied first]
 *   3. couponDiscount = (subtotal - qtyDiscount) * couponRate  [applied to discounted price]
 *   4. discountedSubtotal = subtotal - qtyDiscount - couponDiscount
 *   5. shipping       = FLAT_RATE unless discountedSubtotal >= FREE_OVER threshold
 *   6. tax            = discountedSubtotal * TAX_RATE
 *   7. total          = discountedSubtotal + shipping + tax
 *   All values floor-rounded to cents.
 *
 * Returns a pricing breakdown object attached to the order.
 */
function calculatePricing(items, couponCode) {
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);

  // step 1: raw subtotal
  const subtotal = floorCents(
    items.reduce((sum, item) => sum + item.unit_price * item.qty, 0)
  );

  // step 2: qty discount (on raw subtotal)
  const qtyDiscountRate   = _getQtyDiscount(totalQty);
  const qtyDiscountAmount = floorCents(subtotal * qtyDiscountRate);

  // step 3: coupon discount (on post-qty-discount price)
  const couponDiscountRate   = _getCouponDiscount(couponCode);
  const couponDiscountAmount = floorCents((subtotal - qtyDiscountAmount) * couponDiscountRate);

  // step 4: discounted subtotal
  const discountedSubtotal = floorCents(subtotal - qtyDiscountAmount - couponDiscountAmount);

  // step 5: shipping
  const shipping = discountedSubtotal >= config.SHIPPING.FREE_OVER
    ? 0
    : config.SHIPPING.FLAT;

  // step 6: tax (on discounted subtotal only, shipping is tax-free per spec)
  const tax = floorCents(discountedSubtotal * config.TAX_RATE);

  // step 7: grand total
  const total = floorCents(discountedSubtotal + shipping + tax);

  return {
    subtotal,
    qty_discount_rate:    qtyDiscountRate,
    qty_discount_amount:  qtyDiscountAmount,
    coupon_code:          couponCode || null,
    coupon_discount_rate: couponDiscountRate,
    coupon_discount_amount: couponDiscountAmount,
    discounted_subtotal:  discountedSubtotal,
    shipping,
    tax_rate:             config.TAX_RATE,
    tax,
    total
  };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function listOrders(req, res) {
  try {
    const isAdmin = req.user.role === 'admin';
    if (db.isFakeMode()) {
      let orders = db._fakeOrders;
      if (!isAdmin) orders = orders.filter(o => o.user_id === req.user.userId);
      return res.json({ orders, fakeMode: true });
    }
    const sql = isAdmin
      ? 'SELECT id, user_id, status, total, created_at FROM orders ORDER BY created_at DESC LIMIT 100'
      : 'SELECT id, user_id, status, total, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100';
    const params = isAdmin ? [] : [req.user.userId];
    const result = await db.query(sql, params);
    return res.json({ orders: result.rows });
  } catch (err) {
    logger.error('listOrders: ' + err.message);
    return res.status(500).json({ error: 'internal server error' });
  }
}

async function getOrder(req, res) {
  const id = parseInt(req.params.id, 10);
  try {
    if (db.isFakeMode()) {
      const order = db._fakeOrders.find(o => o.id === id);
      if (!order) return res.status(404).json({ error: 'order not found' });
      if (req.user.role !== 'admin' && order.user_id !== req.user.userId) {
        return res.status(403).json({ error: 'forbidden' });
      }
      return res.json({ order, fakeMode: true });
    }

    const orderResult = await db.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );
    if (orderResult.rows.length === 0) return res.status(404).json({ error: 'order not found' });
    const order = orderResult.rows[0];

    if (req.user.role !== 'admin' && order.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const itemsResult = await db.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [id]
    );
    order.items = itemsResult.rows;
    return res.json({ order });
  } catch (err) {
    logger.error('getOrder: ' + err.message);
    return res.status(500).json({ error: 'internal server error' });
  }
}

async function createOrder(req, res) {
  const { items, coupon_code } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }
  // validate each item has required fields
  for (const item of items) {
    if (!item.sku || !item.name || item.unit_price == null || !item.qty) {
      return res.status(400).json({ error: 'each item needs sku, name, unit_price, qty' });
    }
  }

  const pricing = calculatePricing(items, coupon_code);
  logger.info(`Order pricing: subtotal=${pricing.subtotal} total=${pricing.total} coupon=${pricing.coupon_code}`);

  try {
    if (db.isFakeMode()) {
      const newOrder = {
        id:         db._fakeOrders.length + 1,
        user_id:    req.user.userId,
        status:     config.ORDER_STATUS.PENDING,   // 'P'
        items,
        pricing,
        coupon_code: coupon_code || null,
        created_at: new Date().toISOString(),
        ...pricing
      };
      db._fakeOrders.push(newOrder);
      return res.status(201).json({ order: newOrder, fakeMode: true });
    }

    // real DB path - use a transaction so order + items are atomic
    const client = db.pool()
      ? await db.pool().connect()
      : null;

    if (!client) {
      return res.status(500).json({ error: 'database unavailable' });
    }

    try {
      await client.query('BEGIN');
      const orderInsert = await client.query(
        `INSERT INTO orders
           (user_id, status, subtotal, qty_discount_amount, coupon_code,
            coupon_discount_amount, discounted_subtotal, shipping, tax, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id, status, total, created_at`,
        [
          req.user.userId,
          config.ORDER_STATUS.PENDING,
          pricing.subtotal,
          pricing.qty_discount_amount,
          pricing.coupon_code,
          pricing.coupon_discount_amount,
          pricing.discounted_subtotal,
          pricing.shipping,
          pricing.tax,
          pricing.total
        ]
      );
      const order = orderInsert.rows[0];

      for (const item of items) {
        await client.query(
          'INSERT INTO order_items (order_id, sku, name, unit_price, qty, line_total) VALUES ($1,$2,$3,$4,$5,$6)',
          [order.id, item.sku, item.name, item.unit_price, item.qty, floorCents(item.unit_price * item.qty)]
        );
      }

      await client.query('COMMIT');
      order.items   = items;
      order.pricing = pricing;
      return res.status(201).json({ order });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('createOrder: ' + err.message);
    return res.status(500).json({ error: 'internal server error' });
  }
}

async function updateStatus(req, res) {
  const id     = parseInt(req.params.id, 10);
  const { status } = req.body;

  // validate against known status codes: P, C, X, R
  const validStatuses = Object.values(config.ORDER_STATUS);
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${validStatuses.join(', ')} (P=pending,C=completed,X=cancelled,R=refunded)`
    });
  }

  try {
    if (db.isFakeMode()) {
      const order = db._fakeOrders.find(o => o.id === id);
      if (!order) return res.status(404).json({ error: 'order not found' });
      order.status = status;
      return res.json({ order, fakeMode: true });
    }
    const result = await db.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status, updated_at',
      [status, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'order not found' });
    return res.json({ order: result.rows[0] });
  } catch (err) {
    logger.error('updateStatus: ' + err.message);
    return res.status(500).json({ error: 'internal server error' });
  }
}

async function refundOrder(req, res) {
  const id = parseInt(req.params.id, 10);
  // refund = set status to R (REFUNDED)
  // no actual payment reversal here - that goes through the finance portal
  // this just flags it in the DB so the export picks it up
  logger.info(`Refund requested for order ${id} by user ${req.user.username}`);

  try {
    if (db.isFakeMode()) {
      const order = db._fakeOrders.find(o => o.id === id);
      if (!order) return res.status(404).json({ error: 'order not found' });
      if (order.status === config.ORDER_STATUS.REFUNDED) {
        return res.status(409).json({ error: 'order already refunded' });
      }
      order.status = config.ORDER_STATUS.REFUNDED;   // 'R'
      return res.json({ message: 'order marked as refunded', order, fakeMode: true });
    }
    const current = await db.query('SELECT status FROM orders WHERE id = $1', [id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'order not found' });
    if (current.rows[0].status === config.ORDER_STATUS.REFUNDED) {
      return res.status(409).json({ error: 'order already refunded' });
    }
    const result = await db.query(
      "UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status, updated_at",
      [config.ORDER_STATUS.REFUNDED, id]
    );
    return res.json({ message: 'order marked as refunded', order: result.rows[0] });
  } catch (err) {
    logger.error('refundOrder: ' + err.message);
    return res.status(500).json({ error: 'internal server error' });
  }
}

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  updateStatus,
  refundOrder,
  // exported for unit tests
  calculatePricing,
  _getQtyDiscount,
  _getCouponDiscount
};
