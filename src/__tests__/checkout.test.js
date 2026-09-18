const app = require('../app');
const Order = require('../models/Order');
const Ledger = require('../models/Ledger');
const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');
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

const checkout = (agent, key, payload) =>
  agent.post('/api/orders').set('Idempotency-Key', key).send({ shippingAddress: VALID_ADDRESS, ...payload });

describe('COD checkout & idempotency', () => {
  it('creates an order preserving 201, replays the same key without duplicating, and rejects a missing key', async () => {
    const agent = await registerAndLogin(app, { email: 'cod@example.com' });
    const product = await createProduct({ price: 100, stock: 10 });
    await agent.post('/api/cart').send({ productId: product._id.toString(), quantity: 2 });

    const key = uuid();
    const r1 = await checkout(agent, key, {});
    expect(r1.status).toBe(201);

    const r2 = await checkout(agent, key, {});
    expect(r2.status).toBe(201);
    expect(r2.body).toEqual(r1.body); // exact stored replay (status + body preserved)
    expect(await Order.countDocuments()).toBe(1);

    // missing Idempotency-Key
    const r3 = await agent.post('/api/orders').send({ shippingAddress: VALID_ADDRESS });
    expect(r3.status).toBe(400);
    expect(await Order.countDocuments()).toBe(1);
  });

  it('stock guard: sufficient stock decrements atomically; insufficient stock fails cleanly', async () => {
    const agent = await registerAndLogin(app, { email: 'stock@example.com' });
    const product = await createProduct({ price: 100, stock: 10 });
    await agent.post('/api/cart').send({ productId: product._id.toString(), quantity: 2 });

    const r1 = await checkout(agent, uuid(), {});
    expect(r1.status).toBe(201);
    const afterSale = await product.constructor.findById(product._id);
    expect(afterSale.stock).toBe(8);

    // far beyond available stock
    const r2 = await checkout(agent, uuid(), {
      items: [{ productId: product._id.toString(), quantity: 99 }],
    });
    expect(r2.status).toBe(400);
    expect((await product.constructor.findById(product._id)).stock).toBe(8);
    expect(await Order.countDocuments()).toBe(1);

    // exact remaining stock succeeds
    await agent.post('/api/cart').send({ productId: product._id.toString(), quantity: 8 });
    const r3 = await checkout(agent, uuid(), {});
    expect(r3.status).toBe(201);
    expect((await product.constructor.findById(product._id)).stock).toBe(0);
  });

  it('same idempotency key from a different user is rejected and never leaks the first response', async () => {
    const agentA = await registerAndLogin(app, { email: 'a@example.com' });
    const agentB = await registerAndLogin(app, { email: 'b@example.com' });
    const product = await createProduct({ price: 100, stock: 20 });

    for (const a of [agentA, agentB]) {
      await a.post('/api/cart').send({ productId: product._id.toString(), quantity: 1 });
    }

    const key = uuid();
    const rA = await checkout(agentA, key, {});
    expect(rA.status).toBe(201);

    const rB = await checkout(agentB, key, {});
    expect(rB.status).toBe(409);
    expect(rB.body).not.toEqual(rA.body);
    expect(await Order.countDocuments()).toBe(1);
  });

  it('concurrent duplicate checkouts with the same key create exactly one order', async () => {
    const agent = await registerAndLogin(app, { email: 'race@example.com' });
    const product = await createProduct({ price: 100, stock: 10 });
    await agent.post('/api/cart').send({ productId: product._id.toString(), quantity: 1 });

    const key = uuid();
    const results = await Promise.all([
      checkout(agent, key, {}),
      checkout(agent, key, {}),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 201]); // one real create + one replay
    const ids = results.map((r) => JSON.stringify(r.body));
    expect(new Set(ids).size).toBe(1); // identical replayed payload
    expect(await Order.countDocuments()).toBe(1);
    expect((await product.constructor.findById(product._id)).stock).toBe(9);
  });

  it('empty cart checkout fails with 400', async () => {
    const agent = await registerAndLogin(app, { email: 'empty@example.com' });
    const r = await checkout(agent, uuid(), {});
    expect(r.status).toBe(400);
    expect(await Order.countDocuments()).toBe(0);
  });

  it('creates a pending COD ledger entry for COD orders', async () => {
    const agent = await registerAndLogin(app, { email: 'ledger@example.com' });
    const product = await createProduct({ price: 100, stock: 5 });
    await agent.post('/api/cart').send({ productId: product._id.toString(), quantity: 1 });

    const r = await checkout(agent, uuid(), {});
    expect(r.status).toBe(201);
    const order = await Order.findOne({});
    expect(order).toBeTruthy();
    const entry = await Ledger.findOne({ order: order._id, type: 'payment', paymentMethod: 'cod' });
    expect(entry).toBeTruthy();
    expect(entry.amount).toBe(order.total);
    expect(entry.status).toBe('pending');
  });
});

describe('Transaction rollback', () => {
  it('no order remains and stock is restored when ledger creation fails mid-checkout', async () => {
    const agent = await registerAndLogin(app, { email: 'rollback@example.com' });
    const product = await createProduct({ price: 100, stock: 10 });
    await agent.post('/api/cart').send({ productId: product._id.toString(), quantity: 2 });

    const spy = jest.spyOn(Ledger, 'create').mockRejectedValueOnce(new Error('ledger down'));
    const r = await checkout(agent, uuid(), {});
    spy.mockRestore();

    expect([400, 500]).toContain(r.status);
    expect(await Order.countDocuments()).toBe(0);
    // atomic $inc happens inside the transaction — abort restores the stock
    expect((await product.constructor.findById(product._id)).stock).toBe(10);
  });
});

describe('AI admin authorization', () => {
  const endpoints = [
    { method: 'get', url: '/api/ai/admin/support-tickets' },
    { method: 'patch', url: '/api/ai/admin/support-tickets/000000000000000000000000/resolve' },
    { method: 'post', url: '/api/ai/admin/init-vector-store' },
    { method: 'get', url: '/api/ai/admin/vector-store/stats' },
    { method: 'post', url: '/api/ai/admin/knowledge-base/seed' },
  ];

  it('rejects unauthenticated (401) and customer (403) access on every admin AI endpoint', async () => {
    for (const ep of endpoints) {
      const unauth = await request(app)[ep.method](ep.url);
      expect(unauth.status).toBe(401);

      const customer = await registerAndLogin(app, { email: `cust-${ep.method}-${uuid().slice(0, 8)}@example.com` });
      const res = await customer[ep.method](ep.url);
      expect(res.status).toBe(403);
    }
  });

  it('allows admin access to support tickets', async () => {
    await User.create({ name: 'Admin', email: 'admin@example.com', password: 'password1', role: 'admin' });
    const admin = request.agent(app);
    await admin.post('/api/auth/login').send({ email: 'admin@example.com', password: 'password1' });

    await SupportTicket.create({ userId: 'x', userName: 'x', userEmail: 'x@example.com', reason: 'help' });
    const list = await admin.get('/api/ai/admin/support-tickets');
    expect(list.status).toBe(200);
    expect(list.body.tickets.length).toBe(1);
  });
});
