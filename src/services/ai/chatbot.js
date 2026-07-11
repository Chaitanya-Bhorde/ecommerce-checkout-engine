// AI Chatbot Service - Handles customer support conversations
// Uses Groq (FREE, FAST) for intelligent responses
// NOW WITH REAL DATABASE DATA + PER-USER PERSONALIZATION!

const { llm, getLLM, AI_PROVIDER, callLLM } = require('./llmConfig');
const vectorStore = require('./vectorStore');
const { runAgent } = require('./agentWorkflow');
const { analyzeAndGetStrategy } = require('./sentimentAnalysis');
const { getAllDocuments } = require('./knowledgeBase');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const User = require('../../models/User');
const Conversation = require('../../models/Conversation');
const ChatMessage = require('../../models/ChatMessage');
const SupportTicket = require('../../models/SupportTicket');

async function getUserOrders(userId, limit = 5) {
  try {
    // Validate userId is a valid ObjectId before querying
    if (!userId || userId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(userId)) {
      console.log(`[getUserOrders] Invalid ObjectId format for userId: "${userId}" - returning empty orders`);
      return [];
    }
    const orders = await Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('_id total status createdAt items deliveryProgress')
      .populate('items.product', 'name price category');
    
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

async function getProductRecommendations(query = '') {
  try {
    console.log(`[getProductRecommendations] Query: "${query}"`);
    
    // Get ALL active products with categories
    const products = await Product.find({ isActive: true, stock: { $gt: 0 } })
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .limit(100)
      .select('name price images category stock description');
    
    console.log(`[getProductRecommendations] Found ${products.length} total products`);
    
    // Also get distinct categories
    const Category = require('../../models/Category');
    const categories = await Category.find({ isActive: true }).select('name');
    const categoryNames = categories.map(c => c.name);
    console.log(`[getProductRecommendations] Categories:`, categoryNames);
    
    const mappedProducts = products.map(product => ({
      id: product._id, 
      name: product.name, 
      price: product.price,
      category: product.category?.name || 'General', 
      stock: product.stock, 
      image: product.images?.[0] || null,
    }));
    
    // If no query, return ALL products (not just first 5)
    if (!query || query.trim() === '') {
      console.log(`[getProductRecommendations] No query, returning ALL ${products.length} products`);
      return mappedProducts;
    }
    
    // Search for matching products
    const queryLower = query.toLowerCase();
    const filtered = products.filter(product => {
      const productName = product.name.toLowerCase();
      const categoryName = product.category?.name?.toLowerCase() || '';
      const description = product.description?.toLowerCase() || '';
      
      // Match if query is in name, category, or description
      return productName.includes(queryLower) || 
             categoryName.includes(queryLower) || 
             description.includes(queryLower);
    });
    
    console.log(`[getProductRecommendations] Filtered to ${filtered.length} products matching "${query}"`);
    
    // If no matches, return ALL products so AI can see available categories
    if (filtered.length === 0) {
      console.log(`[getProductRecommendations] No matches, returning ALL ${products.length} products`);
      return mappedProducts;
    }
    
    // Return up to 20 matching products
    return mappedProducts.filter(p => 
      p.name.toLowerCase().includes(queryLower) || 
      p.category.toLowerCase().includes(queryLower)
    ).slice(0, 20);
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

async function getDatabaseStats() {
  try {
    const [totalOrders, totalProducts, totalUsers, cancelledOrders, deliveredOrders] = await Promise.all([
      Order.countDocuments(),
      Product.countDocuments({ isActive: true }),
      User.countDocuments(),
      Order.countDocuments({ status: 'cancelled' }),
      Order.countDocuments({ status: 'delivered' }),
    ]);
    const pendingOrders = await Order.countDocuments({ status: { $in: ['pending', 'processing', 'shipped'] } });
    return { totalOrders, totalProducts, totalUsers, cancelledOrders, deliveredOrders, pendingOrders };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return { totalOrders: 0, totalProducts: 0, totalUsers: 0, cancelledOrders: 0, deliveredOrders: 0, pendingOrders: 0 };
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
  
  console.log(`[Chatbot] ========================================`);
  console.log(`[Chatbot] Processing message for user ${userName} (${normalizedUserId}): ${message}`);
  console.log(`[Chatbot] Context received:`, JSON.stringify(context));
  console.log(`[Chatbot] ========================================`);
  console.log(`[Chatbot] AI_PROVIDER: ${AI_PROVIDER}`);
  console.log(`[Chatbot] LLM object type: ${typeof llm}`);
  console.log(`[Chatbot] LLM has invoke: ${typeof llm.invoke}`);
  
  try {
    // PART 2: Detect if user wants all orders
    const allOrdersKeywords = ['all my orders', 'complete history', 'every order', 'all of them', 'all orders'];
    const wantsAllOrders = allOrdersKeywords.some(kw => message.toLowerCase().includes(kw));
    const orderLimit = wantsAllOrders ? 50 : 5;

    // Get or create conversation
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      // Create new conversation with auto-generated title
      const title = message.substring(0, 40) + (message.length > 40 ? '...' : '');
      const conversation = await Conversation.create({
        userId: normalizedUserId,
        title: title,
      });
      currentConversationId = conversation._id;
    }

    // Fetch conversation history from database
    const historyMessages = await ChatMessage.find({ conversationId: currentConversationId })
      .sort({ timestamp: 1 })
      .limit(20);
    
    const history = historyMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    console.log(`[Chatbot] Fetching FRESH database stats for ${userName}...`);
    
    // For admins, fetch analytics data instead of personal orders
    let userOrders = [];
    let popularProducts = [];
    let categoryAnalytics = [];
    
    if (userRole === 'admin') {
      const [popular, categories] = await Promise.all([
        getPopularProducts(10),
        getCategoryAnalytics(),
      ]);
      popularProducts = popular;
      categoryAnalytics = categories;
      console.log(`[Chatbot] Admin analytics - Popular products: ${popularProducts.length}, Categories: ${categoryAnalytics.length}`);
    } else {
      userOrders = await getUserOrders(normalizedUserId, orderLimit);
    }
    
    const [recommendations, stats] = await Promise.all([
      getProductRecommendations(message),
      getDatabaseStats(),
    ]);

    console.log(`[Chatbot] Stats (FRESH) - Orders: ${stats.totalOrders}, Products: ${stats.totalProducts}, Users: ${stats.totalUsers}`);

    // RAG: Try vector store - don't fail if unavailable
    let relevantDocs = [];
    try {
      console.log(`[RAG] Searching vector store...`);
      relevantDocs = await vectorStore.search(message, 3);
      console.log(`[RAG] Retrieved ${relevantDocs.length} relevant documents`);
    } catch (ragError) {
      console.log(`[RAG] Vector store unavailable, using database data only. Error: ${ragError.message}`);
    }

    // Build personalized context with ALL products always available
    let systemPrompt = `You are a helpful customer support assistant for an e-commerce store called "ShopEase". You are talking to ${userName}.

CURRENT USER:
- Name: ${userName}
- Email: ${userEmail}
- Role: ${userRole}
- Orders: ${userOrders.length > 0 ? userOrders.length + ' orders placed' : 'New customer (no orders yet)'}\n\n`;

    systemPrompt += `DATABASE STATS:\n- Total Orders: ${stats.totalOrders}\n- Pending: ${stats.pendingOrders}\n- Delivered: ${stats.deliveredOrders}\n- Cancelled: ${stats.cancelledOrders}\n- Products: ${stats.totalProducts}\n- Users: ${stats.totalUsers}\n\n`;

    if (relevantDocs.length > 0) {
      systemPrompt += `KNOWLEDGE BASE:\n`;
      relevantDocs.forEach((doc, i) => { systemPrompt += `${i+1}. ${doc.pageContent}\n`; });
    }

    if (userRole === 'admin') {
      // Admin analytics section
      systemPrompt += `\nBUSINESS ANALYTICS (FOR ADMIN ONLY - USE THIS TO ANSWER BUSINESS QUESTIONS):\n`;
      systemPrompt += `Total Customers: ${stats.totalUsers}\n`;
      systemPrompt += `Total Orders: ${stats.totalOrders} (Pending: ${stats.pendingOrders}, Delivered: ${stats.deliveredOrders}, Cancelled: ${stats.cancelledOrders})\n`;
      systemPrompt += `Total Products: ${stats.totalProducts}\n\n`;
      
      if (popularProducts.length > 0) {
        systemPrompt += `TOP SELLING PRODUCTS (by quantity sold):\n`;
        popularProducts.forEach((p, i) => {
          systemPrompt += `${i+1}. ${p.name} - ${p.totalQuantity} units sold - ₹${p.totalRevenue?.toFixed(2) || 0} revenue (${p.orderCount} orders)\n`;
        });
        systemPrompt += `\n`;
      }
      
      if (categoryAnalytics.length > 0) {
        systemPrompt += `CATEGORY-WISE SALES:\n`;
        categoryAnalytics.forEach((cat, i) => {
          systemPrompt += `${i+1}. ${cat._id}: ${cat.totalSales} units - ₹${cat.totalRevenue?.toFixed(2) || 0} revenue\n`;
        });
        systemPrompt += `\n`;
      }
      
      systemPrompt += `CRITICAL FOR ADMIN: When admin asks about analytics, customers, products, or sales - USE THE DATA ABOVE. Never say "you have no orders" - you're the admin, not a customer!\n\n`;
    } else if (userOrders.length > 0) {
      systemPrompt += `\n${userName}'S ORDERS WITH PRODUCT DETAILS:\n`;
      const displayOrders = userOrders.slice(0, 10);
      displayOrders.forEach((o, i) => {
        systemPrompt += `${i+1}. Order #${o.id.toString().slice(-8)} - ₹${o.total} - ${o.status}\n`;
        systemPrompt += `   Items:\n`;
        o.itemDetails.forEach((item, idx) => {
          systemPrompt += `   ${idx+1}. ${item.name} (${item.category}) - ₹${item.price} x ${item.quantity}\n`;
        });
      });
      
      if (userOrders.length > 10) {
        systemPrompt += `\n...and ${userOrders.length - 10} more orders. Ask me about a specific order ID for full details.\n`;
      }
    } else if (!message.toLowerCase().includes('product') && !message.toLowerCase().includes('recommend')) {
      systemPrompt += `\n${userName} has no orders yet - welcome them as a new customer!\n`;
    }

    // ALWAYS show all products regardless of match
    systemPrompt += `\nCOMPLETE PRODUCT CATALOG (ALL ${stats.totalProducts} PRODUCTS - THIS IS THE FULL LIST):\n`;
    recommendations.forEach((p, i) => { 
      const stockStatus = p.stock > 0 ? `${p.stock} in stock` : 'Out of stock';
      systemPrompt += `- ${p.name} | ₹${p.price} | Category: ${p.category} | Stock: ${stockStatus}\n`; 
    });
    systemPrompt += `\n`;

    systemPrompt += `\nCRITICAL RULES YOU MUST FOLLOW:
1. Address user ONLY as "${userName}" - NEVER use any other name
2. When user asks "do you have X category?", LOOK at ALL products above and check their categories
3. If a product exists in the list, YOU HAVE IT - do NOT say "we don't have"
4. If user says they saw a product like "wireless mouse", CHECK the product names above
5. NEVER say "we don't have [category]" without first checking ALL products in the catalog above
6. Use EXACT numbers from DATABASE STATS - never make up numbers
7. List actual product names and prices from the catalog above when asked about products
8. Be concise (under 80 words), polite, and helpful`;

    console.log(`[Chatbot] System prompt built with ${recommendations.length} products`);

    // Build messages array with history (ONLY include user messages - not previous AI responses)
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.filter(msg => msg.role === 'user').map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message },
    ];

    console.log(`[Chatbot] Getting AI response from ${AI_PROVIDER}...`);
    console.log(`[Chatbot] About to call llm.invoke() with ${messages.length} messages`);
    console.log(`[Chatbot] Calling LLM with timeout...`);
    const response = await llm.invoke(messages);
    console.log(`[Chatbot] LLM response object type:`, typeof response, response ? Object.keys(response) : 'null');
    const aiResponse = response.content;

    console.log(`[Chatbot] ✅ Response for ${userName}: "${aiResponse.substring(0, 80)}..."`);

    // Save user message and AI response to database
    await ChatMessage.create({
      conversationId: currentConversationId,
      userId: normalizedUserId,
      role: 'user',
      content: message,
    });

    await ChatMessage.create({
      conversationId: currentConversationId,
      userId: normalizedUserId,
      role: 'assistant',
      content: aiResponse,
    });

    // Update conversation's updatedAt timestamp
    await Conversation.findByIdAndUpdate(currentConversationId, { updatedAt: Date.now() });

    // PART 3: Check if should escalate to human
    let escalate = false;
    let supportTicket = null;
    if (shouldEscalateToHuman(message)) {
      escalate = true;
      supportTicket = await SupportTicket.create({
        userId: normalizedUserId,
        userName: userName,
        userEmail: userEmail,
        conversationId: currentConversationId,
        reason: message,
        status: 'open',
      });
      
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
    console.error('[Chatbot] ❌ Error:', error.message);
    console.error('[Chatbot] Stack:', error.stack);
    console.error('[Chatbot] FULL ERROR OBJECT:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error('[Chatbot] Error name:', error.name);
    console.error('[Chatbot] Error cause:', error.cause);
    console.error('[Chatbot] Error code:', error.code);
    
    // Provide a graceful fallback response based on user data if possible
    try {
      const stats = await getDatabaseStats();
      return {
        response: `Hi ${userName}! I'm currently experiencing a temporary issue with my AI service. Here's what I know: We have ${stats.totalOrders} total orders, ${stats.totalProducts} products available, and ${stats.totalUsers} registered users. How can I assist you further?`,
        conversationId: null,
        escalate: false,
        ticketId: null,
      };
    } catch {
      return {
        response: `Hi ${userName}! I'm experiencing a temporary technical issue. Our support team is available to help. Please try again in a few moments.`,
        conversationId: null,
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
};
