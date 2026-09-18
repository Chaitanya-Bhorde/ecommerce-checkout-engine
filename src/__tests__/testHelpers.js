/**
 * Shared test helpers for the regression suite.
 * Spins up a mongodb-memory-server REPLICA SET (required for MongoDB
 * transactions used by checkout/payment/webhook flows) and wires per-test
 * isolation with correct disconnect ordering.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-do-not-use-in-production-0123456789abcdef';
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_1DP5mmOlF5G5ag';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test-only-razorpay-secret-00000000';
process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'test-only-webhook-secret-000000000';
process.env.PORT = '0';

// Real module-level state shared across an entire test FILE.
let memServer;
const createdUserIds = [];

/** Start an in-memory replica set and connect Mongoose to it. */
const setupDB = async () => {
  memServer = await MongoMemoryServer.create({
    replicaSet: true,
    instance: { storageEngine: 'wiredTiger' },
  });
  process.env.MONGODB_URI = memServer.getUri('checkout_test');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 60000 });
};

/** Disconnect in the correct order: client first, then stop the server. */
const teardownDB = async () => {
  try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
  try { await memServer.stop(); } catch (e) { /* ignore */ }
  memServer = undefined;
};

/** Drop all collections between tests for isolation (keeps one server per file). */
const cleanDB = async () => {
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
};

const testUser = (overrides = {}) => ({
  name: 'Test User',
  email: `user${Date.now()}${Math.floor(Math.random() * 1e6)}@example.com`,
  password: 'Password123',
  ...overrides,
});

const testAdmin = (overrides = {}) =>
  testUser({ name: 'Test Admin', email: `admin${Date.now()}${Math.floor(Math.random() * 1e6)}@example.com`, role: 'admin', ...overrides });

const testProduct = (overrides = {}) => ({
  name: 'Test Product',
  description: 'A product for testing',
  price: 99.99,
  stock: 10,
  ...overrides,
});

const testCartItem = (productId, quantity = 1, price = 99.99) => ({
  product: productId,
  quantity,
  price,
});

/** Login (or auto-register) and return the httpOnly auth cookie string. */
const getAuthCookie = async (request, app, { name, email, password, role } = testUser()) => {
  let res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status === 401) {
    // Auto-register on first use
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name, email, password });
    if (reg.status === 201) {
      return reg.headers['set-cookie'][0].split(';')[0];
    }
    // Role change (e.g. admin escalation) requires a direct DB update
    const User = require('../models/User');
    await User.findOneAndUpdate({ email }, { role: role || 'customer' });
    res = await request(app).post('/api/auth/login').send({ email, password });
    return res.headers['set-cookie'][0].split(';')[0];
  }
  return res.headers['set-cookie'][0].split(';')[0];
};

module.exports = {
  setupDB,
  teardownDB,
  cleanDB,
  testUser,
  testAdmin,
  testProduct,
  testCartItem,
  getAuthCookie,
  createdUserIds,
};