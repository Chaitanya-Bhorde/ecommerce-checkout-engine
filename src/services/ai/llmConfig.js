// AI Configuration - Using FREE Ollama with Llama 3
// This configures the LLM (Large Language Model) for the chatbot

const { ChatOllama } = require("@langchain/ollama");

// Initialize Ollama with Llama 3 (FREE, runs locally)
const llm = new ChatOllama({
  baseUrl: "http://localhost:11434", // Ollama default URL
  model: "llama3", // Meta's Llama 3 model (FREE)
  temperature: 0.7, // Controls randomness (0 = deterministic, 1 = creative)
  maxTokens: 500, // Maximum response length
});

// LLM Configuration for different use cases
const llmConfigs = {
  // Customer support - friendly and helpful
  support: {
    temperature: 0.7,
    maxTokens: 300,
    systemPrompt: `You are a helpful customer support assistant for an e-commerce store.
    You help customers with:
    - Order status and tracking
    - Product recommendations
    - Return and refund policies
    - Shipping information
    - General inquiries
    
    Always be polite, professional, and helpful.
    If you don't know something, say so and offer to connect them with a human agent.
    Keep responses concise and under 100 words.`,
  },

  // Product recommendations - analytical
  recommendations: {
    temperature: 0.5,
    maxTokens: 200,
    systemPrompt: `You are a product recommendation expert.
    Based on customer preferences and browsing history, suggest relevant products.
    Be specific and mention product names and prices.
    Keep recommendations brief and focused.`,
  },

  // Order automation - precise and action-oriented
  orderAutomation: {
    temperature: 0.3,
    maxTokens: 150,
    systemPrompt: `You are an order management assistant.
    Help customers with:
    - Order status checks
    - Cancellation requests
    - Return requests
    - Delivery estimates
    
    Be precise and action-oriented.
    Always confirm actions before executing them.`,
  },
};

// Function to get LLM with specific config
function getLLM(configType = "support") {
  const config = llmConfigs[configType] || llmConfigs.support;
  
  return new ChatOllama({
    baseUrl: "http://localhost:11434",
    model: "llama3",
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });
}

module.exports = {
  llm,
  getLLM,
  llmConfigs,
};
