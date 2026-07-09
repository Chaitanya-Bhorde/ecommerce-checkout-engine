const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      index: true, // Index for text search
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      index: true, // Index for price sorting/filtering
    },
    stock: {
      type: Number,
      required: [true, 'Stock is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true, // Index for category filtering
    },
    images: [
      {
        type: String,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true, // Index for active product queries
    },
    ratings: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    numReviews: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compound index for category + active products
productSchema.index({ category: 1, isActive: 1 });

// Compound index for active products sorted by creation date
productSchema.index({ isActive: 1, createdAt: -1 });

// Text index for search functionality
productSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);