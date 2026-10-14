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

  it('returns a safe fallback response (with conversationId) on unexpected provider errors', async () => {
    const u = await User.create({ name: 'A', email: 'a@x.com', password: 'password123', role: 'customer' });
    llm.invoke.mockRejectedValue(new Error('Groq API error 500: upstream exploded'));
    const res = await chat(u._id.toString(), 'hi', { userName: 'A', userRole: 'customer' });
    expect(res.response).toMatch(/briefly unavailable/i);
    expect(res.conversationId).toBeTruthy();
    expect(res.escalate).toBe(false);
  });

  it('maps a retired/unknown model (model_not_found) to AI_PROVIDER_UNAVAILABLE (503)', async () => {
    const u = await User.create({ name: 'A', email: 'a@x.com', password: 'password123', role: 'customer' });
    llm.invoke.mockRejectedValue(new Error('Groq API error 404: {"error":{"code":"model_not_found","message":"The model `llama-3.1-8b-instant` does not exist or you do not have access to it."}}'));
    await expect(chat(u._id.toString(), 'hi', { userName: 'A', userRole: 'customer' }))
      .rejects.toMatchObject({ message: 'AI_PROVIDER_UNAVAILABLE', status: 503 });
  });

  it('never leaks store order/product counts to customers in the provider-failure fallback', async () => {
    const u = await User.create({ name: 'A', email: 'fb@x.com', password: 'password123', role: 'customer' });
    const p = await createProduct({ price: 250 });
    await makeOrder(u._id, p._id, 250, 'shipped');
    llm.invoke.mockRejectedValue(new Error('Groq API error 500: upstream exploded'));
    const res = await chat(u._id.toString(), 'hi', { userName: 'A', userRole: 'customer' });
    expect(res.response).toMatch(/briefly unavailable/i);
    expect(res.response).not.toMatch(/\d+ orders/);
    expect(res.response).not.toMatch(/\d+ products/);
  });

  it('retains store counts for admins in the provider-failure fallback', async () => {
    const admin = await User.create({ name: 'Admin', email: 'adminfb@x.com', password: 'password123', role: 'admin' });
    const p = await createProduct({ price: 250 });
    await makeOrder(admin._id, p._id, 250, 'shipped');
    llm.invoke.mockRejectedValue(new Error('Groq API error 500: upstream exploded'));
    const res = await chat(admin._id.toString(), 'hi', { userName: 'Admin', userRole: 'admin' });
    expect(res.response).toMatch(/briefly unavailable/i);
    expect(res.response).toMatch(/\d+ orders/);
  });
});

describe('AI chatbot — product retrieval from live catalog', () => {
  const ctx = { userName: 'A', userRole: 'customer' };
  const makeUser = (email) => User.create({ name: 'A', email, password: 'password123', role: 'customer' });

  it('grounds "price of wallpaper" in the actual DB product with its real price', async () => {
    const u = await makeUser('wall@x.com');
    await createProduct({ name: 'WALL Paper', price: 350, stock: 5 });
    await chat(u._id.toString(), 'What is the price of wallpaper?', ctx);
    const prompt = lastPrompt();
    expect(prompt).toContain('PRODUCT MATCH:');
    expect(prompt).toContain('WALL Paper');
    expect(prompt).toContain('Rs.350');
    expect(prompt).toContain('stock 5');
  });

  it('matches case and spacing variations of the product name', async () => {
    const u = await makeUser('var@x.com');
    await createProduct({ name: 'WALL Paper', price: 350, stock: 5 });
    for (const question of ['wallpaper', 'wall paper', 'Price of the wallpaper?', 'Is wallpaper available?']) {
      await chat(u._id.toString(), question, ctx);
      const prompt = lastPrompt();
      expect(prompt).toContain('PRODUCT MATCH:');
      expect(prompt).toContain('WALL Paper');
      expect(prompt).toContain('Rs.350');
    }
  });

  it('gives an honest not-found answer only after a real DB search fails to match', async () => {
    const u = await makeUser('missing@x.com');
    await createProduct({ name: 'WALL Paper', price: 350 });
    await chat(u._id.toString(), 'What does the quantum flux router cost?', ctx);
    const prompt = lastPrompt();
    expect(prompt).toContain('no active product matched');
    expect(prompt).toContain('quantum flux router');
    expect(prompt).toContain('Never invent');
    expect(prompt).not.toContain('PRODUCT MATCH:');
  });

  it('lists multiple matching products instead of picking one arbitrarily', async () => {
    const u = await makeUser('multi@x.com');
    await createProduct({ name: 'Wallpaper', price: 300 });
    await createProduct({ name: 'Wallpaper Premium', price: 500 });
    await chat(u._id.toString(), 'price of wallpaper', ctx);
    const prompt = lastPrompt();
    expect(prompt).toContain('PRODUCT MATCHES (2):');
    expect(prompt).toContain('Wallpaper - Rs.300');
    expect(prompt).toContain('Wallpaper Premium - Rs.500');
    expect(prompt).toContain('ask which one');
    expect(prompt).not.toContain('PRODUCT MATCH:');
  });

  it('reports a database failure as unavailable, never as product-not-found', async () => {
    const ProductModel = require('../models/Product');
    const u = await makeUser('dbfail@x.com');
    const spy = jest.spyOn(ProductModel, 'find').mockImplementation(() => {
      throw new Error('db down');
    });
    try {
      await chat(u._id.toString(), 'price of wallpaper', ctx);
      const prompt = lastPrompt();
      expect(prompt).toContain('PRODUCT SEARCH FAILED');
      expect(prompt).toContain('does not exist');
      expect(prompt).not.toContain('no active product matched');
    } finally {
      spy.mockRestore();
    }
  });

  it('never exposes store statistics to customers, but allows them for admins', async () => {
    const u = await makeUser('stats@x.com');
    await createProduct({ name: 'WALL Paper', price: 350 });
    await chat(u._id.toString(), 'What is the price of wallpaper?', ctx);
    expect(lastPrompt()).not.toContain('STATS:');
    for (const q of [
      'show me total orders and users',
      'how many orders does the store have?',
      'give me your sales statistics',
      'what is the total revenue of the store?',
    ]) {
      llm.invoke.mockClear();
      await chat(u._id.toString(), q, ctx);
      expect(lastPrompt()).not.toContain('STATS:');
      expect(lastPrompt()).not.toContain('ADMIN:');
    }
    const admin = await User.create({ name: 'AdminStats', email: 'adminstats@x.com', password: 'password123', role: 'admin' });
    llm.invoke.mockClear();
    await chat(admin._id.toString(), 'show me total orders and users', { userName: 'AdminStats', userRole: 'admin' });
    expect(lastPrompt()).toContain('STATS:');
  });

  it('keeps product context for follow-up questions like "What about its stock?"', async () => {
    const u = await makeUser('follow@x.com');
    await createProduct({ name: 'WALL Paper', price: 350, stock: 5 });
    const first = await chat(u._id.toString(), 'What is the price of wallpaper?', ctx);
    await chat(u._id.toString(), 'What about its stock?', ctx, first.conversationId);
    const prompt = lastPrompt();
    expect(prompt).toContain('PRODUCT MATCH:');
    expect(prompt).toContain('WALL Paper');
    expect(prompt).toContain('stock 5');
  });

  it('keeps greetings and chit-chat free of product-search noise', async () => {
    const u = await makeUser('greet@x.com');
    await chat(u._id.toString(), 'hello!', ctx);
    expect(lastPrompt()).not.toContain('PRODUCT SEARCH');
    expect(lastPrompt()).not.toContain('PRODUCT MATCH');
  });

  it('keeps greetings clean even mid-conversation after product questions', async () => {
    const u = await makeUser('greet2@x.com');
    await createProduct({ name: 'WALL Paper', price: 350, stock: 5 });
    const first = await chat(u._id.toString(), 'What is the price of wallpaper?', ctx);
    await chat(u._id.toString(), 'hello!', ctx, first.conversationId);
    const prompt = lastPrompt();
    expect(prompt).not.toContain('PRODUCT SEARCH');
    expect(prompt).toContain('WALL Paper');
    expect(prompt).toContain('Rs.350');
  });

  it('answers cheapest-product questions from live price ordering', async () => {
    const u = await makeUser('cheap@x.com');
    await createProduct({ name: 'Alpha Item', price: 100 });
    await createProduct({ name: 'Beta Item', price: 200 });
    await createProduct({ name: 'Gamma Item', price: 300 });
    await chat(u._id.toString(), 'what is the cheapest product?', ctx);
    const prompt = lastPrompt();
    expect(prompt).toContain('PRICE RANKING');
    const ranking = prompt.slice(prompt.indexOf('PRICE RANKING'));
    expect(ranking.indexOf('Alpha Item - Rs.100')).toBeGreaterThan(-1);
    expect(ranking.indexOf('Alpha Item - Rs.100')).toBeLessThan(ranking.indexOf('Beta Item - Rs.200'));
    expect(ranking.indexOf('Beta Item - Rs.200')).toBeLessThan(ranking.indexOf('Gamma Item - Rs.300'));
  });
});

describe('AI chatbot — greeting intent', () => {
  const ctx = { userName: 'A', userRole: 'customer' };
  const mk = (email) => User.create({ name: 'A', email, password: 'password123', role: 'customer' });

  it('treats "hiii" and greeting variants as greetings, never product searches', async () => {
    const ProductModel = require('../models/Product');
    const spy = jest.spyOn(ProductModel, 'find');
    const u = await mk('greet1@x.com');
    try {
      for (const g of ['hiii', 'hii', 'heyyy', 'hellooo', 'hello', 'hey', 'good morning', 'how are you', 'Hi!!!', 'yo', 'namaste']) {
        spy.mockClear();
        llm.invoke.mockClear();
        await chat(u._id.toString(), g, ctx);
        const prompt = lastPrompt();
        expect(prompt).not.toContain('PRODUCT SEARCH');
        expect(prompt).not.toContain('PRODUCT MATCH');
        expect(prompt).not.toContain('STATS:');
        expect(spy).not.toHaveBeenCalled();
      }
    } finally {
      spy.mockRestore();
    }
  });

  it('still retrieves the real product for "hi, what is the price of wallpaper?"', async () => {
    const u = await mk('greet2@x.com');
    await createProduct({ name: 'WALL Paper', price: 350, stock: 5 });
    await chat(u._id.toString(), 'hi, what is the price of wallpaper?', ctx);
    const prompt = lastPrompt();
    expect(prompt).toContain('PRODUCT MATCH:');
    expect(prompt).toContain('WALL Paper');
    expect(prompt).toContain('Rs.350');
  });

  it('reports product-not-found only for genuine product searches', async () => {
    const u = await mk('greet3@x.com');
    await chat(u._id.toString(), 'hiii', ctx);
    expect(lastPrompt()).not.toContain('no active product matched');
    await chat(u._id.toString(), 'price of quantum flux router', ctx);
    const prompt = lastPrompt();
    expect(prompt).toContain('no active product matched');
    expect(prompt).toContain('quantum flux router');
  });

  it('preserves follow-up product context after a greeting', async () => {
    const u = await mk('greet4@x.com');
    await createProduct({ name: 'WALL Paper', price: 350, stock: 5 });
    const first = await chat(u._id.toString(), 'What is the price of wallpaper?', ctx);
    await chat(u._id.toString(), 'hello!', ctx, first.conversationId);
    const prompt = lastPrompt();
    expect(prompt).not.toContain('PRODUCT SEARCH');
    expect(prompt).toContain('WALL Paper');
    expect(prompt).toContain('Rs.350');
  });
});

describe('AI chatbot — price-range queries', () => {
  const ctx = { userName: 'A', userRole: 'customer' };
  const mk = (email) => User.create({ name: 'A', email, password: 'password123', role: 'customer' });

  it('answers "under Rs.500" from the live catalog without a misleading not-found', async () => {
    const u = await mk('prunder@x.com');
    await createProduct({ name: 'Budget Widget', price: 300, stock: 4 });
    await createProduct({ name: 'Pricey Gadget', price: 900, stock: 4 });
    await chat(u._id.toString(), 'Which products are under Rs.500?', ctx);
    const prompt = lastPrompt();
    expect(prompt).toContain('PRODUCTS UNDER Rs.500');
    expect(prompt).toContain('Budget Widget');
    expect(prompt).not.toContain('Pricey Gadget');
    expect(prompt).not.toContain('no active product matched');
  });

  it('answers "above 5000" from the live catalog', async () => {
    const u = await mk('prabove@x.com');
    await createProduct({ name: 'Budget Widget', price: 300, stock: 4 });
    await createProduct({ name: 'Luxury Item', price: 9000, stock: 2 });
    await chat(u._id.toString(), 'show me products above 5000', ctx);
    const prompt = lastPrompt();
    expect(prompt).toContain('PRODUCTS ABOVE Rs.5000');
    expect(prompt).toContain('Luxury Item');
    expect(prompt).not.toContain('Budget Widget');
    expect(prompt).not.toContain('no active product matched');
  });

  it('states plainly when no product falls in the price range', async () => {
    const u = await mk('prempty@x.com');
    await createProduct({ name: 'Budget Widget', price: 300, stock: 4 });
    await chat(u._id.toString(), 'anything under 50?', ctx);
    const prompt = lastPrompt();
    expect(prompt).toContain('No active products are currently priced under Rs.50');
    expect(prompt).not.toContain('no active product matched');
  });
});
