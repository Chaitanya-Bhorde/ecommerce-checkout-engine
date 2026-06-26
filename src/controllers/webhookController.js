const mongoose = require('mongoose');
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

    // RULE 1: Acknowledge Razorpay IMMEDIATELY — within < 2 seconds
    // Prevents Razorpay from retrying the webhook for 24 hours
    res.status(200).json({ status: 'received' });

    // RULE 2: Process heavy business logic asynchronously in background
    // Uses setImmediate — not setTimeout. Guarantees execution after I/O callbacks
    setImmediate(async () => {
      const session = await mongoose.startSession();

      try {
        switch (event) {
          case 'payment.captured': {
            const payment = eventPayload.payment.entity;
            const razorpayOrderId = payment.order_id;
            const razorpayPaymentId = payment.id;

            // RULE 3: ACID Transaction — Order + Ledger both succeed or both fail
            // Prevents unreconciled financial state (Bug #2 fix)
          await session.withTransaction(async () => {
              // ATOMIC idempotency: findOneAndUpdate with status check
              // If already confirmed, returns null — no duplicate processing
              const order = await Order.findOneAndUpdate(
                {
                  'payment.razorpayOrderId': razorpayOrderId,
                  status: { $ne: 'confirmed' },
                },
                {
                  $set: {
                    'payment.razorpayPaymentId': razorpayPaymentId,
                    'payment.paidAt': new Date(),
                    status: 'confirmed',
                  },
                  $push: {
                    statusHistory: {
                      status: 'confirmed',
                      changedAt: new Date(),
                      note: 'Payment captured securely via Razorpay Webhook',
                    },
                  },
                },
                { new: true, session }
              );

              if (!order) {
                return; // Already processed — idempotent
              }

              await Ledger.findOneAndUpdate(
                { razorpayOrderId },
                {
                  razorpayPaymentId,
                  status: 'completed',
                },
                { session }
              );
            });

            break;
          }

          case 'payment.failed': {
            const failedPayment = eventPayload.payment.entity;
            const failedOrderId = failedPayment.order_id;

            await Ledger.findOneAndUpdate(
              { razorpayOrderId: failedOrderId },
              {
                status: 'failed',
                description: `Payment failed: ${failedPayment.error_description || 'Unknown error'}`,
              }
            );

            break;
          }

          default:
            break;
        }
      } catch (bgError) {
        console.error('CRITICAL: Background webhook processing error:', bgError.message);
      } finally {
        await session.endSession();
      }
    });
  } catch (error) {
    console.error('Webhook structural error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal Server Error' });
    }
  }
};

module.exports = { handleRazorpayWebhook };