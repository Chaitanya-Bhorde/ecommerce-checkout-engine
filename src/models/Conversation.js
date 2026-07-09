const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update updatedAt timestamp before saving
conversationSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Conversation', conversationSchema);