const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Test route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'E-Commerce Checkout Engine is running' });
});

module.exports = app;