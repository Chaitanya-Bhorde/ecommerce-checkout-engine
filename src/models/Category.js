const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      unique: true,
      index: true, // Index for category name search
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true, // Index for filtering active categories
    },
  },
  { timestamps: true }
);

// Compound index for active categories sorted by name
categorySchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model('Category', categorySchema);