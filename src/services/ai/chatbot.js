// AI Chatbot Service - Handles customer support conversations
// Uses Groq (FREE, FAST) for intelligent responses
// NOW WITH REAL DATABASE DATA + PER-USER PERSONALIZATION!

const { llm, getLLM, AI_PROVIDER, callLLM } = require('./llmConfig');
const vectorStore = require('./vectorStore');
const { runAgent } = require('./agentWorkflow');
const { searchProducts: searchCatalogProducts } = require('./agentTools');
const { executeChatTool, TOOL_DEFINITIONS, TOOL_HANDLERS } = require('./chatTools');
const { getAllDocuments } = require('./knowledgeBase');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const User = require('../../models/User');
const Cart = require('../../models/Cart');
const Wishlist = require('../../models/Wishlist');
const Notification = require('../../models/Notification');
const Conversation = require('../../models/Conversation');
const ChatMessage = require('../../models/ChatMessage');
const SupportTicket = require('../../models/SupportTicket');

function debugLog(...args) {
  if (process.env.DEBUG_AI === 'true') console.log(...args);
}

async function getUserOrders(userId, limit = 5) {
  if (!userId || !/^[0-9a-fA-F]{24}$/.test(String(userId))) return [];
  const lim = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 20);
  // Errors propagate on purpose: callers must be able to distinguish a failed
  // query from a genuinely empty result ("no orders" must never be fabricated
  // out of a database failure).
  const orders = await Order.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(lim)
    .select('_id total status createdAt items deliveryProgress')
    .populate('items.product', 'name price category')
    .lean();

  // Map orders with detailed item information including categories
  return orders.map(order => ({
    id: order._id,
    total: order.total,
    status: order.status,
    progress: order.deliveryProgress,
    date: order.createdAt,
    items: order.items.length,
    itemDetails: order.items.map(item => ({
      name: item.product?.name || 'Unknown Product',
      price: item.price,
      quantity: item.quantity,
      category: item.product?.category?.name || 'General',
    }))
  }));
}

async function getLatestUser(limit = 5) {
  // Errors propagate on purpose: a failed query must never be reported as
  // "no registered users found".
  const users = await User.find()
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(parseInt(limit, 10) || 5, 1), 20))
    .select('_id name email role createdAt')
    .lean();

  return users.map((u) => ({
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    registeredAt: u.createdAt,
  }));
}

async function getLatestOrders(userId = null, limit = 5) {
  try {
    const filter = userId ? { user: userId } : {};
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(parseInt(limit, 10) || 5, 1), 20))
      .select('_id total status createdAt deliveryProgress')
      .lean();

    return orders.map((o) => ({
      id: o._id,
      number: `#${o._id.slice(-8).toUpperCase()}`,
      total: o.total,
      status: o.status,
      progress: o.deliveryProgress,
      date: o.createdAt,
      customerId: o.user,
      customerName: null,
    }));
  } catch (error) {
    console.error('Error fetching latest orders:', error);
    return [];
  }
}

async function getLatestOrder(userId = null, limit = 5) {
  const orders = await getLatestOrders(userId, limit);
  return orders[0] || null;
}

async function getProductRecommendations(query = '', limit = 12) {
  try {
    const q = String(query || '').trim();
    const filter = { isActive: true, stock: { $gt: 0 } };
    if (q) filter.$text = { $search: q };
    let products = [];
    try {
      products = await Product.find(filter)
        .populate('category', 'name')
        .sort(filter.$text ? undefined : { createdAt: -1 })
        .limit(Math.min(Math.max(limit, 1), 20))
        .select('name price images category stock description')
        .lean();
    } catch (_) {
      products = [];
    }
    if (!products.length && q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      products = await Product.find({ isActive: true, stock: { $gt: 0 }, $or: [{ name: rx }, { description: rx }] })
        .populate('category', 'name')
        .sort({ createdAt: -1 })
        .limit(Math.min(Math.max(limit, 1), 20))
        .select('name price images category stock description')
        .lean();
    }
    if (!products.length && !q) {
      products = await Product.find({ isActive: true, stock: { $gt: 0 } })
        .populate('category', 'name')
        .sort({ createdAt: -1 })
        .limit(Math.min(Math.max(limit, 1), 20))
        .select('name price images category stock description')
        .lean();
    }
    return products.map(product => ({
      id: product._id,
      name: product.name,
      price: product.price,
      category: product.category?.name || 'General',
      stock: product.stock,
      image: product.images?.[0] || null,
    }));
  } catch (error) {
    return [];
  }
}

const GREETING_PHRASES = [
  'hi', 'hey', 'hello', 'yo', 'howdy', 'hiya', 'heya', 'sup', 'hola', 'namaste',
  'hi there', 'hey there', 'hello there',
  'good morning', 'good afternoon', 'good evening', 'good day', 'good night',
  'morning', 'evening',
  'how are you', 'how are you doing', 'how you doing', 'hows it going', 'how is it going',
  'whats up', 'what up', 'how do you do', 'nice to meet you', 'pleased to meet you',
];

function collapseRepeatedLetters(value) {
  return String(value || '').replace(/(.)\1+/g, '$1');
}

const GREETING_SET = new Set(GREETING_PHRASES.map(collapseRepeatedLetters));

function detectGreeting(message) {
  const cleaned = String(message || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return false;
  return GREETING_SET.has(collapseRepeatedLetters(cleaned));
}

function parsePriceFilter(message) {
  const t = String(message || '')
    .toLowerCase()
    .replace(/₹/g, ' rs ')
    .replace(/(\d),(?=\d{3}\b)/g, '$1');
  const num = '(?:rs\\.?|inr)?\\s*(\\d+(?:\\.\\d+)?)';
  const under = t.match(new RegExp('(?:under|below|less than|upto|up to|within|max|maximum|cheaper than|no more than|not more than)\\s*' + num));
  if (under) return { op: 'lte', amount: Number(under[1]) };
  const above = t.match(new RegExp('(?:above|over|more than|greater than|at least|minimum)\\s*' + num));
  if (above) return { op: 'gte', amount: Number(above[1]) };
  const orLess = t.match(new RegExp(num + '\\s*or less'));
  if (orLess) return { op: 'lte', amount: Number(orLess[1]) };
  const orMore = t.match(new RegExp(num + '\\s*or more'));
  if (orMore) return { op: 'gte', amount: Number(orMore[1]) };
  return null;
}

const INTENT_KINDS = [
  'greeting', 'capabilities', 'app_info', 'admin_users', 'admin_stats',
  'admin_orders', 'product', 'order', 'cart', 'wishlist', 'notifications',
  'account', 'policy', 'general',
];

function classifyIntent(message, historyTexts = []) {
  const raw = String(message || '');
  const t = raw.toLowerCase().trim();
  if (!t) return { kind: 'general', confidence: 'low' };
  if (detectGreeting(raw)) return { kind: 'greeting', confidence: 'high' };
  const has = (...words) => words.some((w) => t.includes(w));
  const rx = (re) => re.test(t);

  if (rx(/\bwhat can you do\b|\bwhat do you do\b|\bhow can you help\b|\byour (features|abilities|capabilities)\b|\bhelp me\b.*\bwhat\b|\blist .*you can do\b/)) {
    return { kind: 'capabilities', confidence: 'high' };
  }
  if (rx(/\b(la?test|latest|lastest|letest|newest|recent)\b.{0,20}\busers?\b|\ball users\b|\blist (of )?users\b|\bshow\b.{0,30}\busers\b|\bhow many users\b|\btotal users\b|\bregistered (users|customers)\b|\bcustomers?\b.{0,20}\blist\b/)) {
    return { kind: 'admin_users', confidence: 'high' };
  }
  if (rx(/\b(is there|are there|any)\b.{0,30}\busers?\b/)) {
    return { kind: 'admin_users', confidence: 'medium' };
  }
  if (rx(/\bdashboard\b|\brevenue\b|\banalytics?\b|\bstatistics?\b|\bpopular products?\b|\btotal\b\s+(orders|products|users|customers|sales)\b|\bhow many\b\s+(orders|products|customers|sales)\b|\border summar|\bsales report\b/)) {
    if (rx(/\border\b/) && rx(/\bmy\b|\bmy order\b|\btrack\b|\bwhere is\b/)) {
      return { kind: 'order', confidence: 'high' };
    }
    return { kind: 'admin_stats', confidence: 'high' };
  }
  if (rx(/\bwhat\b.{0,30}\b(this|your|the)\b.{0,30}\b(app|application|website|store|shopease)\b|\bwhat does\b.{0,30}\b(app|application|store|website|shopease)\b|\babout\b.{0,20}\b(app|store|shopease)\b|\bhow does\b.{0,20}\b(this|the)\b.{0,20}\b(app|store)\b.*\bwork\b/)) {
    return { kind: 'app_info', confidence: 'high' };
  }
  const productSignal = has('product', 'price', 'cost', 'cheap', 'expensive', 'budget', 'premium', 'stock', 'available', 'categor', 'recommend', 'suggest', 'looking for', 'wallpaper')
    || rx(/\bhow much\b|\bunder\b|\bbelow\b|\babove\b|\bcheapest\b|\bmost expensive\b|\bleast expensive\b|\bcostliest\b|\bor less\b|\bor more\b/)
    || rx(/\bshow me\b|\bfind\b/) && rx(/\bprice\b|\bproduct\b|\bstock\b|\bavailab\b|\bcategor\b|\bcheap\b|\bexpensive\b|\bbudget\b|\brecommend\b|\bsuggest\b/);
  const productNameQuery = rx(/\bprice of\b|\bcost of\b|\bhow much (is|does)\b/);
  if (productSignal || productNameQuery) {
    return { kind: 'product', confidence: productNameQuery || has('price', 'product') ? 'high' : 'medium' };
  }
  if (rx(/\bshow me\b|\bfind\b|\bsearch\b|\blooking for\b|\brecommend\b|\bsuggest\b/) && !rx(/\buser\b|\border\b|\bcart\b|\bwishlist\b/)) {
    const followHints = historyTexts.slice(-3).join(' ').toLowerCase();
    if (rx(/\b(price|product|buy|shop|stock|categor)\b/) || /product|price|stock/.test(followHints)) {
      return { kind: 'product', confidence: 'low' };
    }
  }
  if (has('cart', 'basket', 'checkout total', 'my total')) return { kind: 'cart', confidence: 'high' };
  if (has('wishlist', 'wish list', 'saved item', 'favorite', 'favourite')) return { kind: 'wishlist', confidence: 'high' };
  if (has('notif', 'unread', 'alert', 'message from')) return { kind: 'notifications', confidence: 'high' };
  if (has('account', 'profile', 'my email', 'my name', 'who am i')) return { kind: 'account', confidence: 'high' };
  if (has('order', 'track', 'deliver', 'cancel', 'receipt') || rx(/\bmy\b.{0,20}\border\b|\border\b.{0,20}\bstatus\b|\bstatus\b.{0,20}\border\b|\bwhere is my\b|\border history\b|\bmy latest order\b|\bpayment\b.*\border\b|\brefund\b.*\border\b|\breturn\b.*\border\b/)) {
    return { kind: 'order', confidence: 'high' };
  }
  if (rx(/\b(status|track|payment|refund|return|cancel)\b/) && rx(/\border\b|\bmy\b|\blatest\b|\bpackage\b|\bparcel\b/)) {
    return { kind: 'order', confidence: 'medium' };
  }
  if (has('policy', 'policies', 'shipping', 'warranty', 'support hour', 'contact', 'how do i', 'how to', 'cash on delivery', 'cod')) {
    return { kind: 'policy', confidence: 'medium' };
  }
  if (rx(/\border summar\b|\brecent orders\b|\ball orders\b/) && !rx(/\bmy\b/)) {
    return { kind: 'admin_orders', confidence: 'medium' };
  }
  // Bare catalog-style queries ("wallpaper", "wall paper", "red shoes") carry
  // no other intent signal. Treat short noun phrases as low-confidence product
  // lookups so they get a real DB search instead of a generic fallback. This is
  // only the deterministic fallback (the LLM tool planner is the primary router);
  // it is guarded against courtesy/social phrases so chit-chat like "thanks, have
  // a great day!" is never misrouted into a product search.
  const SOCIAL_CHITCHAT = /(\bthanks?\b|\bthank you\b|\bthx\b|\bappreciate\b|\byou'?re welcome\b|\bno worries\b|\bmy pleasure\b|\bbye\b|\bgoodbye\b|\bgood ?night\b|\bsee you\b|\btake care\b|\btalk (later|soon)\b|\bhave a (good|great|nice|wonderful|lovely|awesome)\b|\b(great|good|nice|lovely|wonderful) day\b|\bsame to you\b|\byou too\b)/i;
  if (t.length <= 40 && !SOCIAL_CHITCHAT.test(raw)) {
    try {
      const { extractProductTerm } = require('./agentTools');
      if (extractProductTerm(raw)) {
        return { kind: 'product', confidence: 'low' };
      }
    } catch (_) { /* fall through to general */ }
  }
  return { kind: 'general', confidence: 'low' };
}

function isFollowUpMessage(message) {
  const t = String(message || '').toLowerCase().trim();
  if (!t) return false;
  if (t.length > 120) return false;
  return /\b(it|its|that|this|these|those|them|more|also|and\b.*\b(price|stock|it|that))\b|\btell me more\b|\bwhat about\b|\bhow about\b|\band\b/.test(t);
}

function intentToFlags(classified, message) {
  const kind = classified && classified.kind ? classified.kind : 'general';
  const flags = {
    needsOrders: false, needsProducts: false, needsCart: false,
    needsWishlist: false, needsNotifications: false, needsAccount: false,
    needsAdmin: false, needsPolicy: false, wantsAllOrders: false, wantsStats: false, greeting: false,
    kind,
  };
  const t = String(message || '').toLowerCase();
  if (kind === 'greeting') flags.greeting = true;
  else if (kind === 'product') flags.needsProducts = true;
  else if (kind === 'order') {
    flags.needsOrders = true;
    if (/\ball\b.*\border|\border\b.*\bhistory\b|all my orders|complete history|every order|all of them/.test(t)) flags.wantsAllOrders = true;
  }
  else if (kind === 'cart') flags.needsCart = true;
  else if (kind === 'wishlist') flags.needsWishlist = true;
  else if (kind === 'notifications') flags.needsNotifications = true;
  else if (kind === 'account') { flags.needsAccount = true; flags.needsOrders = true; }
  else if (kind === 'admin_users' || kind === 'admin_stats' || kind === 'admin_orders') {
    flags.needsAdmin = true;
    if (kind === 'admin_stats') flags.wantsStats = true;
    if (kind === 'admin_orders') flags.wantsAllOrders = true;
  }
  else if (kind === 'policy' || kind === 'app_info' || kind === 'capabilities') flags.needsPolicy = true;
  return flags;
}

function detectIntent(message) {
  return intentToFlags(classifyIntent(message, []), message);
}

async function getDatabaseStats() {
  try {
    const [totalOrders, totalProducts, totalUsers, statusCounts] = await Promise.all([
      Order.countDocuments(),
      Product.countDocuments({ isActive: true }),
      User.countDocuments(),
      Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
    ]);
    
    const statusMap = {};
    statusCounts.forEach(s => { statusMap[s._id] = s.count; });
    
    return { 
      totalOrders, 
      totalProducts, 
      totalUsers, 
      cancelledOrders: statusMap['cancelled'] || 0, 
      deliveredOrders: statusMap['delivered'] || 0, 
      pendingOrders: (statusMap['pending'] || 0) + (statusMap['confirmed'] || 0) + (statusMap['processing'] || 0) + (statusMap['shipped'] || 0) + (statusMap['out_for_delivery'] || 0),
      statusBreakdown: statusMap // Full breakdown of all statuses
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    // Return null (not zeros) so callers can distinguish a failed query from
    // an empty store; zeros here would be reported as fabricated "0 users".
    return null;
  }
}

/**
 * Get popular products analytics for admin
 */
async function getPopularProducts(limit = 10) {
  try {
    // Aggregate orders to find most ordered products
    const popularProducts = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.price' },
          orderCount: { $sum: 1 },
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          productId: '$_id',
          name: '$product.name',
          category: '$product.category',
          totalQuantity: 1,
          totalRevenue: 1,
          orderCount: 1,
        }
      }
    ]);

    return popularProducts;
  } catch (error) {
    console.error('Error fetching popular products:', error);
    return [];
  }
}

/**
 * Get category-wise sales analytics
 */
async function getCategoryAnalytics() {
  try {
    const categoryStats = await Order.aggregate([
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'product',
        }
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'categories',
          localField: 'product.category',
          foreignField: '_id',
          as: 'category',
        }
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category.name',
          totalSales: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.price' },
        }
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    return categoryStats;
  } catch (error) {
    console.error('Error fetching category analytics:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// LLM tool planner (reusable, tool-driven reasoning layer)
//
// Instead of hardcoding a keyword rule per question, the model first decides
// WHICH backend operation(s) a message needs and returns a compact JSON plan.
// Those tools run real, authorized database queries (chatTools.js enforces
// ownership + admin checks server-side). The answer is then grounded in the
// live results. If the planner decides no live data is needed (greetings,
// chit-chat, general knowledge) it returns {"calls":[]} and we fall back to the
// deterministic keyword grounding below, preserving existing behaviour.
// ---------------------------------------------------------------------------

const PLANNER_SYSTEM_PREFIX = 'Route a shopping-assistant request';

function buildPlannerPrompt(userName, userRole) {
  const toolList = TOOL_DEFINITIONS.map(
    (t) => `- ${t.name}(${Object.keys(t.args).join(', ') || 'no args'}): ${t.description}`
  ).join('\n');
  return `${PLANNER_SYSTEM_PREFIX} to the right backend tool(s), or decide none are needed.

You are the tool planner for an e-commerce shopping assistant. Read the user's message (and the recent conversation for follow-ups) and choose which backend tool(s) must run to answer factually.

User: ${userName} (role: ${userRole}). Only choose admin tools (get_store_analytics, list_users, get_user_orders) when role is admin; the backend still enforces this regardless.

Available tools:
${toolList}

Rules:
- Return ONLY compact JSON, no prose and no code fences: {"calls":[{"tool":"<name>","args":{...}}]}
- Use {"calls":[]} for greetings, chit-chat, general/technical knowledge, or anything that needs no live application data.
- Resolve follow-ups ("the latest one", "that order", "its price", "how many were delivered") using the conversation. For a single-order follow-up prefer get_order_status with no orderId (it resolves to the latest order).
- "that user" / "the latest user" / "the new user" means the most recent USER discussed in the conversation: for admins, call get_user_orders with that user's name from the conversation.
- When a tool needs an argument the conversation already contains (a user's name, a product name), copy it into args; never send empty strings or null.
- If a customer asks about ANOTHER user's private data, still call the relevant tool with that name; the backend enforces access and returns a refusal the assistant must relay.
- For exact counts or store totals use get_store_analytics; list_users returns only a limited list of users.
- Choose tools by MEANING, not exact words; handle paraphrases ("where is my package" -> get_my_orders).
- For admins, "the latest/recent orders" (store-wide) means get_store_analytics; get_my_orders is only for the user's OWN orders.
- Never invent tool names or args. Keep at most 3 calls.`;
}

function parseToolPlan(text) {
  try {
    const cleaned = String(text || '').replace(/```json|```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return { calls: [] };
    const parsed = JSON.parse(match[0]);
    const calls = Array.isArray(parsed.calls) ? parsed.calls : [];
    const valid = calls
      .filter((c) => c && typeof c.tool === 'string' && TOOL_HANDLERS[c.tool])
      .slice(0, 3)
      .map((c) => ({ tool: c.tool, args: c.args && typeof c.args === 'object' ? c.args : {} }));
    return { calls: valid };
  } catch (_) {
    return { calls: [] };
  }
}

async function planToolCalls(message, history, userName, userRole) {
  const system = buildPlannerPrompt(userName, userRole);
  const recent = history
    .slice(-6)
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 300) }));
  const res = await llm.invoke(
    [{ role: 'system', content: system }, ...recent, { role: 'user', content: message }],
    // Reasoning models (gpt-oss) spend tokens on hidden reasoning before the
    // final JSON; a 200-token budget sometimes left the content EMPTY, which
    // silently degraded routing to the legacy keyword fallback. Routing must
    // also be deterministic (temperature 0), or the same question randomly
    // plans no tools run-to-run.
    { maxTokens: 1024, timeout: 8000, temperature: 0 }
  );
  return parseToolPlan(res && res.content);
}

async function runPlannedTools(calls, auth, message) {
  const results = [];
  const seen = new Set();
  for (const call of calls.slice(0, 3)) {
    let tool = call.tool;
    const args = { ...(call.args || {}) };
    // Verified defect guard: with several order-heavy turns in history the
    // planner occasionally routes an admin's store-wide "latest/recent orders"
    // question to get_my_orders (the admin's own, usually empty list), which was
    // then reported as "no orders in the system" despite real store orders.
    // Upgrade exactly that case to the store-wide tool. Authorization-neutral:
    // both tools are admin-safe here, and a customer's get_my_orders is untouched.
    if (
      tool === 'get_my_orders' &&
      auth && auth.userRole === 'admin' &&
      /\b(latest|recent|newest|last)\b/i.test(String(message || '')) &&
      /\borders?\b/i.test(String(message || '')) &&
      !/\b(my|mine|our|ours)\b/i.test(String(message || ''))
    ) {
      tool = 'get_store_analytics';
    }
    const key = `${tool}:${JSON.stringify(args)}`;
    if (seen.has(key)) continue; // prevent duplicate identical tool calls
    seen.add(key);
    // Free-text tools default their query/topic to the user's message when the
    // planner omits it, so paraphrases still reach the catalog/help search.
    if (tool === 'search_products' && !args.query) args.query = message;
    if (tool === 'get_app_help' && !args.topic) args.topic = message;
    const result = await executeChatTool(tool, args, auth);
    results.push({ tool, args, result });
  }
  return results;
}


// Convert executed tool results into grounding text for the answer prompt.
// Tool output is treated strictly as data, never as instructions.
function formatToolResults(results) {
  let out = '';
  for (const { tool, result } of results) {
    if (!result || result.ok === false) {
      const err = result && result.error;
      if (err === 'FORBIDDEN') {
        out += `\nACCESS DENIED: that information is restricted to administrators. Politely refuse and offer to help with the user's own orders, cart, wishlist, or product questions instead. Do not reveal any data.`;
      } else if (err === 'ORDER_NOT_FOUND') {
        out += `\nORDER: no such order was found for this user. Say you could not find that order.`;
      } else if (err === 'USER_NOT_FOUND') {
        out += `\nNo customer matched that name or id. Ask the user to clarify which customer they mean. Do not invent a customer.`;
      } else if (err === 'NO_ORDERS') {
        out += `\nNOTE: this user has no orders yet. Say so plainly.`;
      } else if (err === 'TOOL_FAILED') {
        out += `\nSERVICE UNAVAILABLE: a live lookup failed just now. Tell the user you could not retrieve that right now and to try again shortly. Do not invent any data.`;
      } else {
        out += `\nNo data available for ${tool}. Say so plainly rather than guessing.`;
      }
      continue;
    }
    switch (tool) {
      case 'get_my_orders': {
        const orders = result.orders || [];
        if (!orders.length) { out += `\nNOTE: this user has no orders yet. Say so plainly.`; break; }
        out += `\nYOUR ORDERS (newest first):`;
        orders.slice(0, 5).forEach((o) => {
          out += `\n#${String(o.id).slice(-8)} Rs.${o.total} ${o.status} (${o.itemCount} items, ${o.date ? new Date(o.date).toLocaleDateString() : 'unknown date'})`;
        });
        break;
      }
      case 'get_order_status': {
        const o = result.order;
        out += `\nORDER #${String(o.id).slice(-8)}: status ${o.status}, total Rs.${o.total}, placed ${o.date ? new Date(o.date).toLocaleDateString() : 'unknown date'}.`;
        break;
      }
      case 'search_products': {
        const products = result.products || [];
        if (!products.length) {
          out += `\nPRODUCT SEARCH: no active product matched "${result.query || ''}". Say you could not find that product in the catalog and suggest rephrasing or browsing the Products page. Never invent a product or price.`;
          break;
        }
        if (products.length === 1) {
          const m = products[0];
          out += `\nPRODUCT MATCH: ${m.name} - price Rs.${m.price}, stock ${m.stock} units, category ${m.category}, id ${m.id}. Answer the user's question using exactly these facts.`;
        } else {
          out += `\nPRODUCT MATCHES (${products.length}):`;
          products.slice(0, 5).forEach((m) => { out += `\n${m.name} - Rs.${m.price} (stock ${m.stock}, ${m.category})`; });
          out += `\nMultiple products match. List these options with prices and ask which one the user means. Do not invent.`;
        }
        break;
      }
      case 'get_products_by_price': {
        const products = result.products || [];
        if (!products.length) { out += `\nNo active products match that price range. Say so plainly and suggest browsing the Products page.`; break; }
        out += `\nPRODUCTS IN PRICE RANGE (use exactly these):`;
        products.slice(0, 8).forEach((p) => { out += `\n${p.name} - Rs.${p.price} (${p.category}, ${p.stock} in stock)`; });
        break;
      }
      case 'get_my_cart': {
        if (result.empty) { out += `\nCART: empty.`; break; }
        out += `\nCART: ${result.items.length} lines, total Rs.${result.total}.`;
        result.items.slice(0, 5).forEach((it) => { out += `\n${it.name} x${it.quantity} Rs.${it.price}`; });
        break;
      }
      case 'get_my_wishlist': {
        if (result.empty) { out += `\nWISHLIST: empty.`; break; }
        out += `\nWISHLIST (${result.items.length}):`;
        result.items.slice(0, 5).forEach((it) => { out += `\n${it.name} Rs.${it.price == null ? '' : it.price}`; });
        break;
      }
      case 'get_my_account': {
        const a = result.account;
        out += `\nACCOUNT: ${a.name} <${a.email}> role=${a.role}, member since ${a.memberSince ? new Date(a.memberSince).toLocaleDateString() : 'unknown'}.`;
        break;
      }
      case 'get_my_notifications': {
        const n = result.notifications || [];
        if (!n.length) { out += `\nNOTIFICATIONS: none.`; break; }
        out += `\nNOTIFICATIONS (${n.length} recent):`;
        n.slice(0, 3).forEach((x) => { out += `\n${x.title}: ${String(x.message).slice(0, 120)}`; });
        break;
      }
      case 'get_store_analytics': {
        const a = result.analytics;
        out += `\nSTATS: orders=${a.totalOrders} products=${a.totalProducts} users=${a.totalUsers} revenue=Rs.${a.revenue}`;
        if (a.recentOrders && a.recentOrders.length) {
          out += `\nRECENT ORDERS:`;
          a.recentOrders.slice(0, 5).forEach((o) => { out += `\n#${String(o.id).slice(-8)} Rs.${o.total} ${o.status}`; });
        }
        break;
      }
      case 'get_user_orders': {
        if (result.ambiguous) {
          out += `\nSeveral users match that name. Ask which one: ${(result.users || []).map((u) => `${u.name} <${u.email}>`).join('; ')}. Do not guess.`;
          break;
        }
        const u = result.user;
        const orders = result.orders || [];
        if (!orders.length) { out += `\nNOTE: ${u.name} has no orders yet. Say so plainly.`; break; }
        out += `\nORDERS FOR ${u.name} <${u.email}> (newest first):`;
        orders.slice(0, 5).forEach((o) => {
          const prods = (o.products || []).map((p) => `${p.name} x${p.quantity} (Rs.${p.price})`).join(', ');
          out += `\n#${String(o.id).slice(-8)} Rs.${o.total} ${o.status} (${o.date ? new Date(o.date).toLocaleDateString() : 'unknown date'}): ${prods || 'no items'}`;
        });
        break;
      }
      case 'list_users': {
        const users = result.users || [];
        if (!users.length) { out += `\nNo registered users were found in the database. Say so plainly.`; break; }
        out += `\nREGISTERED USERS (newest first; names and signup dates only, never credentials):`;
        users.slice(0, 5).forEach((u) => {
          out += `\n${u.name} <${u.email}> role=${u.role} joined ${u.registeredAt ? new Date(u.registeredAt).toLocaleDateString() : 'unknown date'}`;
        });
        break;
      }
      case 'get_app_help': {
        const arts = result.articles || [];
        if (!arts.length) { out += `\nNo help article matched. Answer generally about the app or ask a clarifying question. Do not claim an unavailable feature.`; break; }
        out += `\nHELP ARTICLES:`;
        arts.forEach((d) => { out += `\n${String(d.content).slice(0, 400)}`; });
        break;
      }
      default:
        break;
    }
  }
  return out;
}


// A client-supplied conversation id is only honored when the conversation
// exists AND belongs to the authenticated user. This prevents reading another
// user's chat history into the model context or appending messages to it.
async function resolveOwnedConversationId(conversationId, userId) {
  const id = String(conversationId || '');
  if (!/^[0-9a-fA-F]{24}$/.test(id)) return null;
  const owned = await Conversation.findOne({ _id: id, userId: String(userId) })
    .select('_id')
    .lean();
  return owned ? id : null;
}

async function chat(userId, message, context = {}, conversationId = null) {
  const userName = context.userName || 'Customer';
  const userEmail = context.userEmail || '';
  const userRole = context.userRole || 'customer';
  const normalizedUserId = String(userId);

  debugLog(`[Chatbot] Processing message for user ${userName} (${normalizedUserId})`);
  debugLog(`[Chatbot] LLM has invoke: ${typeof llm.invoke}`);
  
  let currentConversationId;

  try {
    currentConversationId = await resolveOwnedConversationId(conversationId, normalizedUserId);
    if (!currentConversationId) {
      // Create new conversation with auto-generated title
      const title = message.substring(0, 40) + (message.length > 40 ? '...' : '');
      const conversation = await Conversation.create({
        userId: normalizedUserId,
        title: title,
      });
      currentConversationId = conversation._id;
    }

    const historyMessages = await ChatMessage.find({ conversationId: currentConversationId })
      .sort({ timestamp: 1 })
      .limit(10)
      .lean();
    const history = historyMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    const historyTexts = history.map((msg) => String(msg.content || ''));

    // ---- LLM tool planner (primary reasoning layer) ----
    // The model first decides which backend operation(s) this message needs and
    // returns a compact JSON plan. Planned tools run real, authorized DB queries
    // and ground the answer. When no live data is needed the planner returns an
    // empty plan and we fall back to the deterministic keyword grounding below,
    // preserving existing behaviour. A planner failure also falls back safely.
    let toolPlan = { calls: [] };
    try {
      toolPlan = await planToolCalls(message, history, userName, userRole);
    } catch (planErr) {
      if (process.env.DEBUG_AI === 'true') console.error('[Chatbot] planner failed:', planErr.message);
      toolPlan = { calls: [] };
    }

    let systemPrompt;
    if (toolPlan.calls.length > 0) {
      // Tool-driven path: execute real authorized queries and ground the answer.
      const plannedResults = await runPlannedTools(toolPlan.calls, { userId: normalizedUserId, userRole }, message);
      const toolData = formatToolResults(plannedResults);
      systemPrompt = `You are ShopEase's helpful in-store assistant. Talking to ${userName} (${userRole}). Be concise and conversational (under 80 words). Use ONLY the LIVE DATA below, which comes from real backend queries for this exact user. Never invent prices, orders, statuses, users, or statistics. If a section says data is unavailable, empty, or access is denied, say so plainly and do not fabricate anything. Never reveal passwords, tokens, or payment secrets.${toolData}`;
    } else {
    let classified = classifyIntent(message, historyTexts);
    if (classified.kind === 'general' && isFollowUpMessage(message)) {
      for (const prior of historyTexts.filter((_, i) => history[i].role === 'user').slice(-3).reverse()) {
        const priorKind = classifyIntent(prior, []).kind;
        if (priorKind === 'product' || priorKind === 'order' || priorKind === 'cart' || priorKind === 'wishlist') {
          classified = { kind: priorKind, confidence: 'low' };
          break;
        }
      }
    }
    const intent = intentToFlags(classified, message);
    const priceFilter = intent.needsProducts ? parsePriceFilter(message) : null;
    const orderLimit = intent.wantsAllOrders ? 20 : 5;
    const extremeMatch = intent.needsProducts
      ? String(message).toLowerCase().match(/\b(cheapest|least expensive|lowest priced|costliest|most expensive|highest priced)\b/)
      : null;
    const adminDenied = intent.needsAdmin && userRole !== 'admin';
    let userOrders = [];
    let popularProducts = [];
    let categoryAnalytics = [];
    let latestUsers = [];
    const tasks = {};
    if (intent.needsPolicy) {
      tasks.rag = (async () => {
        try {
          return await vectorStore.search(message, 2);
        } catch (_) {
          return [];
        }
      })();
    } else {
      tasks.rag = Promise.resolve([]);
    }
    tasks.recs = (intent.needsProducts && !priceFilter && !extremeMatch) ? getProductRecommendations(message, 8).catch(() => []) : Promise.resolve([]);
    tasks.stats = (userRole === 'admin' && (intent.needsAdmin || intent.wantsStats))
      ? getDatabaseStats()
      : Promise.resolve(null);
    tasks.matched = (intent.needsProducts && !priceFilter && !extremeMatch)
      ? searchCatalogProducts(message, 5).catch(() => ({ success: false, term: null, products: [] }))
      : Promise.resolve(null);
    if (userRole === 'admin' && intent.needsAdmin) {
      tasks.admin = Promise.all([
        getPopularProducts(5),
        getCategoryAnalytics(),
        Order.find({}).populate('user', 'name email').sort({ createdAt: -1 }).limit(10).select('_id total status createdAt items user').lean(),
      ]);
      if (classified.kind === 'admin_users') tasks.latestUsers = getLatestUser(5);
    } else {
      tasks.admin = Promise.resolve(null);
    }
    tasks.orders = intent.needsOrders
      ? getUserOrders(normalizedUserId, orderLimit)
      : Promise.resolve([]);
    tasks.cart = intent.needsCart ? Cart.findOne({ user: normalizedUserId }).populate('items.product', 'name price').lean() : Promise.resolve(null);
    tasks.wishlist = intent.needsWishlist ? Wishlist.findOne({ user: normalizedUserId }).populate('items.product', 'name price').lean() : Promise.resolve(null);
    tasks.notifs = intent.needsNotifications ? Notification.find({ userId: normalizedUserId }).sort({ createdAt: -1 }).limit(5).lean() : Promise.resolve([]);
    tasks.account = intent.needsAccount ? User.findById(normalizedUserId).select('name email role createdAt').lean() : Promise.resolve(null);

    const [relevantDocs, recommendations, stats, adminData, ordersData, cartData, wishlistData, notifData, accountData, matchedProducts, latestUsersData] = await Promise.all([
      tasks.rag, tasks.recs, tasks.stats, tasks.admin, tasks.orders,
      tasks.cart, tasks.wishlist, tasks.notifs, tasks.account, tasks.matched, tasks.latestUsers || Promise.resolve([]),
    ]);
    latestUsers = latestUsersData || [];

    let productSearch = matchedProducts;
    if ((intent.needsProducts || classified.kind === 'greeting') && (!productSearch || !productSearch.term) && (isFollowUpMessage(message) || classified.kind === 'greeting')) {
      const priorUserMessages = history
        .filter((msg) => msg.role === 'user')
        .map((msg) => String(msg.content || ''))
        .slice(-2)
        .reverse();
      for (const prior of priorUserMessages) {
        const retry = await searchCatalogProducts(prior, 5).catch(() => null);
        if (retry && retry.products && retry.products.length > 0) {
          productSearch = retry;
          break;
        }
      }
    }

    let priceExtremes = null;
    if (extremeMatch) {
      const ascending = /cheapest|least expensive|lowest priced/.test(extremeMatch[1]);
      priceExtremes = await Product.find({ isActive: true, stock: { $gt: 0 } })
        .sort(ascending ? { price: 1 } : { price: -1 })
        .limit(3)
        .select('name price')
        .lean()
        .catch(() => null);
    }

    let priceFilterProducts = null;
    if (priceFilter) {
      priceFilterProducts = await Product.find({ isActive: true, stock: { $gt: 0 }, price: priceFilter.op === 'gte' ? { $gte: priceFilter.amount } : { $lte: priceFilter.amount } })
        .populate('category', 'name')
        .sort({ price: 1 })
        .limit(8)
        .select('name price stock category')
        .lean()
        .catch(() => null);
    }

    if (userRole === 'admin' && adminData) {
      const [popular, categories, allOrders] = adminData;
      popularProducts = popular || [];
      categoryAnalytics = categories || [];
      userOrders = (allOrders || []).map(order => ({
        id: order._id,
        total: order.total,
        status: order.status,
        date: order.createdAt,
        items: order.items.length,
        customerName: order.user?.name || '—',
        customerEmail: order.user?.email || '',
      }));
    } else {
      userOrders = ordersData || [];
    }

    systemPrompt = `You are ShopEase's helpful in-store assistant. Talking to ${userName} (${userRole}). Be concise and conversational (under 80 words). Never invent prices, orders, or statuses. Answer general questions (greetings, tech explanations, what you can do, what this app does) from your own knowledge; use the LIVE DATA sections below only when they are present and relevant. If a LIVE DATA section is missing or empty, say you do not have that information rather than inventing it. Never reveal passwords, tokens, or payment secrets; user data below is already scoped to what this user may see.`;
    if (classified.kind === 'greeting') {
      systemPrompt += `\nThe user greeted you. Reply with a short, warm greeting using their name and offer to help with products, orders, or anything else. A prior product may be listed below only as follow-up context; mention it only if it fits naturally, otherwise just greet. Do not list statistics, products, or prices unless asked.`;
    }
    if (classified.kind === 'capabilities') {
      systemPrompt += `\nThe user asks what you can do. Briefly describe the real capabilities: search live products and prices, check their own orders and status, cart and wishlist help, shipping/returns/payment policies, and order updates. Admins can also ask about users, dashboard stats, and order summaries. Invite one follow-up question.`;
    }
    if (classified.kind === 'app_info') {
      systemPrompt += `\nThe user asks what this application does. Explain in 2-3 sentences: ShopEase is an e-commerce store where customers browse products, manage cart and wishlist, check out with Razorpay/Stripe/COD, and track orders, returns, and notifications; admins manage products, orders, users, and analytics. Offer to help with a specific task.`;
    }
    if (classified.kind === 'admin_users') {
      if (adminDenied) {
        systemPrompt += `\nACCESS DENIED: the user asked about other users but is not an admin. Politely refuse, explain that user information is restricted to administrators, and offer to help with their own orders, cart, wishlist, or product questions instead. Do not reveal any user data.`;
      } else if (latestUsers.length > 0) {
        systemPrompt += `\nLATEST USERS (newest first; names and signup dates only, never credentials):`;
        latestUsers.slice(0, 5).forEach((u) => {
          const when = u.registeredAt ? new Date(u.registeredAt).toLocaleDateString() : 'unknown date';
          systemPrompt += `\n${u.name} <${u.email}> role=${u.role} joined ${when}`;
        });
      } else {
        systemPrompt += `\nNo registered users were found in the database. Say so plainly.`;
      }
    }
    if (adminDenied && (classified.kind === 'admin_stats' || classified.kind === 'admin_orders')) {
      systemPrompt += `\nACCESS DENIED: the user asked for admin-only analytics or order summaries but is not an admin. Politely refuse and offer to help with their own orders, cart, wishlist, or product questions instead. Do not reveal aggregate stats or other customers' orders.`;
    }

    if (stats) {
      systemPrompt += `\nSTATS: orders=${stats.totalOrders} products=${stats.totalProducts} users=${stats.totalUsers}`;
    }
    if (relevantDocs.length > 0) {
      systemPrompt += `\nPOLICIES:`;
      relevantDocs.forEach((doc) => { systemPrompt += ` ${doc.pageContent}`.slice(0, 400); });
    }
    if (userRole === 'admin' && adminData) {
      systemPrompt += `\nADMIN: customers=${stats ? stats.totalUsers : '?'} orders=${stats ? stats.totalOrders : '?'}`;
      if (userOrders.length > 0) {
        systemPrompt += `\nRECENT ORDERS:`;
        userOrders.slice(0, 5).forEach((o) => {
          systemPrompt += `\n#${String(o.id).slice(-8)} ₹${o.total} ${o.status} ${o.customerName || ''}`;
        });
      }
      if (popularProducts.length > 0) {
        systemPrompt += `\nTOP PRODUCTS:`;
        popularProducts.slice(0, 5).forEach((p) => {
          systemPrompt += `\n${p.name} x${p.totalQuantity}`;
        });
      }
    } else if (userOrders.length > 0) {
      systemPrompt += `\nYOUR ORDERS:`;
      userOrders.slice(0, 5).forEach((o) => {
        systemPrompt += `\n#${String(o.id).slice(-8)} ₹${o.total} ${o.status} (${o.items} items)`;
      });
    }
    if (recommendations.length > 0) {
      systemPrompt += `\nPRODUCTS:`;
      recommendations.slice(0, 8).forEach((p) => {
        systemPrompt += `\n${p.name} ₹${p.price} (${p.category}, ${p.stock} in stock)`;
      });
    }
    if (priceFilter && priceFilterProducts) {
      const priceDir = priceFilter.op === 'gte' ? 'above' : 'under';
      if (priceFilterProducts.length > 0) {
        systemPrompt += `\nPRODUCTS ${priceDir.toUpperCase()} Rs.${priceFilter.amount} from the live catalog (use exactly these):`;
        priceFilterProducts.forEach((p) => {
          systemPrompt += `\n${p.name} - Rs.${p.price} (${p.category?.name || 'General'}, ${p.stock} in stock)`;
        });
      } else {
        systemPrompt += `\nNo active products are currently priced ${priceDir} Rs.${priceFilter.amount}. Say so plainly and suggest browsing the Products page. Do not invent products or prices.`;
      }
    } else if (productSearch) {
      if (!productSearch.success) {
        systemPrompt += `\nPRODUCT SEARCH FAILED: the catalog lookup is unavailable right now. Tell the user you could not check the catalog just now and ask them to try again shortly. Do NOT say the product does not exist. Do not invent any product or price.`;
      } else if (productSearch.products.length === 0) {
        if (productSearch.term) {
          systemPrompt += `\nPRODUCT SEARCH: no active product matched "${productSearch.term}". Say you could not find that product in the catalog and suggest rephrasing or browsing the Products page. Never invent a product or price.`;
        }
      } else if (productSearch.products.length === 1) {
        const m = productSearch.products[0];
        systemPrompt += `\nPRODUCT MATCH: ${m.name} - price Rs.${m.price}, stock ${m.stock} units, category ${m.category}, id ${m.id}. Answer the user's question using exactly these facts.`;
      } else {
        systemPrompt += `\nPRODUCT MATCHES (${productSearch.products.length}):`;
        productSearch.products.forEach((m) => {
          systemPrompt += `\n${m.name} - Rs.${m.price} (stock ${m.stock}, ${m.category})`;
        });
        systemPrompt += `\nMultiple products match the question. List these options with their prices and ask which one the user means. Do not pick one arbitrarily and do not invent.`;
      }
    }
    if (priceExtremes && priceExtremes.length > 0) {
      systemPrompt += `\nPRICE RANKING from the live catalog (use exactly these):`;
      priceExtremes.forEach((p) => {
        systemPrompt += `\n${p.name} - Rs.${p.price}`;
      });
    }
    if (cartData && cartData.items && cartData.items.length > 0) {
      const total = cartData.items.reduce((s, it) => s + (it.price || 0) * (it.quantity || 0), 0);
      systemPrompt += `\nCART: ${cartData.items.length} lines, total ₹${total}.`;
      cartData.items.slice(0, 5).forEach((it) => {
        systemPrompt += `\n${it.product?.name || 'Item'} x${it.quantity} ₹${it.price}`;
      });
    }
    if (wishlistData && wishlistData.items && wishlistData.items.length > 0) {
      systemPrompt += `\nWISHLIST (${wishlistData.items.length}):`;
      wishlistData.items.slice(0, 5).forEach((it) => {
        systemPrompt += `\n${it.product?.name || 'Item'} ₹${it.product?.price ?? ''}`;
      });
    }
    if (notifData && notifData.length > 0) {
      const unread = notifData.filter((n) => !n.read).length;
      systemPrompt += `\nNOTIFICATIONS: ${notifData.length} recent, ${unread} unread.`;
      notifData.slice(0, 3).forEach((n) => {
        systemPrompt += `\n${n.title}: ${String(n.message || '').slice(0, 120)}`;
      });
    }
    if (accountData) {
      systemPrompt += `\nACCOUNT: ${accountData.name} <${accountData.email}> role=${accountData.role}`;
    }
    if (intent.wantsAllOrders && userOrders.length === 0 && userRole !== 'admin') {
      systemPrompt += `\nNOTE: this user has no orders yet. Say so plainly.`;
    }
    if (systemPrompt.length > 3500) systemPrompt = systemPrompt.slice(0, 3500);
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: String(msg.content || '').slice(0, 500),
      })),
      { role: 'user', content: message },
    ];

    const startedAt = Date.now();
    const response = await llm.invoke(messages, { maxTokens: 350, timeout: 10000 });
    const latencyMs = Date.now() - startedAt;
    debugLog(`[Chatbot] LLM reply in ${latencyMs}ms`);
    let aiResponse = response.content;
    let escalate = false;
    let supportTicket = null;
    escalate = shouldEscalateToHuman(message);
    const [, , , ticketDoc] = await Promise.all([
      ChatMessage.create({
        conversationId: currentConversationId,
        userId: normalizedUserId,
        role: 'user',
        content: message,
      }),

      ChatMessage.create({
        conversationId: currentConversationId,
        userId: normalizedUserId,
        role: 'assistant',
        content: aiResponse,
      }),

      // Update conversation's updatedAt timestamp
      Conversation.findByIdAndUpdate(currentConversationId, { updatedAt: Date.now() }),

      escalate
        ? SupportTicket.create({
            userId: normalizedUserId,
            userName: userName,
            userEmail: userEmail,
            conversationId: currentConversationId,
            reason: message,
            status: 'open',
          })
        : null,
    ]);

    if (escalate) {
      supportTicket = ticketDoc;
      const ticketAcknowledgment = `\n\nI've connected you with our support team - they'll follow up shortly. Your ticket number is #${supportTicket._id.toString().slice(-8)}.`;
      aiResponse += ticketAcknowledgment;
    }

    return {
      response: aiResponse,
      conversationId: currentConversationId.toString(),
      escalate,
      ticketId: supportTicket ? supportTicket._id.toString() : null,
    };
  } catch (error) {
    if (process.env.DEBUG_AI === 'true') console.error('[Chatbot] Error:', error.message);
    const msg = String((error && error.message) || '');
    if (/timed out|timeout|abort|ETIMEDOUT|ECONNRESET/i.test(msg)) {
      throw Object.assign(new Error('AI_PROVIDER_TIMEOUT'), { status: 504 });
    }
    if (/GROQ_API_KEY|OPENAI_API_KEY|not configured|401|403|model_not_found|does not exist or you do not have access/i.test(msg)) {
      throw Object.assign(new Error('AI_PROVIDER_UNAVAILABLE'), { status: 503 });
    }
    try {
      if (userRole === 'admin') {
        const stats = await getDatabaseStats();
        if (stats) {
          return {
            response: `Hi ${userName}! My AI service is briefly unavailable. We currently have ${stats.totalOrders} orders and ${stats.totalProducts} products. Please try again shortly.`,
            conversationId: currentConversationId ? currentConversationId.toString() : null,
            escalate: false,
            ticketId: null,
          };
        }
      }
      return {
        response: `Hi ${userName}! My AI service is briefly unavailable. Please try again shortly.`,
        conversationId: currentConversationId ? currentConversationId.toString() : null,
        escalate: false,
        ticketId: null,
      };
    } catch {
      return {
        response: `Hi ${userName}! My AI service is briefly unavailable. Please try again shortly.`,
        conversationId: currentConversationId ? currentConversationId.toString() : null,
        escalate: false,
        ticketId: null,
      };
    }
  }
}

async function clearChatHistory(conversationId) {
  if (!conversationId) return;
  await ChatMessage.deleteMany({ conversationId });
  await Conversation.findByIdAndDelete(conversationId);
}

async function getChatHistory(conversationId) {
  if (!conversationId) return [];
  const messages = await ChatMessage.find({ conversationId })
    .sort({ timestamp: 1 })
    .limit(50);
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
  }));
}

async function getConversations(userId) {
  const normalizedUserId = String(userId);
  const conversations = await Conversation.find({ userId: normalizedUserId })
    .sort({ updatedAt: -1 })
    .limit(50);
  return conversations.map(conv => ({
    id: conv._id,
    title: conv.title,
    updatedAt: conv.updatedAt,
  }));
}

async function deleteConversation(conversationId, userId) {
  const normalizedUserId = String(userId);
  const conversation = await Conversation.findOne({ _id: conversationId, userId: normalizedUserId });
  if (!conversation) return false;
  
  await ChatMessage.deleteMany({ conversationId });
  await Conversation.findByIdAndDelete(conversationId);
  return true;
}

function shouldEscalateToHuman(message) {
  const keywords = ['speak to human', 'talk to agent', 'human help', 'real person', 'manager', 'complaint', 'refund immediately', 'cancel immediately'];
  return keywords.some(kw => message.toLowerCase().includes(kw));
}

async function getSuggestedReplies(userId, conversationId = null) {
  // For now, return default suggestions based on common topics
  // Could be enhanced later to be context-aware
  return ['Track my order', 'Product recommendations', 'Return policy', 'Talk to human agent'];
}

async function orderedBy(name, userId) {
  if (userId) {
    const user = await User.findOne({ name: { $regex: name, $options: 'i' } })
      .select('_id name role')
      .lean();

    if (!user) {
      return { success: false, message: 'No customer named \'' + name + '\' was found.' };
    }

    const orders = await Order.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('_id total status createdAt deliveryProgress')
      .lean();

    return {
      success: true,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
      },
      orders: orders.map((o) => ({
        id: o._id,
        number: `#${o._id.slice(-8).toUpperCase()}`,
        total: o.total,
        status: o.status,
        progress: o.deliveryProgress,
        date: o.createdAt,
      })),
    };
  }

  return { success: false, message: 'Admin access required to resolve a customer by name.' };
}

async function adminOrders(limit = 10) {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50))
      .select('_id total status createdAt deliveryProgress')
      .lean();

    return {
      success: true,
      orders: orders.map((o) => ({
        id: o._id,
        number: `#${o._id.slice(-8).toUpperCase()}`,
        total: o.total,
        status: o.status,
        progress: o.deliveryProgress,
        date: o.createdAt,
      })),
    };
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    return { success: false, message: 'Failed to fetch orders.' };
  }
}

module.exports = {
  chat,
  clearChatHistory,
  getChatHistory,
  getConversations,
  deleteConversation,
  shouldEscalateToHuman,
  getSuggestedReplies,
  getUserOrders,
  resolveOwnedConversationId,
  getProductRecommendations,
  detectIntent,
  classifyIntent,
  intentToFlags,
  isFollowUpMessage,
  getLatestUser,
  getLatestOrders,
  getLatestOrder,
  orderedBy,
  adminOrders,
};
