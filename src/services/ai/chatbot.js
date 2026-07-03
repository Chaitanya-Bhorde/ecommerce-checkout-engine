// AI Chatbot Service - Handles customer support conversations
// Uses Llama 3 (FREE) via Ollama for intelligent responses

const { llm, getLLM } = require('./llmConfig');
const { vectorStore } = require('./vectorStore');

// Chat history management
const chatHistory = new Map(); // Store conversation history per user

/**
 * Main chatbot function - processes user messages and returns AI responses
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

    // Prepare the prompt with context
    const systemPrompt = `You are a helpful customer support assistant for an e-commerce store.

${contextText ? `Relevant Information:\n${contextText}\n` : ''}

${context.orderId ? `Current Order Context:\nOrder #${context.orderId}\nStatus: ${context.orderStatus || 'N/A'}\n` : ''}

Guidelines:
- Be polite, professional, and helpful
- Keep responses concise (under 100 words)
- If you don't know something, say so and offer human help
- For order-specific queries, use the order context provided
- For product queries, mention specific products and prices`;

    // Build messages array for LangChain
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10), // Last 10 messages for context
      { role: 'user', content: message },
    ];

    // Get LLM response
    const response = await llm.invoke(messages);
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
};
