const crypto = require('crypto');
const Order = require('../models/Order');
const Ledger = require('../models/Ledger');
const { verifyWebhookSignature } = require('../config/razorpay');

const handleRazorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    if (!signature) {
      return res.status(400).json({ message: 'Missing webhook signature' });
    }

    const rawBody = req.body.toString();
    const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const eventPayload = payload.payload;

    switch (event) {
      case 'payment.captured': {
        const payment = eventPayload.payment.entity;
        const razorpayOrderId = payment.order_id;
        const razorpayPaymentId = payment.id;

        const order = await Order.findOne({ 'payment.paymentId': razorpayOrderId });
        if (!order) {
          return res.status(200).json({ status: 'ignored', message: 'Order not found' });
        }

        if (order.status === 'confirmed') {
          return res.status(200).json({ status: 'already_processed' });
        }

        order.payment.paymentId = razorpayPaymentId;
        order.payment.paidAt = new Date();
        order.status = 'confirmed';
        order.statusHistory.push({
          status: 'confirmed',
          changedAt: new Date(),
          note: 'Payment captured via webhook',
        });
        await order.save();

        await Ledger.findOneAndUpdate(
          { razorpayOrderId },
          {
            razorpayPaymentId,
            status: 'completed',
          }
        );

        break;
      }

      case 'payment.failed': {
        const failedPayment = eventPayload.payment.entity;
        const failedOrderId = failedPayment.order_id;

        await Ledger.findOneAndUpdate(
          { razorpayOrderId: failedOrderId },
          { status: 'failed', description: `Payment failed: ${failedPayment.error_description || 'Unknown error'}` }
        );

        break;
      }

      case 'order.paid': {
        const paidOrder = eventPayload.order.entity;
        const paidRazorpayOrderId = paidOrder.id;

        const existingOrder = await Order.findOne({ 'payment.paymentId': paidRazorpayOrderId });
        if (existingOrder && existingOrder.status === 'pending') {
          existingOrder.status = 'confirmed';
          existingOrder.statusHistory.push({
            status: 'confirmed',
            changedAt: new Date(),
            note: 'Order marked as paid via webhook',
          });
          await existingOrder.save();
        }

        break;
      }

      default:
        break;
    }

    res.status(200).json({ status: 'received' });
  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(200).json({ status: 'error', message: error.message });
  }
};

module.exports = { handleRazorpayWebhook };