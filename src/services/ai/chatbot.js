// AI Chatbot Service - Handles customer support conversations
// Uses Groq (FREE, FAST) for intelligent responses
// NOW WITH REAL DATABASE DATA + PER-USER PERSONALIZATION!

const { llm, getLLM, AI_PROVIDER, callLLM } = require('./llmConfig');
const vectorStore = require('./vectorStore');
const { runAgent } = require('./agentWorkflow');
const { searchProducts: searchCatalogProducts } = require('./agentTools');
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
  try {
    if (!userId || !/^[0-9a-fA-F]{24}$/.test(String(userId))) return [];
    const lim = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 20);
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
  } catch (error) {
    console.error('Error fetching user orders:', error);
    return [];
  }
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

function detectIntent(message) {
  const t = String(message || '').toLowerCase();
  const has = (...words) => words.some((w) => t.includes(w));
  const intent = {
    needsOrders: false, needsProducts: false, needsCart: false,
    needsWishlist: false, needsNotifications: false, needsAccount: false,
    needsAdmin: false, needsPolicy: false, wantsAllOrders: false, wantsStats: false,
  };
  if (has('all my orders', 'complete history', 'every order', 'all of them', 'all orders')) intent.wantsAllOrders = true;
  if (has('order', 'track', 'status', 'deliver', 'payment', 'refund', 'return', 'cancel', 'receipt')) intent.needsOrders = true;
  if (has('product', 'recommend', 'suggest', 'looking for', 'find', 'show me', 'price', 'cost', 'cheap', 'expensive', 'budget', 'premium', 'stock', 'available', 'categor')) intent.needsProducts = true;
  if (has('cart', 'basket', 'checkout total', 'my total')) intent.needsCart = true;
  if (has('wishlist', 'wish list', 'saved item', 'favorite')) intent.needsWishlist = true;
  if (has('notif', 'unread', 'alert', 'message from')) intent.needsNotifications = true;
  if (has('account', 'profile', 'my email', 'my name', 'who am i', 'order history')) { intent.needsAccount = true; intent.needsOrders = true; }
  if (has('dashboard', 'revenue', 'sales', 'analytic', 'popular', 'customer')) intent.needsAdmin = true;
  if (has('policy', 'policies', 'shipping', 'warranty', 'support hour', 'contact', 'how do i', 'how to')) intent.needsPolicy = true;
  if (/\bstats\b|\bstatistics\b|\btotal\b\s+(orders|products|users|customers|sales)\b|how many (orders|products|users|customers) does/.test(t)) intent.wantsStats = true;
  if (!intent.needsOrders && !intent.needsProducts && !intent.needsCart && !intent.needsWishlist && !intent.needsNotifications && !intent.needsAccount && !intent.needsAdmin && !intent.needsPolicy) {
    if (t.length < 40) { intent.needsOrders = true; intent.needsProducts = true; }
    else intent.needsPolicy = true;
  }
  return intent;
}

async function getDatabaseStats() {
  try {
    // PERF: the status aggregation is independent of these three counts, so it is
    // issued in the same round-trip instead of a second sequential one.
    const [totalOrders, totalProducts, totalUsers, statusCounts] = await Promise.all([
      Order.countDocuments(),
      Product.countDocuments({ isActive: true }),
      User.countDocuments(),
      // Count orders by each status
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
    return { totalOrders: 0, totalProducts: 0, totalUsers: 0, cancelledOrders: 0, deliveredOrders: 0, pendingOrders: 0, statusBreakdown: {} };
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

async function chat(userId, message, context = {}, conversationId = null) {
  const userName = context.userName || 'Customer';
  const userEmail = context.userEmail || '';
  const userRole = context.userRole || 'customer';
  const normalizedUserId = String(userId);

  debugLog(`[Chatbot] Processing message for user ${userName} (${normalizedUserId})`);
  debugLog(`[Chatbot] LLM has invoke: ${typeof llm.invoke}`);
  
  let currentConversationId;

  try {
    currentConversationId = conversationId;
    if (!currentConversationId) {
      // Create new conversation with auto-generated title
      const title = message.substring(0, 40) + (message.length > 40 ? '...' : '');
      const conversation = await Conversation.create({
        userId: normalizedUserId,
        title: title,
      });
      currentConversationId = conversation._id;
    }

    const intent = detectIntent(message);
    const orderLimit = intent.wantsAllOrders ? 20 : 5;
    let userOrders = [];
    let popularProducts = [];
    let categoryAnalytics = [];
    const tasks = {
      history: ChatMessage.find({ conversationId: currentConversationId })
        .sort({ timestamp: 1 })
        .limit(10)
        .lean(),
    };
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
    tasks.recs = intent.needsProducts ? getProductRecommendations(message, 8).catch(() => []) : Promise.resolve([]);
    tasks.stats = (intent.needsAdmin || intent.wantsStats)
      ? getDatabaseStats()
      : Promise.resolve(null);
    tasks.matched = intent.needsProducts
      ? searchCatalogProducts(message, 5).catch(() => ({ success: false, term: null, products: [] }))
      : Promise.resolve(null);
    if (userRole === 'admin' && intent.needsAdmin) {
      tasks.admin = Promise.all([
        getPopularProducts(5),
        getCategoryAnalytics(),
        Order.find({}).populate('user', 'name email').sort({ createdAt: -1 }).limit(10).select('_id total status createdAt items user').lean(),
      ]);
    } else {
      tasks.admin = Promise.resolve(null);
    }
    tasks.orders = (userRole !== 'admin' && intent.needsOrders)
      ? getUserOrders(normalizedUserId, orderLimit)
      : Promise.resolve([]);
    tasks.cart = intent.needsCart ? Cart.findOne({ user: normalizedUserId }).populate('items.product', 'name price').lean() : Promise.resolve(null);
    tasks.wishlist = intent.needsWishlist ? Wishlist.findOne({ user: normalizedUserId }).populate('items.product', 'name price').lean() : Promise.resolve(null);
    tasks.notifs = intent.needsNotifications ? Notification.find({ userId: normalizedUserId }).sort({ createdAt: -1 }).limit(5).lean() : Promise.resolve([]);
    tasks.account = intent.needsAccount ? User.findById(normalizedUserId).select('name email role createdAt').lean() : Promise.resolve(null);

    const [historyMessages, relevantDocs, recommendations, stats, adminData, ordersData, cartData, wishlistData, notifData, accountData, matchedProducts] = await Promise.all([
      tasks.history, tasks.rag, tasks.recs, tasks.stats, tasks.admin, tasks.orders,
      tasks.cart, tasks.wishlist, tasks.notifs, tasks.account, tasks.matched,
    ]);

    const history = historyMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    let productSearch = matchedProducts;
    if (!productSearch || !productSearch.term) {
      const priorUserMessages = history
        .filter((msg) => msg.role === 'user')
        .map((msg) => String(msg.content || ''))
        .slice(-3)
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
    if (intent.needsProducts) {
      const extremeMatch = String(message).toLowerCase().match(/\b(cheapest|least expensive|lowest priced|costliest|most expensive|highest priced)\b/);
      if (extremeMatch) {
        const ascending = /cheapest|least expensive|lowest priced/.test(extremeMatch[1]);
        priceExtremes = await Product.find({ isActive: true, stock: { $gt: 0 } })
          .sort(ascending ? { price: 1 } : { price: -1 })
          .limit(3)
          .select('name price')
          .lean()
          .catch(() => null);
      }
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

    let systemPrompt = `You are a helpful support assistant for ShopEase. Talking to ${userName} (${userRole}). Be concise (under 80 words). Use ONLY the data below. Never invent prices, orders, or statuses. If data is missing, say so.`;

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
    if (productSearch) {
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

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: String(msg.content || '').slice(0, 500),
      })),
      { role: 'user', content: message },
    ];

    const startedAt = Date.now();
    const response = await llm.invoke(messages, { maxTokens: 350, timeout: 25000 });
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
      const stats = await getDatabaseStats();
      return {
        response: `Hi ${userName}! My AI service is briefly unavailable. We currently have ${stats.totalOrders} orders and ${stats.totalProducts} products. Please try again shortly.`,
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

module.exports = {
  chat,
  clearChatHistory,
  getChatHistory,
  getConversations,
  deleteConversation,
  shouldEscalateToHuman,
  getSuggestedReplies,
  getUserOrders,
  getProductRecommendations,
  detectIntent,
};
