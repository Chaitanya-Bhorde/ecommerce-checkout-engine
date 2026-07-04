const mongoose = require('mongoose');

const chatLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  response: {
    type: String,
    required: true,
  },
  action: {
    type: String,
    enum: ['cancelOrder', 'processReturn', 'updateDeliveryAddress', 'getOrderDetails', 'searchProducts', 'applyDiscountCode', null],
    default: null,
  },
  actionResult: {
    success: Boolean,
    message: String,
    data: mongoose.Schema.Types.Mixed,
  },
  responseTime: {
    type: Number,
    default: 0,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Create index for faster queries
chatLogSchema.index({ userId: 1, timestamp: -1 });
chatLogSchema.index({ timestamp: -1 });
chatLogSchema.index({ action: 1 });

module.exports = mongoose.model('ChatLog', chatLogSchema);