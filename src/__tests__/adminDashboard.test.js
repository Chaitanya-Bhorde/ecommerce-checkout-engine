const User = require('../models/User');
const Order = require('../models/Order');
const Ledger = require('../models/Ledger');
const app = require('../app');
const { startDb, stopDb, clearDb, registerAndLogin, createProduct, VALID_ADDRESS } = require('./helpers');

jest.setTimeout(90000);

beforeAll(async () => { await startDb(); });
beforeEach(async () => { await clearDb(); });
afterAll(async () => { await stopDb(); });

const makeOrder = (userId, productId, total, status) =>
  Order.create({
    user: userId,
    items: [{ product: productId, name: 'Item', quantity: 1, price: total }],
    shippingAddress: VALID_ADDRESS,
    subtotal: total, tax: 0, shippingCost: 0, total, status,
    payment: { method: 'cod' },
  });

const loginAsAdmin = async (label) => {
  const email = `admin-${label}-${Date.now()}@test.com`;
  const session = await registerAndLogin(app, { name: 'Admin', email });
  await User.updateOne({ email }, { role: 'admin' });
  return session;
};

const makeCustomer = async (email) =>
  User.create({ name: 'Customer', email, password: 'password123', role: 'customer' });

describe('Admin dashboard stats — consistent documented rules', () => {
  it('revenue is completed ledger payments minus completed refunds (pending/failed excluded)', async () => {
    const admin = await loginAsAdmin('rev');
    const customer = await makeCustomer(`rev-${Date.now()}@test.com`);
    await Ledger.create({ user: customer._id, type: 'payment', amount: 500, status: 'completed', paymentMethod: 'razorpay' });
    await Ledger.create({ user: customer._id, type: 'refund', amount: 100, status: 'completed', paymentMethod: 'razorpay' });
    await Ledger.create({ user: customer._id, type: 'payment', amount: 9999, status: 'pending', paymentMethod: 'razorpay' });
    await Ledger.create({ user: customer._id, type: 'payment', amount: 50, status: 'failed', paymentMethod: 'razorpay' });

    const res = await admin.get('/api/admin/dashboard/stats');
    expect(res.status).toBe(200);
    expect(res.body.revenue).toBe(400);
  });

  it('order and customer counts come from the same collections the list pages query', async () => {
    const admin = await loginAsAdmin('counts');
    const customer = await makeCustomer(`counts-${Date.now()}@test.com`);
    const p = await createProduct({ price: 250 });
    await makeOrder(customer._id, p._id, 250, 'pending');
    await makeOrder(customer._id, p._id, 250, 'shipped');

    const res = await admin.get('/api/admin/dashboard/stats');
    expect(res.status).toBe(200);
    expect(res.body.orders.total).toBe(await Order.countDocuments());
    expect(res.body.orders.pending).toBe(await Order.countDocuments({ status: 'pending' }));
    expect(res.body.customers.total).toBe(await User.countDocuments({ role: 'customer' }));
  });

  it('ledger summary reports the same settled revenue as the dashboard', async () => {
    const admin = await loginAsAdmin('ledger');
    const customer = await makeCustomer(`ledger-${Date.now()}@test.com`);
    await Ledger.create({ user: customer._id, type: 'payment', amount: 300, status: 'completed', paymentMethod: 'cod' });
    await Ledger.create({ user: customer._id, type: 'payment', amount: 700, status: 'pending', paymentMethod: 'cod' });

    const stats = await admin.get('/api/admin/dashboard/stats');
    const ledger = await admin.get('/api/admin/ledger');
    expect(stats.status).toBe(200);
    expect(ledger.status).toBe(200);
    expect(ledger.body.summary.settledAmount).toBe(300);
    expect(ledger.body.summary.settledAmount).toBe(stats.body.revenue);
    expect(ledger.body.summary.totalAmount).toBe(1000);
  });
});

describe('Admin orders — customers deleted, orders preserved', () => {
  it('retains the order and returns a null user reference after the customer is deleted', async () => {
    const admin = await loginAsAdmin('orphan');
    const customer = await makeCustomer(`doomed-${Date.now()}@test.com`);
    const p = await createProduct({ price: 250 });
    await makeOrder(customer._id, p._id, 250, 'pending');
    await User.deleteOne({ _id: customer._id });

    const res = await admin.get('/api/admin/orders?limit=5&page=1');
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].user).toBeNull();
    expect(res.body.orders[0].total).toBe(250);
    expect(res.body.orders[0].status).toBe('pending');
  });
});
