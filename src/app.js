const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const aiRoutes = require('./routes/aiRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const { handleRazorpayWebhook } = require('./controllers/webhookController');
const errorHandler = require('./middleware/errorHandler');
const { httpLogger } = require('./middleware/logger');

const app = express();

// ── Raw body preservation for webhook signature verification ──────────────
// The verify callback stashes the raw bytes before JSON parsing mutates them.
// The webhook controller reads req.rawBody for HMAC computation.
const rawParser = express.json({
  limit: '10mb',
  verify: (req, res, buf) => { req.rawBody = buf; }
});

// ── Mount webhook route BEFORE the global JSON parser ─────────────────────
// express.raw() on this specific path gives handleRazorpayWebhook a Buffer
// directly. The fallback path in the controller also consults req.rawBody for
// resilience if middleware ordering ever changes.
app.post(
  '/api/webhooks/razorpay',
  express.raw({ type: 'application/json', limit: '10mb' }),
  handleRazorpayWebhook
);

// ── Body parsers ───────────────────────────────────────────────────────────
app.use(rawParser);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Request logging (first non-body middleware so every request is logged) ─
app.use(httpLogger);

// ── Security headers ───────────────────────────────────────────────────────
app.use(helmet());

// ── Compression ────────────────────────────────────────────────────────────
app.use(compression());

// ── CORS ───────────────────────────────────────────────────────────────────
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.CLIENT_URL,
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:3000'
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};
app.use(cors(corsOptions));

// ── Rate limiting ──────────────────────────────────────────────────────────
// Enabled by default; disable with RATE_LIMIT_ENABLED=false (used in tests).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '50', 10),
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

if (process.env.RATE_LIMIT_ENABLED !== 'false') {
  // Strict limiter for authentication / password-reset endpoints (brute-force)
  app.use(
    [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
    ],
    authLimiter
  );
  // General limiter for everything else (generous, DoS protection only)
  app.use('/api/', generalLimiter);
}

// ── Cookie parser (must be after body parsers, before auth routes) ─────────
app.use(cookieParser());

// ── Health check ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'E-Commerce Checkout Engine is running' });
});

// ── Route mounts ───────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/invoice', invoiceRoutes);

// ── Global error handler (must be last) ────────────────────────────────────
app.use(errorHandler);

module.exports = app;
