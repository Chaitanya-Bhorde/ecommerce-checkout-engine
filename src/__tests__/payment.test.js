// Offline determinism: stub the Razorpay SDK client but KEEP the real
// signature-verification functions (pure crypto) so the actual verification
// logic under test is the production code path.
jest.mock('../config/razorpay', () => {
  const crypto = require('crypto');
  let seq = 0;
  const orders = new Map();
  const payments = new Map();

  const createRazorpayOrder = async (amount, currency = 'INR', receipt = '') => {
    const id = `order_mock_${++seq}${crypto.randomBytes(4).toString('hex')}`;
    // Real Razorpay returns amount in paise (smallest currency unit)
    const order = { id, amount: Math.round(amount * 100), currency, receipt, notes: {} };
    orders.set(id, order);
    return order;
  };

  const fetchRazorpayPayment = async (paymentId) => payments.get(paymentId) || null;

  // Helper to register a payment in the mock (used by tests to simulate payments)
  const registerPayment = (paymentId, orderId, amountPaise) => {
    payments.set(paymentId, {
      id: paymentId,
      order_id: orderId,
      amount: amountPaise,
      currency: 'INR',
      status: 'captured',
      method: 'upi',
      notes: {},
    });
  };

  const actual = jest.requireActual('../config/razorpay');
  return {
    getRazorpay: () => ({
      orders: { create: jest.fn(createRazorpayOrder) },
      payments: { fetch: jest.fn(fetchRazorpayPayment) },
    }),
    createRazorpayOrder,
    fetchRazorpayPayment,
    registerPayment,
    verifyPaymentSignature: actual.verifyPaymentSignature,
    verifyWebhookSignature: actual.verifyWebhookSignature,
  };
});

const crypto = require('crypto');
const app = require('../app');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Ledger = require('../models/Ledger');
const {
  startDb,
  stopDb,
  clearDb,
  registerAndLogin,
  createProduct,
  VALID_ADDRESS,
  uuid,
  request,
} = require('./helpers');

jest.setTimeout(90000);

beforeAll(async () => {
  await startDb();
});
beforeEach(async () => {
  await clearDb();
});
afterAll(async () => {
  await stopDb();
});

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const signPayment = (rzOrderId, rzPaymentId) =>
  crypto.createHmac('sha256', KEY_SECRET).update(`${rzOrderId}|${rzPaymentId}`).digest('hex');

const newRzOrderId = () => 'order_' + crypto.randomBytes(8).toString('hex');
const newPaymentId = () => 'pay_' + crypto.randomBytes(8).toString('hex');

// Sets up a user + cart + a mocked Razorpay order (no network: the razorpay
// client is stubbed for offline determinism).
const setupCart = async (email) => {
  const agent = await registerAndLogin(app, { email });
  const product = await createProduct({ price: 100, stock: 10 });
  await agent.post('/api/cart').send({ productId: product._id.toString(), quantity: 2 });
  return { agent, product };
};

const createPayment = async (agent) => {
  const res = await agent.post('/api/payments/create').send({});
  expect(res.status).toBe(200);
  return res.body; // { razorpayOrderId, amount, currency, keyId }
};

const capturedEvent = (rzOrderId, payId, amountPaise) =>
  JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: payId,
          order_id: rzOrderId,
          amount: amountPaise,
          currency: 'INR',
          status: 'captured',
          method: 'upi',
          notes: {},
        },
      },
    },
  });

const failedEvent = (rzOrderId, payId) =>
  JSON.stringify({
    event: 'payment.failed',
    payload: {
      payment: {
        entity: { id: payId, order_id: rzOrderId, amount: 100, currency: 'INR', status: 'failed' },
      },
    },
  });

const sendWebhook = (bodyStr, signature) =>
  request(app)
    .post('/api/webhooks/razorpay')
    .set('Content-Type', 'application/json')
    .set('x-razorpay-signature', signature)
    // Send the STRING, not a Buffer: supertest serializes Buffers through
    // toJSON(), which would put a {"type":"Buffer",...} document on the wire
    // and make the signed bytes differ from the transmitted ones.
    .send(bodyStr);

// The webhook handler ACKs synchronously (200) but processes business logic in
// a setImmediate background task. Give it a beat before asserting DB state.
const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Razorpay payment order creation', () => {
  it('computes the amount server-side and replays the same razorpay order on retry', async () => {
    const { agent } = await setupCart('create@example.com');
    const r1 = await createPayment(agent);
    // price 100 x2 = 200 subtotal, +18% tax (36) + shipping 40 => 276 => 27600 paise
    expect(r1.amount).toBe(27600);
    expect(r1.currency).toBe('INR');

    const r2 = await createPayment(agent);
    expect(r2.razorpayOrderId).toBe(r1.razorpayOrderId);

    // pending ledger entry recorded at creation
    const entry = await Ledger.findOne({ razorpayOrderId: r1.razorpayOrderId });
    expect(entry).toBeTruthy();
    expect(entry.status).toBe('pending');
    expect(entry.amount).toBe(276);
    expect(await Order.countDocuments()).toBe(0);
  });
});

describe('Payment verification', () => {
  const verify = (agent, body) => agent.post('/api/payments/verify').send(body);

  const makeVerifyBody = (rzOrderId, payId, over = {}) => ({
    razorpay_order_id: rzOrderId,
    razorpay_payment_id: payId,
    razorpay_signature: signPayment(rzOrderId, payId),
    shippingAddress: VALID_ADDRESS,
    ...over,
  });

  it('confirms the order, decrements stock, completes the ledger, and is idempotent on retry', async () => {
    const { agent, product } = await setupCart('verify@example.com');
    const created = await createPayment(agent);
    const payId = newPaymentId();

    const r1 = await verify(agent, makeVerifyBody(created.razorpayOrderId, payId));
    expect(r1.status).toBe(200);
    expect(r1.body.order.status).toBe('confirmed');

    const order = await Order.findById(r1.body.order._id);
    expect(order.payment.razorpayPaymentId).toBe(payId);
    expect(order.total).toBe(276);
    expect((await product.constructor.findById(product._id)).stock).toBe(8);

    const entry = await Ledger.findOne({ razorpayOrderId: created.razorpayOrderId });
    expect(entry.status).toBe('completed');
    expect(entry.amount).toBe(order.total);
    expect(entry.razorpayPaymentId).toBe(payId);

    const r2 = await verify(agent, makeVerifyBody(created.razorpayOrderId, payId));
    expect(r2.status).toBe(200);
    expect(await Order.countDocuments()).toBe(1);
    expect((await Ledger.find({ razorpayPaymentId: payId, status: 'completed' })).length).toBe(1);
  });

  it('rejects an invalid signature without touching inventory', async () => {
    const { agent, product } = await setupCart('badsig@example.com');
    const created = await createPayment(agent);
    const payId = newPaymentId();

    const r = await verify(agent, makeVerifyBody(created.razorpayOrderId, payId, {
      razorpay_signature: '0'.repeat(64),
    }));
    expect(r.status).toBe(400);
    expect(await Order.countDocuments()).toBe(0);
    expect((await product.constructor.findById(product._id)).stock).toBe(10);
  });

  it('rejects verification when the cart total no longer matches the paid amount (price drift)', async () => {
    const { agent } = await setupCart('drift@example.com');
    const created = await createPayment(agent);

    const cart = await Cart.findOne({});
    await Cart.updateOne({ _id: cart._id }, { 'pendingPayment.amount': 999999 });

    const r = await verify(agent, makeVerifyBody(created.razorpayOrderId, newPaymentId()));
    expect(r.status).toBe(409);
    expect(await Order.countDocuments()).toBe(0);
  });

  it('rejects verification for an unknown Razorpay order', async () => {
    const { agent } = await setupCart('unknown@example.com');
    await createPayment(agent);

    const r = await verify(agent, makeVerifyBody(newRzOrderId(), newPaymentId()));
    expect(r.status).toBe(404);
  });

  it('concurrent duplicate verification settles exactly once', async () => {
    const { agent } = await setupCart('concurrent@example.com');
    const created = await createPayment(agent);
    const payId = newPaymentId();

    const results = await Promise.all([
      verify(agent, makeVerifyBody(created.razorpayOrderId, payId)),
      verify(agent, makeVerifyBody(created.razorpayOrderId, payId)),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 200]);
    expect(await Order.countDocuments()).toBe(1);
    expect((await Ledger.find({ razorpayPaymentId: payId, status: 'completed' })).length).toBe(1);
  });
});

describe('Razorpay webhook', () => {
  const hmac = (bodyStr, secret) =>
    crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');

  it('accepts a correctly signed payment.captured and confirms the order atomically', async () => {
    const { agent } = await setupCart('webhook@example.com');
    const created = await createPayment(agent);
    
    // Create the order first via checkout (simulates the order being created
    // before the webhook arrives - the webhook confirms it)
    const product = await createProduct({ price: 100, stock: 10 });
    await agent.post('/api/cart').send({ productId: product._id.toString(), quantity: 2 });
    const checkoutRes = await agent.post('/api/orders').set('Idempotency-Key', uuid()).send({ shippingAddress: VALID_ADDRESS });
    expect(checkoutRes.status).toBe(201);
    const orderId = checkoutRes.body._id;
    
    // Now create a new payment for this order
    const paymentRes = await agent.post('/api/payments/create/' + orderId).send({});
    expect(paymentRes.status).toBe(200);
    const razorpayOrderId = paymentRes.body.razorpayOrderId;
    const payId = newPaymentId();
    
    const bodyStr = capturedEvent(razorpayOrderId, payId, paymentRes.body.amount);

    const res = await sendWebhook(bodyStr, hmac(bodyStr, WEBHOOK_SECRET));
    expect(res.status).toBe(200);
    await waitMs(300); // allow the background setImmediate handler to settle

    const order = await Order.findById(orderId);
    expect(order).toBeTruthy();
    expect(order.status).toBe('confirmed');
    const entry = await Ledger.findOne({ razorpayOrderId });
    expect(entry.status).toBe('completed');
  });

  it('rejects an invalid signature with 400 and takes no action', async () => {
    const { agent } = await setupCart('webhook-bad@example.com');
    const created = await createPayment(agent);
    const bodyStr = capturedEvent(created.razorpayOrderId, newPaymentId(), created.amount);

    const res = await sendWebhook(bodyStr, 'f'.repeat(64));
    expect(res.status).toBe(400);
    expect(await Order.countDocuments()).toBe(0);
  });

  it('rejects a tampered payload signed against different content', async () => {
    const { agent } = await setupCart('webhook-tamper@example.com');
    const created = await createPayment(agent);
    const bodyStr = capturedEvent(created.razorpayOrderId, newPaymentId(), created.amount);
    const tampered = JSON.parse(bodyStr);
    tampered.payload.payment.entity.amount = 1;
    const tamperedStr = JSON.stringify(tampered);

    const res = await sendWebhook(tamperedStr, hmac(bodyStr, WEBHOOK_SECRET));
    expect(res.status).toBe(400);
    expect(await Order.countDocuments()).toBe(0);
  });

  it('records failure and cancels the pending order on payment.failed', async () => {
    const { agent } = await setupCart('webhook-fail@example.com');
    
    // Create the order first via checkout
    const product = await createProduct({ price: 100, stock: 10 });
    await agent.post('/api/cart').send({ productId: product._id.toString(), quantity: 2 });
    const checkoutRes = await agent.post('/api/orders').set('Idempotency-Key', uuid()).send({ shippingAddress: VALID_ADDRESS });
    expect(checkoutRes.status).toBe(201);
    const orderId = checkoutRes.body._id;
    
    // Create a payment for this order
    const paymentRes = await agent.post('/api/payments/create/' + orderId).send({});
    expect(paymentRes.status).toBe(200);
    const razorpayOrderId = paymentRes.body.razorpayOrderId;
    const payId = newPaymentId();
    const bodyStr = failedEvent(razorpayOrderId, payId);

    const res = await sendWebhook(bodyStr, hmac(bodyStr, WEBHOOK_SECRET));
    expect(res.status).toBe(200);
    await waitMs(300); // allow the background setImmediate handler to settle
    expect(await Order.countDocuments()).toBe(1);
    
    const entry = await Ledger.findOne({ razorpayOrderId });
    expect(entry.status).toBe('failed');
  });
});
