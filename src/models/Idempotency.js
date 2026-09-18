const mongoose = require('mongoose');

const idempotencySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'Idempotency key is required'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    // SHA-256 of method|path|body: the same key must map to the same request.
    requestHash: {
      type: String,
      default: null,
    },
    // 'processing' = in-flight claim, 'completed' = replayable response stored.
    status: {
      type: String,
      enum: ['processing', 'completed'],
      default: 'processing',
    },
    // When the claim was taken; used to expire abandoned (crashed) claims.
    claimedAt: {
      type: Date,
      default: null,
    },
    // null while the request is still processing.
    response: {
      statusCode: { type: Number, default: null },
      body: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    // TTL cleanup — MongoDB deletes the document once this date passes.
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// The key is unique across the whole collection. A key reused by a DIFFERENT
// user is answered with 409 (never replayed), so one customer's stored response
// can never be handed to another customer.
idempotencySchema.index({ key: 1 }, { unique: true });

// TTL cleanup of stale claims/completed records.
idempotencySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Idempotency', idempotencySchema);