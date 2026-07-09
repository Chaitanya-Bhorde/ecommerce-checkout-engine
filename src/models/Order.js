const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Index for user's order queries
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
        image: {
          type: String,
        },
      },
    ],
    shippingAddress: {
      address: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      zipCode: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
    },
    payment: {
      method: {
        type: String,
        enum: ['razorpay', 'cod'],
      },
      razorpayOrderId: {
        type: String,
      },
      razorpayPaymentId: {
        type: String,
      },
      paidAt: {
        type: Date,
      },
    },
    subtotal: {
      type: Number,
      required: true,
    },
    tax: {
      type: Number,
      required: true,
    },
    shippingCost: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'received', 'cancelled', 'refunded'],
      default: 'pending',
      index: true, // Index for status filtering
    },
    deliveryProgress: {
      type: Number,
      default: 0,
    },
    statusHistory: [
      {
        status: {
          type: String,
          required: true,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        note: {
          type: String,
        },
        deliveryProgress: {
          type: Number,
        },
      },
    ],
  },
  { timestamps: true }
);

// Compound index for user's orders sorted by date
orderSchema.index({ user: 1, createdAt: -1 });

// Index for admin order filtering by status and date
orderSchema.index({ status: 1, createdAt: -1 });

// Index for date range queries
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);