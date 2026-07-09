 // Agentic AI Workflow using LangGraph
// This defines the AI's decision-making process
// The AI can now THINK and ACT, not just chat!

const { StateGraph, END } = require('@langchain/langgraph');
const { HumanMessage, SystemMessage, AIMessage } = require('@langchain/core/messages');
const { getLLM } = require('./llmConfig'); // FIXED: use shared config (respects AI_PROVIDER=groq) instead of hardcoded Ollama
const { cancelOrder, processReturn, updateDeliveryAddress, getOrderDetails, searchProducts, applyDiscountCode, getUserRecentOrders } = require('./agentTools');

// FIXED: This now uses whatever AI_PROVIDER is set to in .env (groq/openai/ollama)
// instead of always hardcoding Ollama regardless of config.
const llm = getLLM('support');

// FIXED: LangChain message objects (SystemMessage/HumanMessage/AIMessage) can't be sent
// directly to the Groq/OpenAI fetch() calls in llmConfig.js - those expect plain
// { role, content } objects. This helper converts them before calling llm.invoke().
function toPlainMessages(messages) {
  return messages.map((m) => {
    let role = 'user';
    const type = typeof m._getType === 'function' ? m._getType() : null;
    if (type === 'system') role = 'system';
    else if (type === 'ai') role = 'assistant';
    else if (type === 'human') role = 'user';
    else if (m.role) role = m.role; // already a plain object
    return { role, content: m.content };
  });
}

// FIXED: Confirmation state must survive across separate HTTP requests
// (e.g. "cancel order #123" -> AI asks to confirm -> user replies "yes" in a NEW request).
// Previously, runAgent() created a brand-new state on every call, so the confirmation
// was always forgotten by the time the "yes" message arrived. This map persists it
// per-user, the same pattern already used for chatHistory in chatbot.js.
const pendingConfirmations = new Map();

/**
 * Agent State - Tracks conversation and actions
 */
class AgentState {
  constructor() {
    this.messages = [];
    this.userId = null;
    this.currentAction = null;
    this.actionResult = null;
    this.needsConfirmation = false;
    this.confirmationData = null;
  }
}

/**
 * Analyze user intent - What does the user want?
 */
async function analyzeIntent(state) {
  const lastMessage = state.messages[state.messages.length - 1].content.toLowerCase();

  const intents = {
    cancelOrder: ['cancel', 'cancellation', 'cancel my order'],
    returnOrder: ['return', 'refund', 'send back', 'return policy'],
    updateAddress: ['change address', 'update address', 'modify address', 'wrong address'],
    checkOrder: ['where is my order', 'order status', 'track order', 'order details', 'my order'],
    searchProducts: ['show me', 'recommend', 'suggest', 'looking for', 'find'],
    applyDiscount: ['apply discount', 'use code', 'promo code', 'coupon'],
    generalChat: ['hello', 'hi', 'hey', 'help', 'support'],
  };

  for (const [intent, patterns] of Object.entries(intents)) {
    if (patterns.some((pattern) => lastMessage.includes(pattern))) {
      return intent;
    }
  }

  return 'generalChat';
}

/**
 * Extract order ID from message
 */
function extractOrderId(message) {
  const patterns = [
    /order\s*#?(\w{8,})/i,
    /#(\w{8,})/,
    /order\s+(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Extract discount code from message
 */
function extractDiscountCode(message) {
  const match = message.match(/(?:code|promo|discount)\s+([A-Z0-9]+)/i);
  return match ? match[1] : null;
}

/**
 * Node: Handle general chat (no action needed)
 */
async function handleGeneralChat(state) {
  const systemPrompt = `You are a helpful customer support assistant for an e-commerce store.
  
  You can help with:
  - Order tracking and status
  - Product recommendations
  - Return and refund policies
  - Shipping information
  - General inquiries
  
  Be polite, professional, and helpful.
  Keep responses concise (under 100 words).
  
  If the user wants to perform an action (cancel order, return, etc.), guide them to provide the order ID.`;

  const messages = [
    new SystemMessage(systemPrompt),
    ...state.messages.slice(-10),
  ];

  // FIXED: convert to plain {role, content} before calling the shared llm (Groq/OpenAI/Ollama)
  const response = await llm.invoke(toPlainMessages(messages));

  return {
    messages: [...state.messages, new AIMessage(response.content)],
    currentAction: null,
    actionResult: null,
  };
}

/**
 * Node: Handle order cancellation
 */
async function handleCancelOrder(state) {
  const orderId = extractOrderId(state.messages[state.messages.length - 1].content);

  if (!orderId) {
    return {
      messages: [...state.messages, new AIMessage("I can help you cancel your order. Please provide your order ID (e.g., 'Cancel order #ABC12345').")],
      currentAction: null,
      actionResult: null,
    };
  }

  const confirmationData = {
    action: 'cancelOrder',
    orderId,
    tool: cancelOrder,
    params: { orderId, userId: state.userId, reason: 'User requested via AI' },
  };

  return {
    messages: [...state.messages, new AIMessage(`I found order #${orderId.slice(-8).toUpperCase()}. Are you sure you want to cancel this order? This action cannot be undone. Please confirm by saying "yes" or "confirm".`)],
    currentAction: 'cancelOrder',
    actionResult: null,
    needsConfirmation: true,
    confirmationData,
  };
}

/**
 * Node: Handle return request
 */
async function handleReturnOrder(state) {
  const orderId = extractOrderId(state.messages[state.messages.length - 1].content);

  if (!orderId) {
    return {
      messages: [...state.messages, new AIMessage("I can help you initiate a return. Please provide your order ID (e.g., 'Return order #ABC12345').")],
      currentAction: null,
      actionResult: null,
    };
  }

  const confirmationData = {
    action: 'processReturn',
    orderId,
    tool: processReturn,
    params: { orderId, userId: state.userId, reason: 'User requested via AI' },
  };

  return {
    messages: [...state.messages, new AIMessage(`I found order #${orderId.slice(-8).toUpperCase()}. Are you sure you want to initiate a return? Please confirm by saying "yes" or "confirm".`)],
    currentAction: 'processReturn',
    actionResult: null,
    needsConfirmation: true,
    confirmationData,
  };
}

/**
 * Node: Handle address update
 */
async function handleUpdateAddress(state) {
  const orderId = extractOrderId(state.messages[state.messages.length - 1].content);

  if (!orderId) {
    return {
      messages: [...state.messages, new AIMessage("I can help you update your delivery address. Please provide your order ID (e.g., 'Update address for order #ABC12345').")],
      currentAction: null,
      actionResult: null,
    };
  }

  return {
    messages: [...state.messages, new AIMessage(`I found order #${orderId.slice(-8).toUpperCase()}. Please provide the new delivery address.`)],
    currentAction: 'updateAddress',
    actionResult: { orderId },
    needsConfirmation: false,
  };
}

/**
 * Node: Handle order status check
 */
async function handleCheckOrder(state) {
  const orderId = extractOrderId(state.messages[state.messages.length - 1].content);

  if (!orderId) {
    const result = await getUserRecentOrders(state.userId, 3);

    if (result.success && result.orders.length > 0) {
      const orderList = result.orders.map((o) =>
        `- Order #${o.id.slice(-8).toUpperCase()}: ${o.status} (${o.progress}%) - ₹${o.total}`
      ).join('\n');

      return {
        messages: [...state.messages, new AIMessage(`Here are your recent orders:\n${orderList}\n\nWhich order would you like to check? Please provide the order ID.`)],
        currentAction: null,
        actionResult: null,
      };
    }

    return {
      messages: [...state.messages, new AIMessage("I couldn't find any recent orders. Please provide your order ID to check the status.")],
      currentAction: null,
      actionResult: null,
    };
  }

  const result = await getOrderDetails(orderId, state.userId);

  if (result.success) {
    const order = result.order;
    const response = `Order ${order.orderNumber}:\n` +
      `Status: ${order.status}\n` +
      `Delivery Progress: ${order.progress}%\n` +
      `Total: ₹${order.total}\n` +
      `Date: ${new Date(order.date).toLocaleDateString()}\n` +
      `Items: ${order.items.length} item(s)\n\n` +
      `Is there anything else you'd like to know about this order?`;

    return {
      messages: [...state.messages, new AIMessage(response)],
      currentAction: null,
      actionResult: result,
    };
  }

  return {
    messages: [...state.messages, new AIMessage(result.message)],
    currentAction: null,
    actionResult: null,
  };
}

/**
 * Node: Handle product search
 */
async function handleSearchProducts(state) {
  const lastMessage = state.messages[state.messages.length - 1].content;

  const searchQuery = lastMessage
    .replace(/show me|recommend|suggest|looking for|find/gi, '')
    .trim();

  if (!searchQuery) {
    return {
      messages: [...state.messages, new AIMessage("What type of products are you looking for?")],
      currentAction: null,
      actionResult: null,
    };
  }

  const result = await searchProducts(searchQuery, 5);

  if (result.success && result.products.length > 0) {
    const productList = result.products.map((p, i) =>
      `${i + 1}. ${p.name} - ₹${p.price} (${p.category})`
    ).join('\n');

    const response = `Here are some products I found:\n${productList}\n\nWould you like more details about any of these?`;

    return {
      messages: [...state.messages, new AIMessage(response)],
      currentAction: null,
      actionResult: result,
    };
  }

  return {
    messages: [...state.messages, new AIMessage("I couldn't find any products matching your search. Try a different keyword?")],
    currentAction: null,
    actionResult: null,
  };
}

/**
 * Router - Decides which node to go to next
 */
async function router(state) {
  const intent = state.currentAction || await analyzeIntent(state);

  switch (intent) {
    case 'cancelOrder':
      return 'cancelOrder';
    case 'returnOrder':
      return 'returnOrder';
    case 'updateAddress':
      return 'updateAddress';
    case 'checkOrder':
      return 'checkOrder';
    case 'searchProducts':
      return 'searchProducts';
    default:
      return 'generalChat';
  }
}

/**
 * Create the agent workflow graph
 */
function createAgentWorkflow() {
  const workflow = new StateGraph({
    channels: {
      messages: [],
      userId: null,
      currentAction: null,
      actionResult: null,
      needsConfirmation: false,
      confirmationData: null,
    },
  });

  workflow.addNode('generalChat', handleGeneralChat);
  workflow.addNode('cancelOrder', handleCancelOrder);
  workflow.addNode('returnOrder', handleReturnOrder);
  workflow.addNode('updateAddress', handleUpdateAddress);
  workflow.addNode('checkOrder', handleCheckOrder);
  workflow.addNode('searchProducts', handleSearchProducts);

  workflow.setEntryPoint('generalChat');

  workflow.addConditionalEdges('generalChat', router, {
    generalChat: END,
    cancelOrder: 'cancelOrder',
    returnOrder: 'returnOrder',
    updateAddress: 'updateAddress',
    checkOrder: 'checkOrder',
    searchProducts: 'searchProducts',
  });

  workflow.addEdge('cancelOrder', END);
  workflow.addEdge('returnOrder', END);
  workflow.addEdge('updateAddress', END);
  workflow.addEdge('checkOrder', END);
  workflow.addEdge('searchProducts', END);

  return workflow.compile();
}

/**
 * Run the agent with user message
 *
 * FIXED: now returns `handledByAgent` so the calling route knows whether this
 * was a real agent action (cancel/return/etc, or a confirmation reply) vs a
 * plain generalChat message that should instead get the richer, DB-personalized
 * response from chatbot.js's chat() function.
 *
 * FIXED: confirmations now persist across requests via `pendingConfirmations`.
 */
async function runAgent(userId, message) {
  try {
    const userKey = String(userId);

    // Step 1: Is there a pending confirmation waiting for this user?
    if (pendingConfirmations.has(userKey)) {
      const pending = pendingConfirmations.get(userKey);
      const lower = message.toLowerCase();

      if (lower.includes('yes') || lower.includes('confirm') || lower.includes('sure')) {
        pendingConfirmations.delete(userKey);
        try {
          const result = await pending.tool(pending.params.orderId, pending.params.userId, pending.params.reason);
          return {
            success: true,
            response: result.message,
            action: pending.action,
            actionResult: result,
            handledByAgent: true,
          };
        } catch (error) {
          console.error('[Agent] Error executing confirmed action:', error.message);
          return {
            success: false,
            response: "Sorry, I encountered an error while processing your request. Please try again or contact support.",
            action: pending.action,
            actionResult: null,
            handledByAgent: true,
          };
        }
      }

      if (lower.includes('no') || lower.includes('cancel')) {
        pendingConfirmations.delete(userKey);
        return {
          success: true,
          response: "Okay, I've cancelled that action. Is there anything else I can help you with?",
          action: null,
          actionResult: null,
          handledByAgent: true,
        };
      }

      // Ambiguous reply - ask again instead of silently dropping the pending action
      return {
        success: true,
        response: `I still need your confirmation for that ${pending.action === 'cancelOrder' ? 'cancellation' : 'return'}. Please reply "yes" to confirm or "no" to cancel.`,
        action: pending.action,
        actionResult: null,
        handledByAgent: true,
      };
    }

    // Step 2: No pending confirmation - run the normal intent-routing workflow
    const workflow = createAgentWorkflow();

    const initialState = {
      messages: [new HumanMessage(message)],
      userId: userKey,
      currentAction: null,
      actionResult: null,
      needsConfirmation: false,
      confirmationData: null,
    };

    const result = await workflow.invoke(initialState);
    const lastMessage = result.messages[result.messages.length - 1];

    // Step 3: If this turn set up a new confirmation request, persist it for the next request
    if (result.needsConfirmation && result.confirmationData) {
      pendingConfirmations.set(userKey, result.confirmationData);
    }

    // generalChat sets currentAction to null - use that to decide who should answer
    const handledByAgent = result.currentAction !== null;

    return {
      success: true,
      response: lastMessage.content,
      action: result.currentAction,
      actionResult: result.actionResult,
      handledByAgent,
    };
  } catch (error) {
    console.error('[Agent] Workflow error:', error.message);
    console.error('[Agent] Stack:', error.stack);
    return {
      success: false,
      response: null, // Return null to signal fallback to chat()
      action: null,
      actionResult: null,
      handledByAgent: false, // FIXED: Allow fallback to chat() function
    };
  }
}

module.exports = {
  runAgent,
  createAgentWorkflow,
};