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
        : "http://localhost:5174",
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

      // Verify token (you can use your existing auth middleware)
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user._id}`);

    // Join user's personal room
    socket.join(`user:${socket.user._id}`);

    // Handle incoming messages
    socket.on('sendMessage', async (data) => {
      try {
        const { message } = data;
        const userId = socket.user._id;

        // Emit typing indicator to user
        socket.emit('typing', { isTyping: true });

        // Get AI response
        const response = await chat(userId, message, {
          userId,
        });

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
      } catch (error) {
        console.error('Socket message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
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