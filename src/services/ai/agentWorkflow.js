// Agentic AI Workflow using LangGraph
// This defines the AI's decision-making process
// The AI can now THINK and ACT, not just chat!

const { StateGraph, END } = require('@langchain/langgraph');
const { ChatOllama } = require('@langchain/ollama');
const { HumanMessage, SystemMessage, AIMessage } = require('@langchain/core/messages');
const { cancelOrder, processReturn, updateDeliveryAddress, getOrderDetails, searchProducts, applyDiscountCode, getUserRecentOrders } = require('./agentTools');

// Initialize LLM
const llm = new ChatOllama({
  baseUrl: "http://localhost:11434",
  model: "llama3",
  temperature: 0.3, // Lower temperature for more precise decisions
  maxTokens: 300,
});

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
  
  // Intent detection patterns
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
    if (patterns.some(pattern => lastMessage.includes(pattern))) {
      return intent;
    }
  }

  return 'generalChat';
}

/**
 * Extract order ID from message
 */
function extractOrderId(message) {
  // Match patterns like "order #123", "order 123", "#123"
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

  const response = await llm.invoke(messages);
  
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

  // Ask for confirmation
  state.needsConfirmation = true;
  state.confirmationData = {
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
    confirmationData: state.confirmationData,
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

  // Ask for confirmation
  state.needsConfirmation = true;
  state.confirmationData = {
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
    confirmationData: state.confirmationData,
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

  // Ask for new address
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
    // Get user's recent orders
    const result = await getUserRecentOrders(state.userId, 3);
    
    if (result.success && result.orders.length > 0) {
      const orderList = result.orders.map(o => 
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

  // Get order details
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
  
  // Extract search query
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
 * Node: Execute confirmed action
 */
async function executeConfirmedAction(state) {
  if (!state.confirmationData || !state.needsConfirmation) {
    return state;
  }

  const { tool, params } = state.confirmationData;
  
  try {
    const result = await tool(params.orderId, params.userId, params.reason);
    
    state.needsConfirmation = false;
    state.confirmationData = null;
    state.actionResult = result;

    return {
      messages: [...state.messages, new AIMessage(result.message)],
      currentAction: null,
      actionResult: result,
      needsConfirmation: false,
      confirmationData: null,
    };
  } catch (error) {
    return {
      messages: [...state.messages, new AIMessage("Sorry, I encountered an error while processing your request. Please try again or contact support.")],
      currentAction: null,
      actionResult: null,
      needsConfirmation: false,
      confirmationData: null,
    };
  }
}

/**
 * Router - Decides which node to go to next
 */
async function router(state) {
  if (state.needsConfirmation) {
    const lastMessage = state.messages[state.messages.length - 1].content.toLowerCase();
    
    if (lastMessage.includes('yes') || lastMessage.includes('confirm') || lastMessage.includes('sure')) {
      return 'executeAction';
    }
    
    if (lastMessage.includes('no') || lastMessage.includes('cancel')) {
      return 'generalChat';
    }
  }

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

  // Add nodes
  workflow.addNode('generalChat', handleGeneralChat);
  workflow.addNode('cancelOrder', handleCancelOrder);
  workflow.addNode('returnOrder', handleReturnOrder);
  workflow.addNode('updateAddress', handleUpdateAddress);
  workflow.addNode('checkOrder', handleCheckOrder);
  workflow.addNode('searchProducts', handleSearchProducts);
  workflow.addNode('executeAction', executeConfirmedAction);

  // Set entry point
  workflow.setEntryPoint('generalChat');

  // Add conditional edges from generalChat
  workflow.addConditionalEdges('generalChat', router, {
    generalChat: END,
    cancelOrder: 'cancelOrder',
    returnOrder: 'returnOrder',
    updateAddress: 'updateAddress',
    checkOrder: 'checkOrder',
    searchProducts: 'searchProducts',
    executeAction: 'executeAction',
  });

  // All action nodes go back to generalChat or END
  workflow.addEdge('cancelOrder', END);
  workflow.addEdge('returnOrder', END);
  workflow.addEdge('updateAddress', END);
  workflow.addEdge('checkOrder', END);
  workflow.addEdge('searchProducts', END);
  workflow.addEdge('executeAction', END);

  return workflow.compile();
}

/**
 * Run the agent with user message
 */
async function runAgent(userId, message) {
  try {
    const workflow = createAgentWorkflow();
    
    const initialState = {
      messages: [new HumanMessage(message)],
      userId,
      currentAction: null,
      actionResult: null,
      needsConfirmation: false,
      confirmationData: null,
    };

    const result = await workflow.invoke(initialState);
    
    // Get the last AI message
    const lastMessage = result.messages[result.messages.length - 1];
    
    return {
      success: true,
      response: lastMessage.content,
      action: result.currentAction,
      actionResult: result.actionResult,
    };
  } catch (error) {
    console.error('Agent workflow error:', error);
    return {
      success: false,
      response: "I'm sorry, I'm having trouble right now. Let me connect you with a human agent who can help you better.",
      action: null,
      actionResult: null,
    };
  }
}

module.exports = {
  runAgent,
  createAgentWorkflow,
};