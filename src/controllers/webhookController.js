const mongoose = require('mongoose');
const Order = require('../models/Order');
const Ledger = require('../models/Ledger');
const { verifyWebhookSignature } = require('../config/razorpay');

const handleRazorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET is not configured — rejecting webhook');
      return res.status(500).json({ message: 'Webhook not configured' });
    }

    if (!signature) {
      return res.status(400).json({ message: 'Missing webhook signature' });
    }

    // The webhook route is mounted with express.raw(), so req.body is a Buffer.
    // Guard against misconfiguration: if a JSON parser ever ran first, fall back
    // to the stashed rawBody and reject when neither is available.
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : (req.rawBody ? req.rawBody.toString('utf8') : null);
    if (!rawBody) {
      return res.status(400).json({ message: 'Webhook body must be raw JSON' });
    }
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
                console.warn(
                  `payment.captured for unknown or already-confirmed order (razorpayOrderId: ${razorpayOrderId}) — skipping`
                );
                return; // Already processed or unknown — idempotent
              }

              // Reconcile the ledger inside the same transaction. Upsert keeps
              // this webhook self-sufficient even if /payments/verify never ran.
              await Ledger.findOneAndUpdate(
                { razorpayOrderId, type: 'payment' },
                {
                  order: order._id,
                  user: order.user,
                  type: 'payment',
                  amount: order.total,
                  currency: 'INR',
                  paymentMethod: 'razorpay',
                  razorpayPaymentId,
                  status: 'completed',
                  description: 'Payment captured via Razorpay webhook',
                },
                { session, upsert: true, new: true, setDefaultsOnInsert: true }
              );
            });

            break;
          }

          case 'payment.failed': {
            const failedPayment = eventPayload.payment.entity;
            const failedOrderId = failedPayment.order_id;

            // Only mark an EXISTING ledger entry as failed — never create a
            // ghost record for a payment we have no ledger entry for.
            const failedLedger = await Ledger.findOneAndUpdate(
              { razorpayOrderId: failedOrderId, type: 'payment' },
              {
                status: 'failed',
                description: `Payment failed: ${failedPayment.error_description || 'Unknown error'}`,
              }
            );

            if (!failedLedger) {
              console.warn(
                `payment.failed received for razorpayOrderId ${failedOrderId} with no ledger entry — nothing to reconcile`
              );
            }

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