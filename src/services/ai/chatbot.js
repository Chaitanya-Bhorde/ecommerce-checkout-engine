// AI Chatbot Service - Handles customer support conversations
// Uses Llama 3 (FREE) via Ollama for intelligent responses
// NOW WITH REAL DATABASE DATA!

const { llm, getLLM } = require('./llmConfig');
const vectorStore = require('./vectorStore');
const { runAgent } = require('./agentWorkflow');
const { analyzeAndGetStrategy } = require('./sentimentAnalysis');
const Order = require('../../models/Order');
const Product = require('../../models/Product');

// Chat history management
const chatHistory = new Map(); // Store conversation history per user

/**
 * Get real order data from database
 * @param {string} userId - User ID
 * @returns {Promise<Array>} User's recent orders
 */
async function getUserOrders(userId) {
  try {
    const orders = await Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('_id total status createdAt items deliveryProgress');
    
    return orders.map(order => ({
      id: order._id,
      total: order.total,
      status: order.status,
      progress: order.deliveryProgress,
      date: order.createdAt,
      items: order.items.length,
    }));
  } catch (error) {
    console.error('Error fetching user orders:', error);
    return [];
  }
}

/**
 * Get real product recommendations from database
 * @param {string} query - Search query
 * @returns {Promise<Array>} Recommended products
 */
async function getProductRecommendations(query = '') {
  try {
    // Get all active products first
    const products = await Product.find({
      isActive: true,
      stock: { $gt: 0 },
    })
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .limit(50) // Get more to filter from
      .select('name price images category stock description');
    
    // If query provided, filter manually
    if (query) {
      const filtered = products.filter(product => {
        const searchText = `${product.name} ${product.category?.name || ''}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
      });
      return filtered.slice(0, 5).map(product => ({
        id: product._id,
        name: product.name,
        price: product.price,
        category: product.category?.name || 'General',
        stock: product.stock,
        image: product.images?.[0] || null,
      }));
    }
    
    // Return first 5 if no query
    return products.slice(0, 5).map(product => ({
      id: product._id,
      name: product.name,
      price: product.price,
      category: product.category?.name || 'General',
      stock: product.stock,
      image: product.images?.[0] || null,
    }));
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

/**
 * Get total statistics from database
 */
async function getDatabaseStats() {
  try {
    const totalOrders = await Order.countDocuments();
    const totalProducts = await Product.countDocuments({ isActive: true });
    const totalUsers = await User.countDocuments();
    
    return {
      totalOrders,
      totalProducts,
      totalUsers,
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return {
      totalOrders: 0,
      totalProducts: 0,
      totalUsers: 0,
    };
  }
}

/**
 * Main chatbot function - processes user messages and returns AI responses
 * WITH REAL DATABASE STATISTICS
 * @param {string} userId - User ID for conversation tracking
 * @param {string} message - User's message
 * @param {object} context - Additional context (order info, user info, etc.)
 * @returns {Promise<string>} AI response
 */
async function chat(userId, message, context = {}) {
  console.log(`[Chatbot] Processing message for user ${userId}: ${message}`);
  
  try {
    // Get or create chat history for user
    if (!chatHistory.has(userId)) {
      chatHistory.set(userId, []);
    }
    const history = chatHistory.get(userId);

    console.log(`[Chatbot] Fetching database stats...`);
    // FETCH REAL STATISTICS
    const [userOrders, recommendations, stats] = await Promise.all([
      getUserOrders(userId),
      getProductRecommendations(message),
      getDatabaseStats(),
    ]);

    console.log(`[Chatbot] Stats - Orders: ${stats.totalOrders}, Products: ${stats.totalProducts}, Users: ${stats.totalUsers}`);

    // Build real data context
    let realDataContext = `\n\nDATABASE STATISTICS (ALWAYS USE THESE NUMBERS):\n`;
    realDataContext += `- Total Orders: ${stats.totalOrders}\n`;
    realDataContext += `- Total Products: ${stats.totalProducts}\n`;
    realDataContext += `- Total Users: ${stats.totalUsers}\n\n`;

    if (userOrders.length > 0) {
      realDataContext += `Your Recent Orders:\n`;
      userOrders.forEach((order, index) => {
        realDataContext += `${index + 1}. Order #${order.id.slice(-8)} - ₹${order.total} - ${order.status} (${order.progress}%)\n`;
      });
    }

    if (recommendations.length > 0) {
      realDataContext += `\nAvailable Products:\n`;
      recommendations.forEach((product, index) => {
        realDataContext += `${index + 1}. ${product.name} - ₹${product.price} (${product.category})\n`;
      });
    }

    // Simple system prompt
    const systemPrompt = `You are a helpful customer support assistant for an e-commerce store.

${realDataContext}

CRITICAL INSTRUCTIONS:
1. ALWAYS use the EXACT numbers from DATABASE STATISTICS above
2. When asked about total orders, products, or users, use the exact numbers provided
3. NEVER make up numbers or estimates
4. If user asks about orders, use their actual order data
5. If user asks about products, use the actual product data
6. Be specific with names, prices, and status
7. Keep responses concise (under 100 words)
8. Be polite and helpful`;

    console.log(`[Chatbot] Getting AI response from Llama 3...`);
    
    // Simple direct LLM call
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ];

    const response = await llm.invoke(messages);
    let aiResponse = response.content;
    
    console.log(`[Chatbot] AI response received: ${aiResponse.substring(0, 50)}...`);

    // Update chat history
    history.push(
      { role: 'user', content: message },
      { role: 'assistant', content: aiResponse }
    );

    // Keep only last 20 messages
    if (history.length > 20) {
      chatHistory.set(userId, history.slice(-20));
    }

    console.log(`[Chatbot] Response sent successfully`);
    return aiResponse;
  } catch (error) {
    console.error('[Chatbot] Error:', error);
    return "I'm sorry, I'm having trouble right now. Let me connect you with a human agent who can help you better.";
  }
}

/**
 * Clear chat history for a user
 * @param {string} userId - User ID
 */
function clearChatHistory(userId) {
  chatHistory.delete(userId);
}

/**
 * Get chat history for a user
 * @param {string} userId - User ID
 * @returns {Array} Chat history
 */
function getChatHistory(userId) {
  return chatHistory.get(userId) || [];
}

/**
 * Check if AI should escalate to human
 * @param {string} message - User message
 * @returns {boolean} True if should escalate
 */
function shouldEscalateToHuman(message) {
  const escalationKeywords = [
    'speak to human',
    'talk to agent',
    'human help',
    'real person',
    'manager',
    'complaint',
    'refund immediately',
    'cancel immediately',
  ];

  const lowerMessage = message.toLowerCase();
  return escalationKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Get suggested quick replies based on context
 * @param {string} userId - User ID
 * @returns {Array} Array of suggested replies
 */
function getSuggestedReplies(userId) {
  const history = chatHistory.get(userId) || [];
  const lastMessage = history[history.length - 1]?.content?.toLowerCase() || '';

  if (lastMessage.includes('order') || lastMessage.includes('tracking')) {
    return [
      'Where is my order?',
      'How to cancel order?',
      'Delivery time?',
    ];
  }

  if (lastMessage.includes('product') || lastMessage.includes('recommend')) {
    return [
      'Show me wireless headphones',
      'Best sellers',
      'Under ₹2000',
    ];
  }

  if (lastMessage.includes('return') || lastMessage.includes('refund')) {
    return [
      'Return policy',
      'How to return?',
      'Refund status',
    ];
  }

  // Default suggestions
  return [
    'Track my order',
    'Product recommendations',
    'Return policy',
    'Talk to human agent',
  ];
}

module.exports = {
  chat,
  clearChatHistory,
  getChatHistory,
  shouldEscalateToHuman,
  getSuggestedReplies,
  getUserOrders,
  getProductRecommendations,
};