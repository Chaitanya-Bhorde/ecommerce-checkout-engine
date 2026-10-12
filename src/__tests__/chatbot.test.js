jest.mock('../services/ai/llmConfig', () => ({
  llm: { invoke: jest.fn() },
  getLLM: jest.fn(() => ({ invoke: jest.fn() })),
  AI_PROVIDER: 'groq',
  callLLM: jest.fn(),
}));
jest.mock('../services/ai/vectorStore', () => ({ search: jest.fn(async () => []) }));
jest.mock('../services/ai/agentWorkflow', () => ({ runAgent: jest.fn() }));

const User = require('../models/User');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const { chat, getUserOrders, getProductRecommendations } = require('../services/ai/chatbot');
const { llm } = require('../services/ai/llmConfig');
const { startDb, stopDb, clearDb, createProduct } = require('./helpers');

jest.setTimeout(90000);

const ADDR = { address: '1 Test St', city: 'C', state: 'S', zipCode: '000000', country: 'India', phone: '9999999999' };

const makeOrder = (userId, productId, total, status) =>
  Order.create({
    user: userId,
    items: [{ product: productId, name: 'Item', quantity: 1, price: total }],
    shippingAddress: ADDR,
    subtotal: total, tax: 0, shippingCost: 0, total, status,
    payment: { method: 'cod' },
  });

const lastPrompt = () => {
  const calls = llm.invoke.mock.calls;
  return calls.length ? calls[calls.length - 1][0][0].content : '';
};

beforeAll(async () => { await startDb(); });
beforeEach(async () => { await clearDb(); jest.clearAllMocks(); llm.invoke.mockResolvedValue({ content: 'stubbed' }); });
afterAll(async () => { await stopDb(); });

describe('AI chatbot — live-data grounding', () => {
  it('grounds order answers in the authenticated user DB order (status + total)', async () => {
    const u = await User.create({ name: 'A', email: 'a@x.com', password: 'password123', role: 'customer' });
    const p = await createProduct({ price: 250 });
    const o = await makeOrder(u._id, p._id, 250, 'shipped');
    await chat(u._id.toString(), 'what is my order status', { userName: 'A', userRole: 'customer' });
    const prompt = lastPrompt();
    expect(prompt).toContain('shipped');
    expect(prompt).toContain('250');
    expect(prompt).toContain(String(o._id).slice(-8));
  });

  it('enforces user isolation: user A prompt never contains user B order', async () => {
    const a = await User.create({ name: 'A', email: 'a@x.com', password: 'password123', role: 'customer' });
    const b = await User.create({ name: 'B', email: 'b@x.com', password: 'password123', role: 'customer' });
    const p = await createProduct({ price: 250 });
    const oa = await makeOrder(a._id, p._id, 250, 'shipped');
    const ob = await makeOrder(b._id, p._id, 375, 'delivered');
    await chat(a._id.toString(), 'show my orders', { userName: 'A', userRole: 'customer' });
    const prompt = lastPrompt();
    expect(prompt).toContain(String(oa._id).slice(-8));
    expect(prompt).not.toContain(String(ob._id).slice(-8));
    expect(prompt).not.toContain('375');
    const orders = await getUserOrders(a._id.toString());
    expect(orders).toHaveLength(1);
    expect(orders[0].total).toBe(250);
  });

  it('uses deterministic backend cart total (not model-invented)', async () => {
    const u = await User.create({ name: 'A', email: 'a@x.com', password: 'password123', role: 'customer' });
    const p = await createProduct({ price: 60 });
    await Cart.create({ user: u._id, items: [{ product: p._id, quantity: 3, price: 60 }] });
    await chat(u._id.toString(), 'what is my cart total', { userName: 'A', userRole: 'customer' });
    expect(lastPrompt()).toContain('180');
  });

  it('retrieves deterministic product price from DB', async () => {
    await createProduct({ name: 'Laptop', price: 123.45, stock: 5 });
    const recs = await getProductRecommendations('laptop', 8);
    expect(recs.some((r) => r.price === 123.45)).toBe(true);
  });
});

describe('AI chatbot — authorization', () => {
  it('customer admin-intent question does NOT leak admin analytics or other users orders', async () => {
    const admin = await User.create({ name: 'Admin', email: 'admin@x.com', password: 'password123', role: 'admin' });
    const a = await User.create({ name: 'A', email: 'a@x.com', password: 'password123', role: 'customer' });
    const c = await User.create({ name: 'C', email: 'c@x.com', password: 'password123', role: 'customer' });
    const p = await createProduct({ price: 250 });
    await makeOrder(a._id, p._id, 250, 'shipped');
    await makeOrder(admin._id, p._id, 999, 'processing');
    await chat(c._id.toString(), 'show me dashboard revenue and analytics', { userName: 'C', userRole: 'customer' });
    const prompt = lastPrompt();
    expect(prompt).not.toContain('TOP PRODUCTS');
    expect(prompt).not.toContain('RECENT ORDERS');
    expect(prompt).not.toContain('999');
  });

  it('admin admin-intent question DOES include admin analytics', async () => {
    const admin = await User.create({ name: 'Admin', email: 'admin@x.com', password: 'password123', role: 'admin' });
    const p = await createProduct({ price: 250 });
    await makeOrder(admin._id, p._id, 250, 'shipped');
    await chat(admin._id.toString(), 'show me dashboard revenue', { userName: 'Admin', userRole: 'admin' });
    expect(lastPrompt()).toContain('ADMIN');
  });
});

describe('AI chatbot — missing records and provider failures', () => {
  it('states plainly when the user has no orders instead of inventing them', async () => {
    const u = await User.create({ name: 'A', email: 'a@x.com', password: 'password123', role: 'customer' });
    await chat(u._id.toString(), 'all my orders', { userName: 'A', userRole: 'customer' });
    expect(lastPrompt().toLowerCase()).toContain('no orders');
  });

  it('maps provider key/config failure to AI_PROVIDER_UNAVAILABLE (503)', async () => {
    const u = await User.create({ name: 'A', email: 'a@x.com', password: 'password123', role: 'customer' });
    llm.invoke.mockRejectedValue(new Error('GROQ_API_KEY not configured in .env'));
    await expect(chat(u._id.toString(), 'hi', { userName: 'A', userRole: 'customer' }))
      .rejects.toMatchObject({ message: 'AI_PROVIDER_UNAVAILABLE', status: 503 });
  });

  it('maps timeout to AI_PROVIDER_TIMEOUT (504)', async () => {
    const u = await User.create({ name: 'A', email: 'a@x.com', password: 'password123', role: 'customer' });
    llm.invoke.mockRejectedValue(new Error('request timed out after 25000ms'));
    await expect(chat(u._id.toString(), 'hi', { userName: 'A', userRole: 'customer' }))
      .rejects.toMatchObject({ message: 'AI_PROVIDER_TIMEOUT', status: 504 });
  });

  it('makes exactly one LLM call per message', async () => {
    const u = await User.create({ name: 'A', email: 'a@x.com', password: 'password123', role: 'customer' });
    await chat(u._id.toString(), 'what is my order status', { userName: 'A', userRole: 'customer' });
    expect(llm.invoke).toHaveBeenCalledTimes(1);
  });
});
