// Socket.io Service - Real-time bidirectional chat
// Enables instant messaging without page refresh

const { Server } = require('socket.io');
const { chat, getChatHistory } = require('./ai/chatbot');

let io = null;

/**
 * Initialize Socket.io server
 * @param {Object} server - Express server instance
 */
function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? "https://yourdomain.com" 
        : "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      // Verify token
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Fetch full user document to populate role and _id
      const User = require('../models/User');
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user._id}`);

    // Join user's personal room for notifications
    socket.join(`user:${socket.user._id}`);
    
    // Join admin room for admin notifications
    if (socket.user.role === 'admin') {
      socket.join('admin');
    }

    // Handle incoming messages
    socket.on('sendMessage', async (data) => {
      try {
        const { message, messageId } = data;
        const userId = socket.user._id;

        console.log(`[Socket] Received message from user ${userId}:`, message);

        // Emit typing indicator to user
        socket.emit('typing', { isTyping: true });

        // Get AI response
        console.log(`[Socket] Getting AI response...`);
        const response = await chat(userId, message, {
          userId,
        });

        console.log(`[Socket] AI response received:`, response);

        // Send response back to user
        socket.emit('receiveMessage', {
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        });

        // Stop typing indicator
        socket.emit('typing', { isTyping: false });

        // Emit suggestions
        const { getSuggestedReplies } = require('./ai/chatbot');
        const suggestions = getSuggestedReplies(userId);
        socket.emit('suggestions', { suggestions });

        console.log(`[Socket] Response sent to user ${userId}`);
      } catch (error) {
        console.error('[Socket] Message error:', error);
        socket.emit('error', { message: 'Failed to send message', error: error.message });
      }
    });

    // Handle typing indicator
    socket.on('typing', (isTyping) => {
      socket.broadcast.emit('typing', { isTyping });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user._id}`);
    });
  });

  return io;
}

/**
 * Send notification to specific user
 * @param {string} userId - User ID
 * @param {Object} data - Data to send
 */
function sendToUser(userId, data) {
  if (io) {
    io.to(`user:${userId}`).emit('notification', data);
  }
}

/**
 * Broadcast message to all connected users
 * @param {Object} data - Data to broadcast
 */
function broadcast(data) {
  if (io) {
    io.emit('broadcast', data);
  }
}

module.exports = {
  initializeSocket,
  sendToUser,
  broadcast,
};