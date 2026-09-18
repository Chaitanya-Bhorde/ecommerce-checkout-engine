const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema(
  {
    // Optional by design: an online payment intent is recorded the moment the
    // Razorpay order is created — before any Order document exists. The order
    // reference is attached inside the same transaction that creates the order.
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    type: {
      type: String,
      enum: ['payment', 'refund', 'payout'],
      required: [true, 'Transaction type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    paymentMethod: {
      type: String,
      enum: ['razorpay', 'stripe', 'cod', null],
      default: null,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    razorpayOrderId: {
      type: String,
      default: null,
    },
    // 'processing' is the settlement claim: a verification/webhook has taken
    // ownership of this intent and is creating the order for it. It doubles as
    // the concurrency lock that makes settlement exactly-once.
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    description: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

ledgerSchema.index({ order: 1 });
ledgerSchema.index({ user: 1 });
// Reconciliation lookups (verify + webhook) always filter on the Razorpay order.
ledgerSchema.index({ razorpayOrderId: 1, type: 1 });
// Uniqueness guard: the same Razorpay payment can never produce two completed
// ledger entries (i.e. two orders). Concurrent duplicate verifications fail
// with E11000 and are converted into idempotent replays by the controller.
// partialFilterExpression restricts uniqueness to real payment-id strings so
// the many null-default documents never collide.
ledgerSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: 'string' } } }
);
ledgerSchema.index({ status: 1 });
ledgerSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Ledger', ledgerSchema);