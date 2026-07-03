// AI Chatbot Service - Handles customer support conversations
// Uses Llama 3 (FREE) via Ollama for intelligent responses
// NOW WITH REAL DATABASE DATA!

const { llm, getLLM } = require('./llmConfig');
const vectorStore = require('./vectorStore');
const Order = require('../models/Order');
const Product = require('../models/Product');

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
    const filter = { isActive: true, stock: { $gt: 0 } };
    
    // If query provided, search by name or category
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } },
      ];
    }
    
    const products = await Product.find(filter)
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name price images category stock');
    
    return products.map(product => ({
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
 * Main chatbot function - processes user messages and returns AI responses
 * NOW WITH REAL DATABASE DATA!
 * @param {string} userId - User ID for conversation tracking
 * @param {string} message - User's message
 * @param {object} context - Additional context (order info, user info, etc.)
 * @returns {Promise<string>} AI response
 */
async function chat(userId, message, context = {}) {
  try {
    // Get or create chat history for user
    if (!chatHistory.has(userId)) {
      chatHistory.set(userId, []);
    }
    const history = chatHistory.get(userId);

    // Search vector store for relevant information (RAG)
    const relevantDocs = await vectorStore.search(message, 3);
    
    // Build context from retrieved documents
    const contextText = relevantDocs
      .map(doc => doc.pageContent)
      .join('\n\n');

    // FETCH REAL DATA FROM DATABASE
    const [userOrders, recommendations] = await Promise.all([
      getUserOrders(userId),
      getProductRecommendations(message),
    ]);

    // Build real data context
    let realDataContext = '';
    
    if (userOrders.length > 0) {
      realDataContext += `\n\nUser's Recent Orders:\n`;
      userOrders.forEach((order, index) => {
        realDataContext += `${index + 1}. Order #${order.id.slice(-8)} - ₹${order.total} - ${order.status} (${order.progress}%)\n`;
      });
    }

    if (recommendations.length > 0) {
      realDataContext += `\n\nAvailable Products:\n`;
      recommendations.forEach((product, index) => {
        realDataContext += `${index + 1}. ${product.name} - ₹${product.price} (${product.category})\n`;
      });
    }

    // Prepare the prompt with REAL context
    const systemPrompt = `You are a helpful customer support assistant for an e-commerce store.

${contextText ? `Knowledge Base Information:\n${contextText}\n` : ''}

${realDataContext ? `Real-Time Data:\n${realDataContext}\n` : ''}

${context.orderId ? `Current Order Context:\nOrder #${context.orderId}\nStatus: ${context.orderStatus || 'N/A'}\n` : ''}

CRITICAL INSTRUCTIONS:
1. Use the REAL-TIME DATA above to answer questions
2. If user asks about orders, use their actual order data
3. If user asks about products, use the actual product data
4. Be specific with names, prices, and status
5. Keep responses concise (under 100 words)
6. Be polite and helpful
7. If you don't have the information, say so and offer human help`;

    // Build messages array for LangChain
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10), // Last 10 messages for context
      { role: 'user', content: message },
    ];

    // Get LLM response with optimized settings for speed
    const fastLLM = new (require('@langchain/ollama').ChatOllama)({
      baseUrl: "http://localhost:11434",
      model: "llama3",
      temperature: 0.7,
      maxTokens: 200, // Reduced for faster responses
      numPredict: 200, // Limit token generation
    });

    const response = await fastLLM.invoke(messages);
    const aiResponse = response.content;

    // Update chat history
    history.push(
      { role: 'user', content: message },
      { role: 'assistant', content: aiResponse }
    );

    // Keep only last 20 messages
    if (history.length > 20) {
      chatHistory.set(userId, history.slice(-20));
    }

    return aiResponse;
  } catch (error) {
    console.error('Chatbot error:', error);
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