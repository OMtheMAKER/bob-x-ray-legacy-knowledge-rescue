// routes/orderRoutes.js
const express          = require('express');
const router           = express.Router();
const orderController  = require('../controllers/orderController');
const { requireAuth }  = require('../controllers/authController');

// GET  /orders           - list orders (filtered by user unless admin)
router.get('/',      requireAuth, orderController.listOrders);

// GET  /orders/:id       - get single order with line items
router.get('/:id',   requireAuth, orderController.getOrder);

// POST /orders           - create new order (runs pricing engine)
router.post('/',     requireAuth, orderController.createOrder);

// PATCH /orders/:id/status - update order status (P/C/X/R)
router.patch('/:id/status', requireAuth, orderController.updateStatus);

// POST /orders/:id/refund  - trigger refund flow (sets status to R)
router.post('/:id/refund',  requireAuth, orderController.refundOrder);

module.exports = router;
