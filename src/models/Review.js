const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: 1,
    max: 5,
  },
  title: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// One review per user per product per order
reviewSchema.index({ product: 1, user: 1, order: 1 }, { unique: true });
reviewSchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);