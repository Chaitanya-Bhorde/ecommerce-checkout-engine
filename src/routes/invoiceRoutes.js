const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Order = require('../models/Order');
const { generateInvoicePDF } = require('../services/invoiceService');

// @route   GET /api/invoice/:orderId
// @desc    Download invoice as PDF
// @access  Private
router.get('/:orderId', protect, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user._id,
    }).populate('items.product', 'name price images');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const pdfBuffer = await generateInvoicePDF(order);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order._id.toString().slice(-10)}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;