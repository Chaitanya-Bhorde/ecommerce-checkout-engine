const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  cancelOrder,
  validateOrderCreation,
  validateOrderStatus,
} = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authMiddleware');
const { idempotencyMiddleware } = require('../middleware/idempotencyMiddleware');

router.use(protect);

// Admin routes (must be before :id routes)
router.get('/admin/all', admin, getAllOrders);
router.put('/admin/:id/status', admin, validateOrderStatus, updateOrderStatus);

// Customer routes — idempotency only on POST (create)
router.post('/', idempotencyMiddleware, validateOrderCreation, createOrder);
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.put('/:id/cancel', cancelOrder);

module.exports = router;
