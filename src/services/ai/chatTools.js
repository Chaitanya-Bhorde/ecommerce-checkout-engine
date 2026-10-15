// Controlled reusable tools for the conversational assistant.
// The LLM decides WHICH tools to call; authz is enforced HERE, never in the prompt.

const Order = require('../../models/Order');
const Product = require('../../models/Product');
const User = require('../../models/User');
const Cart = require('../../models/Cart');
const Wishlist = require('../../models/Wishlist');
const Notification = require('../../models/Notification');
const { getDocumentsByKeywords } = require('./knowledgeBase');

const MAX_LIMIT = 20;

function clampLimit(value, fallback = 5, max = MAX_LIMIT) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, 1), max);
}

function isValidObjectId(id) {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
}

function escapeRx(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function toolGetMyOrders(args, auth) {
  const limit = clampLimit(args.limit, 5);
  const filter = { user: auth.userId };
  if (args.status && typeof args.status === 'string' && args.status.trim()) filter.status = args.status.trim();
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(limit).select('_id total status createdAt items deliveryProgress').lean();
  return { ok: true, orders: orders.map((o) => ({ id: String(o._id), shortId: String(o._id).slice(-8).toUpperCase(), total: o.total, status: o.status, date: o.createdAt, itemCount: Array.isArray(o.items) ? o.items.length : 0 })) };
}

async function toolGetOrderStatus(args, auth) {
  const rawId = args && args.orderId ? String(args.orderId).trim().replace(/^#/, '') : '';
  if (rawId) {
    if (isValidObjectId(rawId)) {
      const order = await Order.findOne({ _id: rawId, user: auth.userId }).select('_id total status createdAt deliveryProgress').lean();
      if (!order) return { ok: false, error: 'ORDER_NOT_FOUND' };
      return { ok: true, order: { id: String(order._id), shortId: String(order._id).slice(-8).toUpperCase(), total: order.total, status: order.status, date: order.createdAt, progress: order.deliveryProgress } };
    }
    const suffix = rawId.toUpperCase();
    const candidates = await Order.find({ user: auth.userId }).sort({ createdAt: -1 }).limit(20).select('_id total status createdAt deliveryProgress').lean();
    const match = candidates.find((o) => String(o._id).slice(-8).toUpperCase() === suffix);
    if (!match) return { ok: false, error: 'ORDER_NOT_FOUND' };
    return { ok: true, order: { id: String(match._id), shortId: suffix, total: match.total, status: match.status, date: match.createdAt, progress: match.deliveryProgress } };
  }
  const latest = await Order.find({ user: auth.userId }).sort({ createdAt: -1 }).limit(1).select('_id total status createdAt deliveryProgress').lean();
  if (!latest.length) return { ok: false, error: 'NO_ORDERS' };
  const o = latest[0];
  return { ok: true, order: { id: String(o._id), shortId: String(o._id).slice(-8).toUpperCase(), total: o.total, status: o.status, date: o.createdAt, progress: o.deliveryProgress } };
}

async function toolSearchProducts(args) {
  const rawQuery = String(args.query || '').trim();
  const limit = clampLimit(args.limit, 8, 20);
  if (!rawQuery) return { ok: false, error: 'EMPTY_QUERY' };
  // Reuse the deterministic catalog matcher (term extraction + normalization)
  // so "wallpaper" matches "WALL Paper" exactly like the rest of the app.
  const { searchProducts, extractProductTerm } = require('./agentTools');
  const mapProducts = (res) => (res.products || []).map((p) => ({ id: String(p.id || p._id), name: p.name, price: p.price, stock: p.stock, category: p.category || 'General' }));
  const res = await searchProducts(rawQuery, Math.min(limit, 10));
  if (!res || !res.success) return { ok: false, error: 'TOOL_FAILED' };
  let products = mapProducts(res);
  // Relaxed fallback: a multi-word paraphrase ("wall covering") may not match a
  // product name ("WALL Paper") as a whole phrase. Retry each significant word
  // and merge unique matches so the answer is still grounded in real rows.
  if (products.length === 0) {
    const term = extractProductTerm(rawQuery) || rawQuery;
    const words = String(term).toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
    const seen = new Set();
    for (const w of words) {
      const r = await searchProducts(w, Math.min(limit, 10));
      if (r && r.success) {
        for (const p of mapProducts(r)) {
          if (!seen.has(p.id)) { seen.add(p.id); products.push(p); }
        }
      }
      if (products.length >= Math.min(limit, 10)) break;
    }
  }
  return { ok: true, query: res.term || rawQuery, products };
}

async function toolGetProductsByPrice(args) {
  const limit = clampLimit(args.limit, 8, 20);
  const filter = { isActive: true };
  if (args.maxPrice !== undefined && args.maxPrice !== null && String(args.maxPrice) !== '' && !Number.isNaN(Number(args.maxPrice))) {
    filter.price = { ...(filter.price || {}), $lte: Number(args.maxPrice) };
  }
  if (args.minPrice !== undefined && args.minPrice !== null && String(args.minPrice) !== '' && !Number.isNaN(Number(args.minPrice))) {
    filter.price = { ...(filter.price || {}), $gte: Number(args.minPrice) };
  }
  const products = await Product.find(filter).sort({ price: 1 }).limit(limit).populate('category', 'name').select('_id name price stock category').lean();
  return { ok: true, products: products.map((p) => ({ id: String(p._id), name: p.name, price: p.price, stock: p.stock, category: p.category?.name || 'General' })) };
}

async function toolGetMyCart(args, auth) {
  const cart = await Cart.findOne({ user: auth.userId }).populate('items.product', 'name price').lean();
  if (!cart || !cart.items || cart.items.length === 0) return { ok: true, empty: true, items: [], total: 0 };
  const items = cart.items.map((it) => ({ name: it.product?.name || 'Item', price: it.price, quantity: it.quantity }));
  const total = items.reduce((s, it) => s + (it.price || 0) * (it.quantity || 0), 0);
  return { ok: true, empty: false, items: items.slice(0, 10), total };
}

async function toolGetMyWishlist(args, auth) {
  const wishlist = await Wishlist.findOne({ user: auth.userId }).populate('items.product', 'name price').lean();
  if (!wishlist || !wishlist.items || wishlist.items.length === 0) return { ok: true, empty: true, items: [] };
  return { ok: true, empty: false, items: wishlist.items.slice(0, 10).map((it) => ({ name: it.product?.name || 'Item', price: it.product?.price ?? null })) };
}

async function toolGetMyAccount(args, auth) {
  const user = await User.findById(auth.userId).select('_id name email role createdAt').lean();
  if (!user) return { ok: false, error: 'ACCOUNT_NOT_FOUND' };
  return { ok: true, account: { name: user.name, email: user.email, role: user.role, memberSince: user.createdAt } };
}

async function toolGetMyNotifications(args, auth) {
  const limit = clampLimit(args.limit, 5, 20);
  const notifs = await Notification.find({ userId: String(auth.userId) }).sort({ createdAt: -1 }).limit(limit).select('title message read createdAt').lean();
  return { ok: true, notifications: notifs.map((n) => ({ title: n.title, message: String(n.message || '').slice(0, 200), read: !!n.read, date: n.createdAt })) };
}

async function toolGetStoreAnalytics(args, auth) {
  if (auth.userRole !== 'admin') return { ok: false, error: 'FORBIDDEN' };
  const [totalOrders, totalProducts, totalUsers, recentOrders, revenueAgg] = await Promise.all([
    Order.countDocuments(), Product.countDocuments({ isActive: true }), User.countDocuments(),
    Order.find().sort({ createdAt: -1 }).limit(5).select('_id total status createdAt').lean(),
    Order.aggregate([{ $group: { _id: null, revenue: { $sum: '$total' } } }]),
  ]);
  return { ok: true, analytics: { totalOrders, totalProducts, totalUsers, revenue: revenueAgg[0]?.revenue || 0, recentOrders: recentOrders.map((o) => ({ id: String(o._id), shortId: String(o._id).slice(-8).toUpperCase(), total: o.total, status: o.status, date: o.createdAt })) } };
}

async function toolGetUserOrders(args, auth) {
  if (auth.userRole !== 'admin') return { ok: false, error: 'FORBIDDEN' };
  const limit = clampLimit(args.limit, 5, 20);
  let targetUserId = null;
  if (args.userId && isValidObjectId(String(args.userId))) {
    targetUserId = String(args.userId);
  } else if (args.userName && String(args.userName).trim()) {
    // Resolve an ambiguous name server-side; if several match, return them so the
    // assistant can ask which one instead of guessing.
    const rx = new RegExp(escapeRx(String(args.userName).trim()), 'i');
    const matches = await User.find({ name: rx }).select('_id name email role').limit(5).lean();
    if (matches.length === 0) return { ok: false, error: 'USER_NOT_FOUND' };
    if (matches.length > 1) {
      return { ok: true, ambiguous: true, users: matches.map((u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role })) };
    }
    targetUserId = String(matches[0]._id);
  }
  if (!targetUserId) return { ok: false, error: 'USER_NOT_FOUND' };

  const user = await User.findById(targetUserId).select('_id name email role').lean();
  if (!user) return { ok: false, error: 'USER_NOT_FOUND' };

  const filter = { user: targetUserId };
  if (args.status && typeof args.status === 'string' && args.status.trim()) filter.status = args.status.trim();
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(limit)
    .select('_id total status createdAt deliveryProgress items').lean();

  // Resolve relationships using the actual order items -> product references so
  // the answer reflects products actually purchased, not catalog guesses.
  const productIds = [...new Set(orders.flatMap((o) => (o.items || []).map((it) => String(it.product))))];
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } }).select('name price').lean()
    : [];
  const productById = new Map(products.map((p) => [String(p._id), p]));

  return {
    ok: true,
    user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
    orders: orders.map((o) => ({
      id: String(o._id),
      shortId: String(o._id).slice(-8).toUpperCase(),
      total: o.total,
      status: o.status,
      date: o.createdAt,
      products: (o.items || []).map((it) => {
        const p = productById.get(String(it.product));
        return { name: p ? p.name : 'Product no longer in catalog', quantity: it.quantity, price: it.price };
      }),
    })),
  };
}

async function toolListUsers(args, auth) {
  if (auth.userRole !== 'admin') return { ok: false, error: 'FORBIDDEN' };
  const limit = clampLimit(args.limit, 5, 20);
  const filter = {};
  if (args.search && String(args.search).trim()) {
    const rx = new RegExp(escapeRx(String(args.search).trim()), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(limit).select('_id name email role createdAt').lean();
  return { ok: true, users: users.map((u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, registeredAt: u.createdAt })) };
}

async function toolGetAppHelp(args) {
  const topic = String((args && args.topic) || 'help').slice(0, 200);
  const docs = getDocumentsByKeywords(topic).slice(0, 3);
  return { ok: true, topic, articles: docs.map((d) => ({ id: d.id, content: d.content })) };
}

const TOOL_DEFINITIONS = [
  { name: 'get_my_orders', description: 'List the authenticated user OWN orders (newest first). Use for my orders, order history, latest order.', args: { limit: 'number 1-20', status: 'optional status string' } },
  { name: 'get_order_status', description: 'Status of ONE of the authenticated user own orders. Omit orderId for the latest order. Use for follow-ups like latest one / that order.', args: { orderId: 'optional full id or short suffix' } },
  { name: 'search_products', description: 'Search the live active product catalog by keywords. Use for prices, availability, categories, do you sell X.', args: { query: 'keywords', limit: 'optional' } },
  { name: 'get_products_by_price', description: 'Filter active products by price range. Use for under Rs.500, above 5000, cheapest.', args: { maxPrice: 'optional number', minPrice: 'optional number', limit: 'optional' } },
  { name: 'get_my_cart', description: 'Authenticated user cart lines and total.', args: {} },
  { name: 'get_my_wishlist', description: 'Authenticated user wishlist.', args: {} },
  { name: 'get_my_account', description: 'Authenticated user own profile.', args: {} },
  { name: 'get_my_notifications', description: 'Authenticated user own recent notifications.', args: { limit: 'optional' } },
  { name: 'get_store_analytics', description: 'ADMIN ONLY store totals, revenue, and the most recent orders. Use for store-wide / latest orders questions.', args: {} },
  { name: 'list_users', description: 'ADMIN ONLY registered users (no passwords). Use to look up users or show the latest registered users, not for exact totals (use get_store_analytics for exact counts).', args: { limit: 'optional', search: 'optional filter' } },
  { name: 'get_user_orders', description: 'ADMIN ONLY a specific customer orders with the products they bought. Use when asked what products a named/identified user ordered, including follow-ups like "that user" / "the latest user" when a user was just discussed. Resolve ambiguous names server-side.', args: { userId: 'optional id', userName: 'optional name', limit: 'optional' } },
  { name: 'get_app_help', description: 'How the app works: policies, shipping, payments, returns, features, how-to.', args: { topic: 'topic' } },
];

const TOOL_HANDLERS = { get_my_orders: toolGetMyOrders, get_order_status: toolGetOrderStatus, search_products: toolSearchProducts, get_products_by_price: toolGetProductsByPrice, get_my_cart: toolGetMyCart, get_my_wishlist: toolGetMyWishlist, get_my_account: toolGetMyAccount, get_my_notifications: toolGetMyNotifications, get_store_analytics: toolGetStoreAnalytics, list_users: toolListUsers, get_user_orders: toolGetUserOrders, get_app_help: toolGetAppHelp };

async function executeChatTool(name, args, auth) {
  const handler = TOOL_HANDLERS[name];
  if (!handler) return { ok: false, error: 'UNKNOWN_TOOL' };
  if (!auth || !auth.userId) return { ok: false, error: 'UNAUTHENTICATED' };
  try {
    return await handler(args || {}, { userId: String(auth.userId), userRole: auth.userRole || 'customer' });
  } catch (err) {
    if (process.env.DEBUG_AI === 'true') console.error('[ChatTools] failed:', name, err.message);
    return { ok: false, error: 'TOOL_FAILED' };
  }
}

module.exports = { TOOL_DEFINITIONS, TOOL_HANDLERS, executeChatTool };


