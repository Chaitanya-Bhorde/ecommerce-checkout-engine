const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  userName: {
    type: String,
    required: true,
  },
  userEmail: {
    type: String,
    required: true,
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
  },
  reason: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved'],
    default: 'open',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('SupportTicket', supportTicketSchema);