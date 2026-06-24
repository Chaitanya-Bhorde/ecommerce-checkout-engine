const mongoose = require('mongoose');

const idempotencySchema = new mongoose.Schema({
  key: {
    type: String,
    required: [true, 'Idempotency key is required'],
    unique: true,
    index: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
  },
  response: {
    statusCode: { type: Number, required: true },
    body: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

idempotencySchema.index({ key: 1, user: 1 });

module.exports = mongoose.model('Idempotency', idempotencySchema);