const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

// Single shared in-memory MongoDB REPLICA SET for the whole test run.
// A replica set (not standalone) is mandatory: the checkout engine uses
// multi-document transactions, which MongoDB only supports on replica sets.
let replSet = null;

const startDb = async () => {
  if (!replSet) {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  }
  const uri = replSet.getUri('checkout_test');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
    // Await every model's index build before any test runs. Mongoose otherwise
    // builds indexes lazily/in the background, and an index build holds a
    // collection lock; the first transaction of a suite then trips the server's
    // 5ms transaction lock-request timeout ("Unable to acquire IX lock ... within
    // 5ms", code 24 LockTimeout) and surfaces as a spurious 500.
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  }
  return uri;
};

const stopDb = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
    replSet = null;
  }
};

// Documents are deleted instead of dropping the database: dropDatabase() also
// removes the schema indexes, which would silently disable the unique
// constraints (one order per Razorpay payment, idempotency keys, ...) that the
// tests are supposed to enforce exactly as production does.
const clearDb = async () => {
  const { db } = mongoose.connection;
  if (!db) return;
  const collections = await db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
};

const VALID_ADDRESS = {
  address: '123 Test Street',
  city: 'Mumbai',
  state: 'Maharashtra',
  zipCode: '400001',
  country: 'India',
  phone: '9876543210',
};

// Registers a user and returns a request wrapper carrying the auth cookie.
// Note: supertest's cookie jar drops SameSite=Strict cookies, so the auth
// cookie is attached explicitly on every request instead of via the jar.
const registerAndLogin = async (app, { name = 'Test User', email, password = 'password1' } = {}) => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password });
  if (res.status !== 201) {
    throw new Error(`register failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  const setCookie = res.headers['set-cookie'] || [];
  const cookie = (setCookie[0] || '').split(';')[0];
  if (!cookie) {
    throw new Error('register response did not include an auth cookie');
  }
  const withHeader = (method) => (url) => request(app)[method](url).set('Cookie', cookie);
  return {
    cookie,
    get: withHeader('get'),
    post: withHeader('post'),
    put: withHeader('put'),
    patch: withHeader('patch'),
    delete: withHeader('delete'),
  };
};

const createProduct = async (overrides = {}) => {
  const Category = require('../models/Category');
  const Product = require('../models/Product');
  const category = await Category.create({
    name: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: 'test category',
  });
  return Product.create({
    name: 'Test Product',
    description: 'A product used by automated tests',
    price: 100,
    stock: 10,
    category: category._id,
    ...overrides,
  });
};

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

module.exports = {
  startDb,
  stopDb,
  clearDb,
  VALID_ADDRESS,
  registerAndLogin,
  createProduct,
  uuid,
  request,
  mongoose,
};
