const express = require('express');
const router = express.Router();
const {
  createPaymentOrder,
  verifyPayment,
  getPaymentStatus,
  getLedgerEntries,
  getAllLedgerEntries,
} = require('../controllers/paymentController');
const { protect, admin } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/create', createPaymentOrder);
router.post('/create/:orderId', createPaymentOrder);
router.post('/verify', verifyPayment);
router.get('/status/:orderId', getPaymentStatus);
router.get('/ledger', getLedgerEntries);
router.get('/ledger/all', admin, getAllLedgerEntries);

module.exports = router;