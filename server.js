const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('./src/config/db');
const app = require('./src/app');
const { initializeSocket } = require('./src/services/socketService');

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Initialize Socket.io for real-time chat
  initializeSocket(server);
  console.log('Socket.io initialized for real-time chat');
});
